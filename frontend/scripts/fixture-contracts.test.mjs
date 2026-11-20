import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync, Visitor } from "oxc-parser";
import { expect, it } from "vitest";

export function uncheckedResponses(source, file) {
  const parsed = parseSync(file, source);
  if (parsed.errors.length) throw new Error(`Cannot inspect ${file}`);
  const generated = new Set();
  for (const node of parsed.program.body) {
    if (node.type === "ImportDeclaration" && /^@\/api-(?:schema|types)$/.test(node.source.value)) {
      for (const specifier of node.specifiers) generated.add(specifier.local.name);
    }
  }
  const unchecked = [];
  new Visitor({
    CallExpression(node) {
      const callee = source.slice(node.callee.start, node.callee.end);
      if (!["HttpResponse.json", "Response.json", "jsonResponse"].includes(callee)) return;
      const call = source.slice(node.start, node.end);
      const type =
        node.typeArguments && source.slice(node.typeArguments.start, node.typeArguments.end);
      // A type argument must name an imported API contract (optionally an array), not any/unknown/a local record.
      if (
        callee === "jsonResponse" &&
        type &&
        /^<\w+(?:\[\])?>$/.test(type) &&
        generated.has(type.slice(1, -1).replace("[]", ""))
      )
        return;
      if (/\/\* Fixture exception: [^*]+\*\//.test(call) && /status:\s*[45]\d\d/.test(call)) return;
      unchecked.push(`${file}:${source.slice(0, node.start).split("\n").length}`);
    },
    NewExpression(node) {
      if (
        node.callee.type !== "Identifier" ||
        !["Response", "HttpResponse"].includes(node.callee.name)
      )
        return;
      const first = node.arguments[0];
      // Bodyless control/error responses are not JSON fixtures. All JSON bodies use jsonResponse.
      if (!first || (first.type === "Literal" && first.value === null)) return;
      const call = source.slice(node.start, node.end);
      if (/status:\s*[45]\d\d/.test(call) || /"Content-Type": "text\/event-stream"/.test(call))
        return;
      unchecked.push(`${file}:${source.slice(0, node.start).split("\n").length}`);
    },
  }).visit(parsed.program);
  return unchecked;
}

it("requires generated contracts on all JSON response fixtures", () => {
  const unchecked = [];
  for (const directory of ["src/mocks/handlers", "tests", "e2e"]) {
    for (const entry of readdirSync(directory, { recursive: true })) {
      const file = resolve(directory, String(entry));
      if (!/\.tsx?$/.test(file) || file.endsWith("fixtureContracts.compile.ts")) continue;
      unchecked.push(...uncheckedResponses(readFileSync(file, "utf8"), file));
    }
  }
  expect(unchecked).toEqual([]);
});

it("rejects inferred, arbitrary and raw JSON success fixtures", () => {
  for (const call of [
    "jsonResponse({})",
    "jsonResponse<any>({})",
    "HttpResponse.json({})",
    "HttpResponse.json<LocalRecord>({})",
    "Response.json({})",
    "new Response(JSON.stringify({}))",
    "new HttpResponse(JSON.stringify({}))",
  ])
    expect(uncheckedResponses(call, "probe.ts")).toHaveLength(1);
  expect(
    uncheckedResponses(
      'import type { TodayResponse } from "@/api-schema"; jsonResponse<TodayResponse>({})',
      "probe.ts",
    ),
  ).toEqual([]);
});

it("keeps API function doubles bound to the actual function signatures", () => {
  const names = new Set();
  for (const file of readdirSync("src/lib/api")) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(resolve("src/lib/api", file), "utf8");
    for (const match of source.matchAll(/export (?:async )?function (\w+)/g)) names.add(match[1]);
  }
  const unchecked = [];
  for (const entry of readdirSync("tests", { recursive: true })) {
    const file = resolve("tests", String(entry));
    if (!/\.tsx?$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    const parsed = parseSync(file, source);
    new Visitor({
      Property(node) {
        const name = node.key.name;
        if (!names.has(name) || node.value.type !== "CallExpression") return;
        const call = node.value;
        if (source.slice(call.callee.start, call.callee.end) !== "vi.fn") return;
        const signature =
          call.typeArguments && source.slice(call.typeArguments.start, call.typeArguments.end);
        if (signature?.includes('typeof import("@/lib/api/')) return;
        const preceding = source.slice(source.lastIndexOf("\n", node.start - 2) - 150, node.start);
        if (
          name === "fetchMe" &&
          file.endsWith("/AuthProvider.test.tsx") &&
          preceding.includes("Fixture control:")
        )
          return;
        unchecked.push(`${file}: ${name}`);
      },
    }).visit(parsed.program);
  }
  expect(unchecked).toEqual([]);
});
