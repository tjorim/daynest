// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setOfflineOwner, setOidcAccessToken } from "@/lib/auth/session";
import { AuthProvider, useAuth } from "@/app/providers/AuthProvider";

const authMock = vi.hoisted(() => ({
  oidc: {
    user: undefined as { access_token: string; profile: { sub: string } } | undefined,
    settings: { authority: "https://idp.test", client_id: "daynest" },
    isLoading: false,
    isAuthenticated: false,
    signinRedirect: vi.fn(),
    signoutRedirect: vi.fn(),
    signinSilent: vi.fn(),
    error: undefined as unknown,
  },
}));

vi.mock("react-oidc-context", () => ({
  useAuth: () => authMock.oidc,
}));

vi.mock("@/lib/api/auth", () => ({
  fetchMe: vi.fn(async () => null),
}));

vi.mock("@/lib/auth/session", () => ({
  setOidcAccessToken: vi.fn(),
  setOfflineOwner: vi.fn(),
  setSigninSilent: vi.fn(),
}));

function LoginButton() {
  const { login } = useAuth();
  return <button onClick={login}>Sign in</button>;
}

function OidcErrorMessage() {
  const { oidcError } = useAuth();
  return <div>{oidcError}</div>;
}

describe("AuthProvider login returnTo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.oidc.user = undefined;
    authMock.oidc.isAuthenticated = false;
    authMock.oidc.signinRedirect.mockReset();
    authMock.oidc.error = undefined;
  });

  it("scopes offline actions and fences a cross-tab session change", () => {
    authMock.oidc.user = { access_token: "alice-token", profile: { sub: "alice" } };
    authMock.oidc.isAuthenticated = true;
    render(
      <AuthProvider>
        <LoginButton />
      </AuthProvider>,
    );
    expect(setOfflineOwner).toHaveBeenLastCalledWith(
      JSON.stringify(["https://idp.test", "daynest", "alice"]),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: "oidc.user:https://idp.test:daynest", newValue: null }),
    );
    expect(setOfflineOwner).toHaveBeenLastCalledWith(undefined);
    expect(setOidcAccessToken).toHaveBeenLastCalledWith(undefined);
  });

  it("uses /today when login starts on /auth", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/auth");

    render(
      <AuthProvider>
        <LoginButton />
      </AuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(authMock.oidc.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/today" },
    });
  });

  it("falls back to the OIDC error string when message is empty", () => {
    authMock.oidc.error = { message: "", toString: () => "State mismatch" };

    render(
      <AuthProvider>
        <OidcErrorMessage />
      </AuthProvider>,
    );

    expect(screen.getByText("State mismatch")).toBeInTheDocument();
  });

  it("preserves path, search, and hash for app routes", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/calendar?view=month#event-123");

    render(
      <AuthProvider>
        <LoginButton />
      </AuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(authMock.oidc.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/calendar?view=month#event-123" },
    });
  });
});
