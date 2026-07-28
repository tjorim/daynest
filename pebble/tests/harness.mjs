import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

const MAIN_PATH = resolve(import.meta.dirname, "../src/embeddedjs/main.js");
const pause = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

function stripImports(source) {
  return source.replace(/^import .*;\s*$/gm, "");
}

export const DASHBOARD_PATH = "/api/integrations/pebble/dashboard";
export const COMPLETE_PATH = "/api/integrations/pebble/actions/complete-task";
export const SKIP_PATH = "/api/integrations/pebble/actions/skip-task";

export function dashboard(firstId = 101) {
  return {
    due_today_count: 2,
    overdue_count: 1,
    due_today: [
      { chore_instance_id: firstId, title: `Task ${firstId}`, status: "pending" },
      { chore_instance_id: firstId + 1, title: `Task ${firstId + 1}`, status: "pending" },
    ],
  };
}

export function snapshot(value, ageSeconds = 0) {
  return JSON.stringify({
    version: 1,
    fetchedAt: Math.floor(Date.now() / 1000) - ageSeconds,
    dashboard: value,
  });
}

export function createHarness({
  connected = true,
  storage = {},
  cachedDashboard = null,
  responder = () => ({ status: 200, body: dashboard() }),
} = {}) {
  const localStore = new Map(Object.entries(storage));
  const keyValueStore = new Map();
  if (cachedDashboard) keyValueStore.set("dashboard", cachedDashboard);
  const requests = [];
  const listeners = new Map();
  const inFlight = new Set();
  const hooks = {};
  let respond = responder;

  class Button {
    constructor(spec) {
      hooks.onPush = spec.onPush;
    }
  }

  class Message {
    constructor(spec) {
      this.onReadable = spec.onReadable;
      hooks.message = this;
    }
  }

  const Application = {
    template(build) {
      return class FakeApplication {
        constructor(_parent, data) {
          const spec = build(data);
          this.status = spec.contents[0];
          hooks.application = this;
        }
        content(name) {
          return name === "status" ? this.status : null;
        }
      };
    },
  };

  const context = createContext({
    Application,
    Button,
    Message,
    Skin: class Skin {},
    Style: class Style {},
    Text: (_data, spec) => ({ ...spec }),
    console,
    device: {
      keyValue: {
        open: () => ({
          read: (key) => keyValueStore.get(key),
          write: (key, value) => keyValueStore.set(key, String(value)),
          delete: (key) => keyValueStore.delete(key),
          close: () => {},
        }),
      },
    },
    localStorage: {
      getItem: (key) => (localStore.has(key) ? localStore.get(key) : null),
      setItem: (key, value) => localStore.set(key, String(value)),
    },
    watch: {
      connected: { pebblekit: connected },
      addEventListener: (type, handler) => listeners.set(type, handler),
    },
    fetch: (url, options = {}) => {
      requests.push({
        url,
        method: options.method || "GET",
        headers: options.headers,
        body: options.body,
      });
      const work = (async () => {
        const { status, body } = await respond(url, options);
        return {
          status,
          ok: status >= 200 && status < 300,
          json: async () => body,
        };
      })();
      inFlight.add(work);
      const forget = () => inFlight.delete(work);
      work.then(forget, forget);
      return work;
    },
  });

  runInContext(stripImports(readFileSync(MAIN_PATH, "utf8")), context, {
    filename: "main.js",
  });

  async function settle(timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (inFlight.size) {
        await Promise.race([Promise.allSettled([...inFlight]), pause(5)]);
      }
      for (let index = 0; index < 20; index += 1) await Promise.resolve();
      await pause(0);
      if (!inFlight.size) return;
      if (Date.now() > deadline) throw new Error("watch app did not settle");
    }
  }

  return {
    requests,
    get status() {
      return hooks.application.status.string;
    },
    get cachedDashboard() {
      return keyValueStore.get("dashboard");
    },
    get stored() {
      return Object.fromEntries(localStore);
    },
    setConnected(value) {
      context.watch.connected.pebblekit = value;
    },
    setResponder(handler) {
      respond = handler;
    },
    async settle() {
      await settle();
    },
    async press(type, wait = true) {
      hooks.onPush(true, type);
      if (wait) await settle();
    },
    async reconnect() {
      context.watch.connected.pebblekit = true;
      listeners.get("connected")?.();
      await settle();
    },
    async configure(payload) {
      const message = new Map(Object.entries(payload));
      hooks.message.read = () => message;
      hooks.message.onReadable.call(hooks.message);
      await settle();
    },
    emit(type) {
      listeners.get(type)?.();
    },
  };
}
