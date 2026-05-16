import { afterEach, describe, expect, it } from "vitest";
import { getOidcAccessToken, setOidcAccessToken } from "@/lib/auth/session";

afterEach(() => {
  setOidcAccessToken(undefined);
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
