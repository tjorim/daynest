import {} from "piu/MC";
import Button from "pebble/button";
import { API_BASE_URL, API_INTEGRATION_KEY } from "config";

// Today glance + quick actions for Daynest, replacing the removed Wear OS
// tile/complication/quick-action surface (see issue #676).
//
// Auth/data source: the /api/integrations/home-assistant/* endpoints, since
// those are the only routes currently wired to accept an integration API
// key (via require_integration_auth in
// backend/app/api/dependencies/integration_auth.py). Plain /api/today only
// accepts an interactive OIDC bearer token, which a watch can't produce, so
// this app deliberately does not call it. Create the integration key from
// the Daynest web app: Settings > Integration Clients.
const DASHBOARD_PATH = "/api/integrations/home-assistant/dashboard";
const COMPLETE_TASK_PATH = "/api/integrations/home-assistant/actions/complete-task";
const SKIP_TASK_PATH = "/api/integrations/home-assistant/actions/skip-task";

const CACHE_PATH = "daynest-today";
const CACHE_KEY = "dashboard";

const backgroundSkin = new Skin({ fill: "black" });
const bodyStyle = new Style({ font: "OpenSans-Regular-15", color: "white", horizontal: "left", vertical: "top" });

const DaynestApplication = Application.template($ => ({
  skin: backgroundSkin,
  contents: [
    Text($, {
      name: "status",
      left: 4, right: 4, top: 4, bottom: 4,
      style: bodyStyle,
      string: "Daynest\n\nLoading…",
    }),
  ],
}));

const application = new DaynestApplication(null, { displayListLength: 4096 });

let lastDashboard = loadCachedDashboard();
renderDashboard(lastDashboard, { stale: !!lastDashboard });

function loadCachedDashboard() {
  const store = device.keyValue.open({ path: CACHE_PATH, format: "string" });
  const raw = store.read(CACHE_KEY);
  store.close();
  return raw ? JSON.parse(raw) : null;
}

function saveCachedDashboard(dashboard) {
  const store = device.keyValue.open({ path: CACHE_PATH, format: "string" });
  store.write(CACHE_KEY, JSON.stringify(dashboard));
  store.close();
}

function renderDashboard(dashboard, { stale = false } = {}) {
  const statusText = application.content("status");
  if (!dashboard) {
    statusText.string = "Daynest\n\nNo data yet.\nWaiting for phone…";
    return;
  }

  const lines = [
    "Daynest — Today",
    `Due ${dashboard.due_today_count}   Overdue ${dashboard.overdue_count}`,
    "",
  ];

  const items = (dashboard.due_today || []).slice(0, 4);
  if (items.length === 0) {
    lines.push("Nothing due. Nice!");
  } else {
    for (const item of items) lines.push(`• ${item.title}`);
    lines.push("");
    lines.push("SELECT completes / DOWN");
    lines.push("skips the first item.");
  }

  if (stale) lines.push("\n(cached — offline)");

  statusText.string = lines.join("\n");
}

async function fetchDashboard() {
  const response = await fetch(`${API_BASE_URL}${DASHBOARD_PATH}`, {
    headers: { "X-Integration-Key": API_INTEGRATION_KEY },
  });
  if (!response.ok) throw new Error(`dashboard fetch failed: HTTP ${response.status}`);
  return response.json();
}

async function postAction(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Integration-Key": API_INTEGRATION_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`action failed: HTTP ${response.status}`);
  return response.json();
}

async function refresh() {
  if (!watch.connected.pebblekit) {
    console.log("Daynest: proxy not ready yet, showing cache");
    renderDashboard(lastDashboard, { stale: !!lastDashboard });
    return;
  }
  try {
    const dashboard = await fetchDashboard();
    lastDashboard = dashboard;
    saveCachedDashboard(dashboard);
    renderDashboard(dashboard);
  } catch (e) {
    console.log(`Daynest refresh failed: ${e}`);
    renderDashboard(lastDashboard, { stale: !!lastDashboard });
  }
}

async function runAction(kind) {
  const items = lastDashboard && lastDashboard.due_today;
  if (!items || items.length === 0) return;

  const item = items[0];
  const path = kind === "complete" ? COMPLETE_TASK_PATH : SKIP_TASK_PATH;
  try {
    await postAction(path, { chore_instance_id: item.chore_instance_id });
    await refresh();
  } catch (e) {
    console.log(`Daynest ${kind} action failed: ${e}`);
  }
}

watch.addEventListener("connected", refresh);
refresh();

new Button({
  types: ["up", "select", "down"],
  onPush(down, type) {
    if (!down) return;
    if (type === "up") refresh();
    else if (type === "select") runAction("complete");
    else if (type === "down") runAction("skip");
  },
});
