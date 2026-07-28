// End-to-end check of the watch app against scripts/mock-server.py over real
// HTTP. Piu and AppMessage remain stubbed; the emulator/device covers those.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import {
  COMPLETE_PATH,
  DASHBOARD_PATH,
  SKIP_PATH,
  createHarness,
} from "./harness.mjs";

const SERVER = resolve(import.meta.dirname, "../scripts/mock-server.py");
const TOKEN = "test-pebble-key";
const python = [
  process.env.PYTHON,
  "python3",
  resolve(import.meta.dirname, "../../backend/.venv/Scripts/python.exe"),
  "python",
]
  .filter(Boolean)
  .find((candidate) => spawnSync(candidate, ["--version"]).status === 0);
const hasPython = Boolean(python);

let server;
let port;
let workdir;

function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.on("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const { port: chosen } = probe.address();
      probe.close(() => done(chosen));
    });
  });
}

async function proxy(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

before(async () => {
  if (!hasPython) return;
  workdir = mkdtempSync(join(tmpdir(), "daynest-pebble-live-"));
  port = await freePort();
  server = spawn(python, [SERVER, String(port), "--log", join(workdir, "requests.log")], {
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}${DASHBOARD_PATH}`);
      return;
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  throw new Error("mock server did not start");
});

after(() => {
  server?.kill();
  if (workdir) rmSync(workdir, { recursive: true, force: true });
});

test("renders and mutates tasks against the mock backend", { skip: !hasPython }, async () => {
  const harness = createHarness({
    storage: { authToken: TOKEN, apiBaseUrl: `http://127.0.0.1:${port}` },
    responder: proxy,
  });

  await harness.settle();
  assert.match(harness.status, /Water plants/);

  await harness.press("select");
  assert.match(harness.status, /Take out bins/);

  await harness.press("down");
  assert.match(harness.status, /Vacuum hallway/);

  assert.deepEqual(
    harness.requests.map((request) => new URL(request.url).pathname),
    [DASHBOARD_PATH, COMPLETE_PATH, DASHBOARD_PATH, SKIP_PATH, DASHBOARD_PATH],
  );
  assert.equal(harness.requests[1].headers["X-Integration-Key"], TOKEN);
  assert.deepEqual(JSON.parse(harness.requests[1].body), { chore_instance_id: 101 });
  assert.deepEqual(JSON.parse(harness.requests[3].body), { chore_instance_id: 102 });
});
