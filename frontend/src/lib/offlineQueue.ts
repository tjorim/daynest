import { getOfflineSession } from "@/lib/auth/session";
import { buildApiUrl } from "@/lib/api/serverConfig";
import { z } from "zod";

// One record per action prevents a draining tab from overwriting a newly queued action.
const PREFIX = "daynest-offline-action-v1:";
const entrySchema = z.object({
  version: z.literal(1),
  owner: z.string(),
  id: z.string(),
  url: z.string(),
  method: z.literal("POST"),
  body: z.string().optional(),
  contentType: z.string().optional(),
});

/** Only documented, absolute resource-state transitions are replayable. */
export function isOfflineReplaySafe(url: string, method: string): boolean {
  try {
    const target = new URL(url, window.location.origin);
    const api = new URL(buildApiUrl("/api/"), window.location.origin);
    if (
      target.origin !== api.origin ||
      target.search ||
      target.hash ||
      method.toUpperCase() !== "POST"
    )
      return false;
    return /^\/api\/(?:tasks\/\d+\/(?:start|complete|skip)|chores\/\d+\/(?:complete|skip)|medication-doses\/\d+\/(?:take|skip|miss))$/.test(
      target.pathname,
    );
  } catch {
    return false;
  }
}

function entries(owner: string) {
  const result: { key: string; entry: z.infer<typeof entrySchema> }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const parsed = entrySchema.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
      if (
        parsed.success &&
        parsed.data.owner === owner &&
        isOfflineReplaySafe(parsed.data.url, parsed.data.method)
      ) {
        result.push({ key, entry: parsed.data });
      }
    }
  } catch {
    /* Unavailable or incompatible storage never becomes an executable queue. */
  }
  return result;
}

export function enqueue(url: string, init: RequestInit): boolean {
  const { owner, token } = getOfflineSession();
  const method = (init.method ?? "POST").toUpperCase();
  if (
    !owner ||
    !token ||
    !isOfflineReplaySafe(url, method) ||
    (init.body != null && typeof init.body !== "string")
  )
    return false;
  const headers = new Headers(init.headers);
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(
      PREFIX + id,
      JSON.stringify({
        version: 1,
        owner,
        id,
        url,
        method,
        body: init.body ?? undefined,
        contentType: headers.get("Content-Type") ?? undefined,
      }),
    );
    window.dispatchEvent(new Event("daynest-queue-changed"));
    return true;
  } catch {
    return false;
  }
}

export function hasLegacyQueue(): boolean {
  try {
    const raw = localStorage.getItem("daynest-offline-queue");
    return raw !== null && raw !== "[]";
  } catch {
    return false;
  }
}

export function getQueuedCount(): number {
  const { owner } = getOfflineSession();
  return owner ? entries(owner).length : 0;
}

export async function drain(): Promise<number> {
  const initial = getOfflineSession();
  // A browser without Web Locks can save actions, but cannot safely coordinate replay across tabs.
  if (!initial.owner || !initial.token || !navigator.locks) return 0;
  return navigator.locks.request("daynest-offline-replay", async () => {
    let replayed = 0;
    for (const { key, entry } of entries(initial.owner!)) {
      const session = getOfflineSession();
      if (
        session.owner !== initial.owner ||
        session.generation !== initial.generation ||
        !session.token
      )
        break;
      try {
        const response = await fetch(entry.url, {
          method: entry.method,
          body: entry.body,
          headers: {
            "Content-Type": entry.contentType ?? "application/json",
            Authorization: `Bearer ${session.token}`,
          },
        });
        if (!response.ok) break; // Retain authentication, conflict, rate-limit and server failures for review/retry.
        localStorage.removeItem(key);
        replayed++;
      } catch {
        break;
      }
    }
    return replayed;
  });
}
