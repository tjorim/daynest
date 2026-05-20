// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { onSigninCallback } from "@/config/oidc";

describe("onSigninCallback", () => {
  it("replaces auth return paths with /today and dispatches popstate", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    const popstateListener = vi.fn();
    window.addEventListener("popstate", popstateListener);

    onSigninCallback({ state: { returnTo: "/auth" } });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, "/today");
    expect(popstateListener).toHaveBeenCalledTimes(1);

    window.removeEventListener("popstate", popstateListener);
  });

  it("keeps safe non-auth return paths", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    onSigninCallback({ state: { returnTo: "/calendar?view=month#2026-05" } });

    expect(replaceStateSpy).toHaveBeenCalledWith(
      {},
      document.title,
      "/calendar?view=month#2026-05",
    );
  });

  it("falls back to /today for invalid return paths", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    onSigninCallback({ state: { returnTo: "https://evil.example" } });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, "/today");
  });
});
