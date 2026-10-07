import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { enqueue, drain, getQueuedCount, hasLegacyQueue } from "@/lib/offlineQueue";
import { setOfflineOwner, setOidcAccessToken } from "@/lib/auth/session";
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("window", { location: { origin: "https://daynest.test" }, dispatchEvent: vi.fn() });
  let tail = Promise.resolve();
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, fn: () => Promise<number>) => {
        const next = tail.then(fn);
        tail = next.then(() => undefined);
        return next;
      },
    },
  });
  setOfflineOwner("alice");
  setOidcAccessToken("alice-token");
});
afterEach(() => {
  setOfflineOwner(undefined);
  setOidcAccessToken(undefined);
  vi.unstubAllGlobals();
});
const save = (id = 1) =>
  enqueue(`https://daynest.test/api/tasks/${id}/complete`, { method: "POST" });
it("retains pending actions for the original account across sign-out", async () => {
  expect(save()).toBe(true);
  setOfflineOwner("bob");
  setOidcAccessToken("bob-token");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(getQueuedCount()).toBe(0);
  expect(await drain()).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
  setOfflineOwner("alice");
  setOidcAccessToken("alice-new-token");
  fetcher.mockResolvedValue(new Response(null, { status: 200 }));
  expect(await drain()).toBe(1);
  expect(fetcher.mock.calls[0]?.[1]?.headers.Authorization).toBe("Bearer alice-new-token");
});
it("never queues creates, relative actions or foreign endpoints", () => {
  for (const url of [
    "/api/planned-items",
    "/api/planned-items/1/defer",
    "https://evil.test/api/tasks/1/complete",
  ])
    expect(enqueue(url, { method: "POST" })).toBe(false);
});
it.each([401, 409, 429, 500])("retains failed actions after %s", async (status) => {
  save();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status })),
  );
  expect(await drain()).toBe(0);
  expect(getQueuedCount()).toBe(1);
});
it("stops replay at an account boundary and keeps concurrent enqueues", async () => {
  save(1);
  save(2);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      save(3);
      setOfflineOwner("bob");
      return new Response(null, { status: 200 });
    }),
  );
  expect(await drain()).toBe(1);
  expect(fetch).toHaveBeenCalledOnce();
  setOfflineOwner("alice");
  expect(getQueuedCount()).toBe(2);
});
it("serializes overlapping drains", async () => {
  save();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 200 })),
  );
  expect(await Promise.all([drain(), drain()])).toEqual([1, 0]);
  expect(fetch).toHaveBeenCalledOnce();
});
it("preserves the unowned legacy queue without executing it", async () => {
  localStorage.setItem("daynest-offline-queue", '[{"url":"/api/tasks/1/complete"}]');
  expect(hasLegacyQueue()).toBe(true);
  expect(await drain()).toBe(0);
  expect(localStorage.getItem("daynest-offline-queue")).not.toBeNull();
});
it("does not claim to save when storage fails", () => {
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  expect(save()).toBe(false);
});
