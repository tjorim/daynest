import { getOidcAccessToken } from "@/lib/auth/session";

const QUEUE_KEY = "daynest-offline-queue";

interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  body?: string;
  contentType?: string;
}

function loadQueue(): QueuedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedMutation[];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMutation[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(url: string, init: RequestInit): void {
  const queue = loadQueue();
  const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers ?? {});
  queue.push({
    id: crypto.randomUUID(),
    url,
    method: init.method ?? "POST",
    body: typeof init.body === "string" ? init.body : undefined,
    contentType: headers.get("Content-Type") ?? undefined,
  });
  saveQueue(queue);
}

export function getQueuedCount(): number {
  return loadQueue().length;
}

export async function drain(): Promise<number> {
  const queue = loadQueue();
  if (queue.length === 0) return 0;

  const token = getOidcAccessToken();
  if (!token) return 0;

  let replayed = 0;
  const remaining: QueuedMutation[] = [];
  for (const entry of queue) {
    try {
      const headers = new Headers({
        "Content-Type": entry.contentType ?? "application/json",
        Authorization: `Bearer ${token}`,
      });
      const response = await fetch(entry.url, {
        method: entry.method,
        headers,
        body: entry.body,
      });
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        replayed++;
      } else {
        remaining.push(entry);
      }
    } catch {
      remaining.push(entry);
    }
  }
  saveQueue(remaining);
  return replayed;
}
