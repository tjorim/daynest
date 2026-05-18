// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/app/providers/AuthProvider";

const authMock = vi.hoisted(() => ({
  oidc: {
    user: undefined,
    isLoading: false,
    isAuthenticated: false,
    signinRedirect: vi.fn(),
    signoutRedirect: vi.fn(),
  },
}));

vi.mock("react-oidc-context", () => ({
  useAuth: () => authMock.oidc,
}));

vi.mock("@/lib/api/auth", () => ({
  fetchMe: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  setOidcAccessToken: vi.fn(),
}));

function LoginButton() {
  const { login } = useAuth();
  return <button onClick={login}>Sign in</button>;
}

describe("AuthProvider login returnTo", () => {
  beforeEach(() => {
    authMock.oidc.signinRedirect.mockReset();
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
