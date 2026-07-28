import {} from "piu/MC";
import Button from "pebble/button";
import Message from "pebble/message";

// Today glance + quick actions for Daynest, replacing the removed Wear OS
// tile/complication/quick-action surface (see issue #676).
//
// Auth/data source: dedicated Pebble routes guarded by pebble:read/write.
// Create a scoped key from the Daynest web app: Settings > Integration Clients.
const DASHBOARD_PATH = "/api/integrations/pebble/dashboard";
const COMPLETE_TASK_PATH = "/api/integrations/pebble/actions/complete-task";
const SKIP_TASK_PATH = "/api/integrations/pebble/actions/skip-task";
const DEFAULT_API_BASE_URL = "https://daynest.tjor.im";

const CACHE_PATH = "daynest-today";
const CACHE_KEY = "dashboard";

// Piu resolves `font` through PebbleOS's built-in font table, so only the
// system families/sizes are available (Gothic 9/14/18/24/28/36, Bitham,
// Roboto, Droid Serif, Leco — regular or bold). An unknown family throws an
// uncaught "font not found" URIError that kills the app at startup.
const backgroundSkin = new Skin({ fill: "black" });
const bodyStyle = new Style({ font: "14px Gothic", color: "white", horizontal: "left", vertical: "top" });

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

let apiBaseUrl = localStorage.getItem("apiBaseUrl") || DEFAULT_API_BASE_URL;
let authToken = localStorage.getItem("authToken");
let lastDashboard = loadCachedDashboard();
renderDashboard(lastDashboard, { stale: !!lastDashboard });

function loadCachedDashboard() {
  const store = device.keyValue.open({ path: CACHE_PATH, format: "string" });
  const raw = store.read(CACHE_KEY);
  store.close();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.log(`Daynest: invalid cached dashboard: ${error}`);
    return null;
  }
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
  const response = await fetch(`${apiBaseUrl}${DASHBOARD_PATH}`, {
    headers: { "X-Integration-Key": authToken },
  });
  if (!response.ok) throw new Error(`dashboard fetch failed: HTTP ${response.status}`);
  return response.json();
}

async function postAction(path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Integration-Key": authToken,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`action failed: HTTP ${response.status}`);
  return response.json();
}

async function refresh() {
  if (!authToken) {
    application.content("status").string =
      "Daynest\n\nNot configured.\nOpen Settings in the\nPebble phone app.";
    return;
  }
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

let actionInFlight = false;

async function runAction(kind) {
  if (actionInFlight) return;
  const items = lastDashboard && lastDashboard.due_today;
  if (!items || items.length === 0) return;

  const item = items[0];
  const path = kind === "complete" ? COMPLETE_TASK_PATH : SKIP_TASK_PATH;
  actionInFlight = true;
  try {
    await postAction(path, { chore_instance_id: item.chore_instance_id });
    // Drop the acted-on item locally before refreshing so a failed/slow
    // live refetch that falls back to cache can't replay the same action.
    lastDashboard = Object.assign({}, lastDashboard, {
      due_today: items.slice(1),
      due_today_count: Math.max(0, (lastDashboard.due_today_count || items.length) - 1),
    });
    saveCachedDashboard(lastDashboard);
    renderDashboard(lastDashboard, { stale: true });
    await refresh();
  } catch (e) {
    console.log(`Daynest ${kind} action failed: ${e}`);
  } finally {
    actionInFlight = false;
  }
}

const message = new Message({
  keys: ["API_BASE_URL", "AUTH_TOKEN"],
  onReadable() {
    const payload = this.read();
    const baseUrl = payload.get("API_BASE_URL");
    const token = payload.get("AUTH_TOKEN");
    if (baseUrl) {
      apiBaseUrl = baseUrl.replace(/\/$/, "");
      localStorage.setItem("apiBaseUrl", apiBaseUrl);
    }
    if (token) {
      authToken = token;
      localStorage.setItem("authToken", authToken);
    }
    refresh();
  },
});

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
