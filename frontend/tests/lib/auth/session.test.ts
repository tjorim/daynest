import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOidcAccessToken,
  renewOidcAccessToken,
  setOidcAccessToken,
  setSigninSilent,
} from "@/lib/auth/session";

afterEach(() => {
  setOidcAccessToken(undefined);
  setSigninSilent(undefined);
});

describe("setOidcAccessToken / getOidcAccessToken", () => {
  it("returns undefined when no token has been set", () => {
    expect(getOidcAccessToken()).toBeUndefined();
  });

  it("returns the token after it is set", () => {
    setOidcAccessToken("my-token");
    expect(getOidcAccessToken()).toBe("my-token");
  });

  it("clears the token when set to undefined", () => {
    setOidcAccessToken("my-token");
    setOidcAccessToken(undefined);
    expect(getOidcAccessToken()).toBeUndefined();
  });

  it("returns the most recently set token", () => {
    setOidcAccessToken("first");
    setOidcAccessToken("second");
    expect(getOidcAccessToken()).toBe("second");
  });
});

describe("renewOidcAccessToken", () => {
  it("resolves null when no signinSilent has been registered", async () => {
    expect(await renewOidcAccessToken()).toBeNull();
  });

  it("resolves the renewed access token on success", async () => {
    setSigninSilent(vi.fn().mockResolvedValue({ access_token: "renewed-token" }));
    expect(await renewOidcAccessToken()).toBe("renewed-token");
  });

  it("resolves null when signinSilent resolves null", async () => {
    setSigninSilent(vi.fn().mockResolvedValue(null));
    expect(await renewOidcAccessToken()).toBeNull();
  });

  it("resolves null when signinSilent throws", async () => {
    setSigninSilent(vi.fn().mockRejectedValue(new Error("login_required")));
    expect(await renewOidcAccessToken()).toBeNull();
  });
});
