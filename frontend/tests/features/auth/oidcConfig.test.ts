// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { oidcConfig } from "@/config/oidc";

describe("oidcConfig.onSigninCallback", () => {
  it("replaces auth return paths with /today and dispatches popstate", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    const popstateListener = vi.fn();
    window.addEventListener("popstate", popstateListener);

    oidcConfig.onSigninCallback?.({ state: { returnTo: "/auth" } } as never);

    expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, "/today");
    expect(popstateListener).toHaveBeenCalledTimes(1);

    window.removeEventListener("popstate", popstateListener);
  });

  it("keeps safe non-auth return paths", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    oidcConfig.onSigninCallback?.({ state: { returnTo: "/calendar?view=month#2026-05" } } as never);

    expect(replaceStateSpy).toHaveBeenCalledWith(
      {},
      document.title,
      "/calendar?view=month#2026-05",
    );
  });

  it("falls back to /today for invalid return paths", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    oidcConfig.onSigninCallback?.({ state: { returnTo: "https://evil.example" } } as never);

    expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, "/today");
  });
});
