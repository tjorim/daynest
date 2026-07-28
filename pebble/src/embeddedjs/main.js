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

// Watch-side copy. The watch has no locale of its own, so the phone sends one
// with the pairing message; anything unknown falls back to English.
const STRINGS = {
  en: {
    loading: "Loading…",
    waiting: "No data yet.\nWaiting for phone…",
    today: "DAYNEST · TODAY",
    counts: (due, overdue) => `${due} due · ${overdue} late`,
    nothingDue: "Nothing due. Nice!",
    hint: "SELECT done · DOWN skip",
    notConfigured: "Not configured.\nOpen Settings in the\nPebble phone app.",
    phoneOffline: "Phone offline",
    lastKnown: "Last known",
    updating: "Updating",
    pairingExpired: "Pairing expired.\nRe-pair in Settings\nin the Pebble app.",
    tryAgainLater: status => `Try again later (${status})`,
    requestFailed: status => `Request failed (${status})`,
  },
  nl: {
    loading: "Laden…",
    waiting: "Nog geen gegevens.\nWachten op telefoon…",
    today: "DAYNEST · VANDAAG",
    counts: (due, overdue) => `${due} te doen · ${overdue} te laat`,
    nothingDue: "Niets te doen. Mooi!",
    hint: "SELECT klaar · DOWN over",
    notConfigured: "Niet ingesteld.\nOpen Instellingen in\nde Pebble-app.",
    phoneOffline: "Telefoon offline",
    lastKnown: "Laatst bekend",
    updating: "Bijwerken",
    pairingExpired: "Koppeling verlopen.\nKoppel opnieuw via\nInstellingen.",
    tryAgainLater: status => `Probeer later opnieuw (${status})`,
    requestFailed: status => `Verzoek mislukt (${status})`,
  },
};

function stringsFor(locale) {
  if (!locale) return STRINGS.en;
  return STRINGS[String(locale).slice(0, 2).toLowerCase()] || STRINGS.en;
}

let t = stringsFor(localStorage.getItem("locale"));

// Piu resolves `font` through PebbleOS's built-in font table, so only the
// system families/sizes are available (Gothic 9/14/18/24/28/36, Bitham,
// Roboto, Droid Serif, Leco — regular or bold). An unknown family throws an
// uncaught "font not found" URIError that kills the app at startup. Only the
// documented Gothic sizes are used below, so hierarchy comes from size and
// layout rather than from weights that may not resolve on every platform.
const backgroundSkin = new Skin({ fill: "black" });
const headerStyle = new Style({ font: "9px Gothic", color: "white", horizontal: "center", vertical: "middle" });
const countsStyle = new Style({ font: "24px Gothic", color: "white", horizontal: "center", vertical: "middle" });
const itemsStyle = new Style({ font: "14px Gothic", color: "white", horizontal: "left", vertical: "top" });
const footerStyle = new Style({ font: "9px Gothic", color: "white", horizontal: "center", vertical: "bottom" });

const DaynestApplication = Application.template($ => ({
  skin: backgroundSkin,
  contents: [
    Column($, {
      left: 4, right: 4, top: 4, bottom: 4,
      contents: [
        Text($, { name: "header", left: 0, right: 0, height: 12, style: headerStyle, string: "" }),
        Text($, { name: "counts", left: 0, right: 0, height: 28, style: countsStyle, string: "" }),
        Text($, { name: "items", left: 0, right: 0, style: itemsStyle, string: t.loading }),
        Text($, { name: "footer", left: 0, right: 0, height: 12, style: footerStyle, string: "" }),
      ],
    }),
  ],
}));

const application = new DaynestApplication(null, { displayListLength: 4096 });

function setSection(name, value) {
  application.content(name).string = value;
}

let apiBaseUrl = localStorage.getItem("apiBaseUrl") || DEFAULT_API_BASE_URL;
let authToken = localStorage.getItem("authToken");
let dashboardIsLive = false;
// The controls hint is onboarding, not chrome: it occupies the one footer line
// on a four-line screen, so it retires once the user has used a button.
let hintSeen = localStorage.getItem("hintSeen") === "1";
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
  staleReason: cachedSnapshot ? t.lastKnown : null,
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

/** Renders a full-screen message with no dashboard behind it. */
function renderMessage(text) {
  setSection("header", t.today);
  setSection("counts", "");
  setSection("items", text);
  setSection("footer", "");
}

function renderDashboard(dashboard, { staleReason = null, fetchedAt = null } = {}) {
  if (!dashboard) {
    renderMessage(t.waiting);
    return;
  }

  setSection("header", t.today);
  setSection("counts", t.counts(dashboard.due_today_count, dashboard.overdue_count));

  const items = (dashboard.due_today || []).slice(0, 4);
  setSection(
    "items",
    items.length === 0 ? t.nothingDue : items.map(item => `• ${item.title}`).join("\n"),
  );

  // The footer is one line, and a stale marker matters more than a hint the
  // user has already acted on at least once.
  if (staleReason) {
    const when = fetchedAt ? ` · ${formatClock(fetchedAt)}` : "";
    setSection("footer", `${staleReason}${when}`);
  } else {
    setSection("footer", items.length > 0 && !hintSeen ? t.hint : "");
  }
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
      ? t.pairingExpired
      : status === 429 || status >= 500
        ? t.tryAgainLater(status)
        : t.requestFailed(status),
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
  if (!lastDashboard) renderMessage(reason);
}

async function refresh() {
  if (!authToken) {
    dashboardIsLive = false;
    renderMessage(t.notConfigured);
    return false;
  }
  if (!watch.connected.pebblekit) {
    console.log("Daynest: proxy not ready yet, showing cache");
    showStale(t.phoneOffline);
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
    showStale(t.phoneOffline);
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
    if (!hintSeen) {
      hintSeen = true;
      localStorage.setItem("hintSeen", "1");
    }
    // Drop the acted-on item locally before refreshing so a failed/slow
    // live refetch that falls back to cache can't replay the same action.
    lastDashboard = Object.assign({}, lastDashboard, {
      due_today: items.slice(1),
      due_today_count: Math.max(0, (lastDashboard.due_today_count || items.length) - 1),
    });
    saveCachedDashboard(lastDashboard);
    renderDashboard(lastDashboard, {
      staleReason: t.updating,
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
  keys: ["API_BASE_URL", "AUTH_TOKEN", "LOCALE"],
  onReadable() {
    const payload = this.read();
    const baseUrl = payload.get("API_BASE_URL");
    const token = payload.get("AUTH_TOKEN");
    const locale = payload.get("LOCALE");
    if (locale) {
      t = stringsFor(locale);
      localStorage.setItem("locale", locale);
    }
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
