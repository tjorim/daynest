import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMPLETE_PATH,
  DASHBOARD_PATH,
  createHarness,
  dashboard,
  snapshot,
} from "./harness.mjs";

const TOKEN = {
  authToken: "daynest_key",
  apiBaseUrl: "https://example.test",
};

const paths = (harness) =>
  harness.requests.map((request) => new URL(request.url).pathname);

test("a live dashboard is rendered and cached", async () => {
  const harness = createHarness({ storage: TOKEN });

  await harness.settle();

  assert.match(harness.status, /Task 101/);
  assert.equal(JSON.parse(harness.cachedDashboard).dashboard.due_today[0].chore_instance_id, 101);
});

test("an offline cold start shows the cached dashboard without fetching", async () => {
  const harness = createHarness({
    connected: false,
    storage: TOKEN,
    cachedDashboard: snapshot(dashboard()),
  });

  await harness.settle();

  assert.match(harness.status, /Task 101/);
  assert.match(harness.status, /Phone offline · \d\d:\d\d/);
  assert.deepEqual(harness.requests, []);
});

test("a cache older than 12 hours is discarded", async () => {
  const harness = createHarness({
    connected: false,
    storage: TOKEN,
    cachedDashboard: snapshot(dashboard(), 13 * 60 * 60),
  });

  await harness.settle();

  assert.match(harness.status, /Phone offline/);
  assert.equal(harness.cachedDashboard, undefined);
});

test("cached task state is re-read before choosing a mutation", async () => {
  const harness = createHarness({
    connected: false,
    storage: TOKEN,
    cachedDashboard: snapshot(dashboard(101)),
    responder: (url) =>
      url.endsWith(DASHBOARD_PATH)
        ? { status: 200, body: dashboard(201) }
        : { status: 200, body: {} },
  });
  await harness.settle();
  harness.setConnected(true);

  await harness.press("select");

  assert.deepEqual(paths(harness), [DASHBOARD_PATH, COMPLETE_PATH, DASHBOARD_PATH]);
  assert.equal(JSON.parse(harness.requests[1].body).chore_instance_id, 201);
});

test("repeated SELECT presses submit one mutation", async () => {
  let release;
  const harness = createHarness({
    storage: TOKEN,
    responder: (url) => {
      if (url.endsWith(DASHBOARD_PATH)) return { status: 200, body: dashboard() };
      return new Promise((done) => {
        release = () => done({ status: 200, body: {} });
      });
    },
  });
  await harness.settle();
  harness.requests.length = 0;

  await harness.press("select", false);
  await harness.press("select", false);
  await harness.press("select", false);
  await new Promise((done) => setTimeout(done, 0));

  assert.deepEqual(
    paths(harness).filter((path) => path === COMPLETE_PATH),
    [COMPLETE_PATH],
  );
  release();
  await harness.settle();
});

test("a conflict re-reads the dashboard without retrying", async () => {
  let dashboardReads = 0;
  const harness = createHarness({
    storage: TOKEN,
    responder: (url) => {
      if (url.endsWith(DASHBOARD_PATH)) {
        dashboardReads += 1;
        return { status: 200, body: dashboard(dashboardReads === 1 ? 101 : 201) };
      }
      return { status: 409, body: {} };
    },
  });
  await harness.settle();
  harness.requests.length = 0;

  await harness.press("select");

  assert.deepEqual(paths(harness), [COMPLETE_PATH, DASHBOARD_PATH]);
  assert.match(harness.status, /Task 201/);
});

test("a changed pairing clears data from the previous account", async () => {
  const harness = createHarness({
    connected: false,
    storage: TOKEN,
    cachedDashboard: snapshot(dashboard()),
  });
  await harness.settle();

  await harness.configure({ AUTH_TOKEN: "other_key" });

  assert.equal(harness.cachedDashboard, undefined);
  assert.match(harness.status, /Phone offline/);
});
