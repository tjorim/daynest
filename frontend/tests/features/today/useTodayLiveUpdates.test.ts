import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTodayLiveUpdates } from "@/features/today/useTodayLiveUpdates";
import { queryKeys } from "@/lib/query/queryKeys";
import * as session from "@/lib/auth/session";
import { createQueryTestClient } from "../../utils/queryTestProvider";

type EventHandler = (event: MessageEvent) => void;

class MockEventSource {
  private readonly handlers: Record<string, EventHandler[]> = {};
  public closed = false;

  constructor(public readonly url: string) {}

  addEventListener(type: string, handler: EventHandler): void {
    this.handlers[type] ??= [];
    this.handlers[type].push(handler);
  }

  emit(type: string, data: string): void {
    for (const handler of this.handlers[type] ?? []) {
      handler(new MessageEvent(type, { data }));
    }
  }

  close(): void {
    this.closed = true;
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: createQueryTestClient() }, children);
}

describe("useTodayLiveUpdates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("invalidates the today query when today_updated event fires", async () => {
    let capturedEs: MockEventSource | undefined;
    vi.stubGlobal(
      "EventSource",
      class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEs = this;
        }
      },
    );
    vi.spyOn(session, "getOidcAccessToken").mockReturnValue("test-token");

    const queryClient = createQueryTestClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useTodayLiveUpdates(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children),
    });

    expect(capturedEs).toBeDefined();

    await act(async () => {
      capturedEs!.emit("today_updated", "{}");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.today.read() });
  });

  it("does not open EventSource when there is no access token", () => {
    const constructorSpy = vi.fn();
    vi.stubGlobal("EventSource", constructorSpy);
    vi.spyOn(session, "getOidcAccessToken").mockReturnValue(undefined);

    renderHook(() => useTodayLiveUpdates(), { wrapper });

    expect(constructorSpy).not.toHaveBeenCalled();
  });

  it("closes EventSource on unmount", () => {
    let capturedEs: MockEventSource | undefined;
    vi.stubGlobal(
      "EventSource",
      class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEs = this;
        }
      },
    );
    vi.spyOn(session, "getOidcAccessToken").mockReturnValue("test-token");

    const { unmount } = renderHook(() => useTodayLiveUpdates(), { wrapper });

    unmount();

    expect(capturedEs?.closed).toBe(true);
  });

  it("invalidates the today query on reconnect but not on initial connect", async () => {
    let capturedEs: MockEventSource | undefined;
    vi.stubGlobal(
      "EventSource",
      class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEs = this;
        }
      },
    );
    vi.spyOn(session, "getOidcAccessToken").mockReturnValue("test-token");

    const queryClient = createQueryTestClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useTodayLiveUpdates(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children),
    });

    // Initial connect — should NOT invalidate.
    await act(async () => {
      capturedEs!.emit("open", "");
    });
    expect(invalidateSpy).not.toHaveBeenCalled();

    // Reconnect — should invalidate to recover missed events.
    await act(async () => {
      capturedEs!.emit("open", "");
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.today.read() });
  });

  it("closes the old connection and opens a new one when the token changes", () => {
    const instances: MockEventSource[] = [];
    vi.stubGlobal(
      "EventSource",
      class extends MockEventSource {
        constructor(url: string) {
          super(url);
          instances.push(this);
        }
      },
    );
    const tokenSpy = vi.spyOn(session, "getOidcAccessToken").mockReturnValue("token-a");

    const { rerender } = renderHook(() => useTodayLiveUpdates(), { wrapper });
    expect(instances).toHaveLength(1);
    const first = instances[0]!;
    expect(first.url).toContain("token=token-a");

    tokenSpy.mockReturnValue("token-b");
    rerender();

    expect(first.closed).toBe(true);
    expect(instances).toHaveLength(2);
    expect(instances[1]!.url).toContain("token=token-b");
  });

  it("opens EventSource with the token in the URL", () => {
    let capturedEs: MockEventSource | undefined;
    vi.stubGlobal(
      "EventSource",
      class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEs = this;
        }
      },
    );
    vi.spyOn(session, "getOidcAccessToken").mockReturnValue("my-token");

    renderHook(() => useTodayLiveUpdates(), { wrapper });

    expect(capturedEs?.url).toContain("/api/v1/today/stream");
    expect(capturedEs?.url).toContain("token=my-token");
  });
});
