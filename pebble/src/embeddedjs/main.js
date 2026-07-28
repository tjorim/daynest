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
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_MAX_AGE_SECONDS = 12 * 60 * 60;

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
let dashboardIsLive = false;
const pad = value => (value < 10 ? `0${value}` : String(value));
let cachedSnapshot = null;
let lastDashboard = null;

function formatClock(epochSeconds) {
  const date = new Date(epochSeconds * 1000);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

cachedSnapshot = loadCachedDashboard();
lastDashboard = cachedSnapshot && cachedSnapshot.dashboard;
renderDashboard(lastDashboard, {
  staleReason: cachedSnapshot ? "Last known" : null,
  fetchedAt: cachedSnapshot && cachedSnapshot.fetchedAt,
});

function clearCachedDashboard() {
  const store = device.keyValue.open({ path: CACHE_PATH, format: "string" });
  store.delete(CACHE_KEY);
  store.close();
  cachedSnapshot = null;
  lastDashboard = null;
}

function loadCachedDashboard() {
  const store = device.keyValue.open({ path: CACHE_PATH, format: "string" });
  const raw = store.read(CACHE_KEY);
  store.close();
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw);
    const age = Math.floor(Date.now() / 1000) - snapshot.fetchedAt;
    if (
      snapshot.version !== SNAPSHOT_VERSION ||
      !snapshot.dashboard ||
      !snapshot.fetchedAt ||
      age < 0 ||
      age > SNAPSHOT_MAX_AGE_SECONDS
    ) {
      clearCachedDashboard();
      return null;
    }
    return snapshot;
  } catch (error) {
    console.log(`Daynest: invalid cached dashboard: ${error}`);
    clearCachedDashboard();
    return null;
  }
}

function saveCachedDashboard(dashboard) {
  cachedSnapshot = {
    version: SNAPSHOT_VERSION,
    fetchedAt: Math.floor(Date.now() / 1000),
    dashboard,
  };
  const store = device.keyValue.open({ path: CACHE_PATH, format: "string" });
  store.write(CACHE_KEY, JSON.stringify(cachedSnapshot));
  store.close();
}

function renderDashboard(dashboard, { staleReason = null, fetchedAt = null } = {}) {
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

  if (staleReason) {
    const when = fetchedAt ? ` · ${formatClock(fetchedAt)}` : "";
    lines.push(`\n${staleReason}${when}`);
  }

  statusText.string = lines.join("\n");
}

async function fetchDashboard() {
  const response = await fetch(`${apiBaseUrl}${DASHBOARD_PATH}`, {
    headers: { "X-Integration-Key": authToken },
  });
  if (!response.ok) throw apiError(response.status);
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
  if (!response.ok) throw apiError(response.status);
  return response.json();
}

function apiError(status) {
  const error = new Error(
    // The watch has no way to re-authenticate on its own, so a rejected token
    // has to name the phone-side fix rather than just report the failure.
    status === 401 || status === 403
      ? "Pairing expired.\nRe-pair in Settings\nin the Pebble app."
      : status === 429 || status >= 500
        ? `Try again later (${status})`
        : `Request failed (${status})`,
  );
  error.status = status;
  return error;
}

function showStale(reason) {
  dashboardIsLive = false;
  renderDashboard(lastDashboard, {
    staleReason: lastDashboard ? reason : null,
    fetchedAt: cachedSnapshot && cachedSnapshot.fetchedAt,
  });
  if (!lastDashboard) application.content("status").string = `Daynest\n\n${reason}`;
}

async function refresh() {
  if (!authToken) {
    dashboardIsLive = false;
    application.content("status").string =
      "Daynest\n\nNot configured.\nOpen Settings in the\nPebble phone app.";
    return false;
  }
  if (!watch.connected.pebblekit) {
    console.log("Daynest: proxy not ready yet, showing cache");
    showStale("Phone offline");
    return false;
  }
  const generation = identityGeneration;
  try {
    const dashboard = await fetchDashboard();
    if (generation !== identityGeneration) return false;
    lastDashboard = dashboard;
    saveCachedDashboard(dashboard);
    dashboardIsLive = true;
    renderDashboard(dashboard);
    return true;
  } catch (e) {
    if (generation !== identityGeneration) return false;
    console.log(`Daynest refresh failed: ${e}`);
    showStale(String(e.message || e));
    return false;
  }
}

let busy = false;
let identityGeneration = 0;
let refreshOwed = false;

async function runExclusive(action) {
  if (busy) return;
  busy = true;
  try {
    await action();
    while (refreshOwed) {
      refreshOwed = false;
      await refresh();
    }
  } finally {
    busy = false;
  }
}

function requestRefresh() {
  if (busy) refreshOwed = true;
  else runExclusive(refresh);
}

async function runAction(kind) {
  if (!authToken) {
    await refresh();
    return;
  }
  if (!watch.connected.pebblekit) {
    showStale("Phone offline");
    return;
  }
  const generation = identityGeneration;
  // Cached state is display-only. Re-read before selecting a task so an item
  // completed or skipped elsewhere cannot be replayed from a stale snapshot.
  if (!dashboardIsLive && !(await refresh())) return;
  if (generation !== identityGeneration) return;
  const items = lastDashboard && lastDashboard.due_today;
  if (!items || items.length === 0) return;

  const item = items[0];
  const path = kind === "complete" ? COMPLETE_TASK_PATH : SKIP_TASK_PATH;
  dashboardIsLive = false;
  try {
    await postAction(path, { chore_instance_id: item.chore_instance_id });
    if (generation !== identityGeneration) return;
    // Drop the acted-on item locally before refreshing so a failed/slow
    // live refetch that falls back to cache can't replay the same action.
    lastDashboard = Object.assign({}, lastDashboard, {
      due_today: items.slice(1),
      due_today_count: Math.max(0, (lastDashboard.due_today_count || items.length) - 1),
    });
    saveCachedDashboard(lastDashboard);
    renderDashboard(lastDashboard, {
      staleReason: "Updating",
      fetchedAt: cachedSnapshot.fetchedAt,
    });
    await refresh();
  } catch (e) {
    if (generation !== identityGeneration) return;
    console.log(`Daynest ${kind} action failed: ${e}`);
    // A conflict means server state moved under us. Resolve by reading; never
    // retry a mutation whose outcome is uncertain.
    if (e.status === 409) await refresh();
    else showStale(String(e.message || e));
  }
}

const message = new Message({
  keys: ["API_BASE_URL", "AUTH_TOKEN"],
  onReadable() {
    const payload = this.read();
    const baseUrl = payload.get("API_BASE_URL");
    const token = payload.get("AUTH_TOKEN");
    const nextBaseUrl = baseUrl ? baseUrl.replace(/\/$/, "") : apiBaseUrl;
    if (nextBaseUrl !== apiBaseUrl || (token && token !== authToken)) {
      identityGeneration += 1;
      clearCachedDashboard();
      dashboardIsLive = false;
    }
    if (baseUrl) {
      apiBaseUrl = nextBaseUrl;
      localStorage.setItem("apiBaseUrl", apiBaseUrl);
    }
    if (token) {
      authToken = token;
      localStorage.setItem("authToken", authToken);
    }
    requestRefresh();
  },
});

watch.addEventListener("connected", requestRefresh);
requestRefresh();

new Button({
  types: ["up", "select", "down"],
  onPush(down, type) {
    if (!down) return;
    if (type === "up") runExclusive(refresh);
    else if (type === "select") runExclusive(() => runAction("complete"));
    else if (type === "down") runExclusive(() => runAction("skip"));
  },
});
