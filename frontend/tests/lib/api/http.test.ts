import { afterEach, describe, expect, it, vi } from "vitest";

const sessionMock = vi.hoisted(() => ({
  getOidcAccessToken: vi.fn(() => "test-token"),
  renewOidcAccessToken: vi.fn(async () => null as string | null),
}));

vi.mock("@/lib/auth/session", () => sessionMock);

import { fetchWithAuth } from "@/lib/api/http";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionMock.getOidcAccessToken.mockReturnValue("test-token");
  sessionMock.renewOidcAccessToken.mockResolvedValue(null);
});

describe("fetchWithAuth 401 recovery", () => {
  it("returns the response unchanged when not a 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));

    const response = await fetchWithAuth("/api/today");

    expect(response.status).toBe(200);
    expect(sessionMock.renewOidcAccessToken).not.toHaveBeenCalled();
  });

  it("retries once with a fresh token after a successful silent renewal", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return calls === 1 ? new Response(null, { status: 401 }) : new Response(null, { status: 200 });
      }),
    );
    sessionMock.renewOidcAccessToken.mockResolvedValue("renewed-token");

    const response = await fetchWithAuth("/api/today");

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
    expect(sessionMock.renewOidcAccessToken).toHaveBeenCalledOnce();
    const secondCallHeaders = new Headers(vi.mocked(fetch).mock.calls[1]?.[1]?.headers);
    expect(secondCallHeaders.get("Authorization")).toBe("Bearer renewed-token");
  });

  it("returns the original 401 response when renewal fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    sessionMock.renewOidcAccessToken.mockResolvedValue(null);

    const response = await fetchWithAuth("/api/today");

    expect(response.status).toBe(401);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });
});
