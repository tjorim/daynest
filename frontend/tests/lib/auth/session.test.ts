// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clearStoredTokens, getStoredTokens, storeTokens } from "@/lib/auth/session";

afterEach(() => {
  localStorage.clear();
});

describe("getStoredTokens", () => {
  it("returns null when no tokens are stored", () => {
    expect(getStoredTokens()).toBeNull();
  });

  it("returns null when only accessToken is stored", () => {
    localStorage.setItem("daynest.accessToken", "token-a");
    expect(getStoredTokens()).toBeNull();
  });

  it("returns null when only refreshToken is stored", () => {
    localStorage.setItem("daynest.refreshToken", "token-r");
    expect(getStoredTokens()).toBeNull();
  });

  it("returns tokens when both are stored", () => {
    localStorage.setItem("daynest.accessToken", "acc");
    localStorage.setItem("daynest.refreshToken", "ref");
    expect(getStoredTokens()).toEqual({ accessToken: "acc", refreshToken: "ref" });
  });
});

describe("storeTokens", () => {
  it("persists accessToken and refreshToken in localStorage", () => {
    storeTokens({ accessToken: "a", refreshToken: "r" });
    expect(localStorage.getItem("daynest.accessToken")).toBe("a");
    expect(localStorage.getItem("daynest.refreshToken")).toBe("r");
  });
});

describe("clearStoredTokens", () => {
  it("removes both tokens from localStorage", () => {
    localStorage.setItem("daynest.accessToken", "a");
    localStorage.setItem("daynest.refreshToken", "r");
    clearStoredTokens();
    expect(localStorage.getItem("daynest.accessToken")).toBeNull();
    expect(localStorage.getItem("daynest.refreshToken")).toBeNull();
  });
});
