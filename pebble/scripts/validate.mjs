import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repoRoot = resolve(root, "..");
const requiredFiles = [
  "wscript",
  "src/c/mdbl.c",
  "src/embeddedjs/main.js",
  "src/embeddedjs/manifest.json",
  "src/pkjs/index.js",
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) throw new Error(`Missing Alloy file: ${file}`);
}
if (!existsSync(resolve(repoRoot, "frontend/src/features/pebble/PebblePairPage.tsx"))) {
  throw new Error("Authenticated Pebble pairing page is missing");
}

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const manifest = JSON.parse(
  readFileSync(resolve(root, "src/embeddedjs/manifest.json"), "utf8"),
);

if (pkg.pebble?.projectType !== "moddable") throw new Error("projectType must be moddable");
if (!pkg.dependencies?.["@moddable/pebbleproxy"]) {
  throw new Error("@moddable/pebbleproxy dependency is required");
}
if (JSON.stringify(pkg.pebble?.targetPlatforms) !== JSON.stringify(["emery", "gabbro"])) {
  throw new Error("Alloy targets must be emery and gabbro");
}
for (const key of ["API_BASE_URL", "AUTH_TOKEN"]) {
  if (!pkg.pebble?.messageKeys?.includes(key)) throw new Error(`Missing message key: ${key}`);
}
if (manifest.modules?.["*"] !== "./main") throw new Error("Embedded main module is missing");

const watchSource = readFileSync(resolve(root, "src/embeddedjs/main.js"), "utf8");
const phoneSource = readFileSync(resolve(root, "src/pkjs/index.js"), "utf8");
const pairingSource = readFileSync(
  resolve(repoRoot, "frontend/src/features/pebble/PebblePairPage.tsx"),
  "utf8",
);
const clientSource = readFileSync(
  resolve(repoRoot, "backend/app/api/routes/integrations/clients.py"),
  "utf8",
);
if (!watchSource.includes("fetch(")) throw new Error("Watch code must use Alloy fetch()");
for (const action of ["complete-task", "skip-task"]) {
  if (!watchSource.includes(action)) throw new Error(`Missing Daynest action: ${action}`);
}
if (!phoneSource.includes("@moddable/pebbleproxy")) {
  throw new Error("Phone code must initialize the official Alloy network proxy");
}
if (!phoneSource.includes("/pebble-pair") || !pairingSource.includes("pebblejs://close")) {
  throw new Error("Phone and web code must use the authenticated Pebble pairing flow");
}
for (const scope of ["pebble:read", "pebble:write"]) {
  if (!clientSource.includes(scope)) {
    throw new Error(`Pairing client must include required scope: ${scope}`);
  }
}

// Piu resolves `font` against PebbleOS's built-in font table. An unknown family
// throws an uncaught URIError that kills the watchapp the moment it starts, and
// nothing in the build catches it — so pin the families here instead.
const PEBBLE_FONT_FAMILIES = ["Gothic", "Bitham", "Roboto", "DroidSerif", "Leco"];
for (const [, font] of watchSource.matchAll(/font:\s*"([^"]+)"/g)) {
  const match = /^(?:italic\s+)?(?:\w+\s+)?\d+px\s+(\w+)$/.exec(font);
  if (!match || !PEBBLE_FONT_FAMILIES.includes(match[1])) {
    throw new Error(
      `Unsupported Piu font ${JSON.stringify(font)}: use "<size>px <family>" with one of ` +
        PEBBLE_FONT_FAMILIES.join(", "),
    );
  }
}

// PKJS is bundled by the SDK's webpack/acorn, which predates ES2017 trailing
// commas in argument lists — one is a hard build failure, so keep them out.
if (/,\s*[)\]]/.test(phoneSource)) {
  throw new Error("Trailing comma in src/pkjs/index.js: the SDK's PKJS bundler cannot parse it");
}

// The proxy owns the PKJS send queue; bypassing it can drop messages when a
// fetch() is in flight (see @moddable/pebbleproxy's README).
if (/Pebble\.sendAppMessage\s*\(/.test(phoneSource)) {
  throw new Error("Use moddableProxy.sendAppMessage() so sends are queued behind proxy traffic");
}

for (const file of ["src/embeddedjs/main.js", "src/pkjs/index.js"]) {
  execFileSync(process.execPath, ["--check", resolve(root, file)], { stdio: "inherit" });
}

console.log(`Validated ${pkg.pebble.displayName} Alloy package`);
