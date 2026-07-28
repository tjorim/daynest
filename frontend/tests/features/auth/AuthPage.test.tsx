// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../utils/router";

const authMock = vi.hoisted(() => ({
  loginStub: vi.fn(),
  logoutStub: vi.fn(),
  refreshUserStub: vi.fn(),
  oidcError: null as string | null,
  isAccountRejected: false,
}));

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    login: authMock.loginStub,
    logout: authMock.logoutStub,
    refreshUser: authMock.refreshUserStub,
    sessionError: null,
    oidcError: authMock.oidcError,
    isAccountRejected: authMock.isAccountRejected,
    user: null,
  }),
}));

function renderAuthPage() {
  return renderWithRouter({
    path: "/auth",
    auth: { isAuthenticated: false, isLoading: false },
  });
}

describe("AuthPage", () => {
  beforeEach(() => {
    authMock.loginStub.mockReset();
    authMock.logoutStub.mockReset();
    authMock.refreshUserStub.mockReset();
    authMock.oidcError = null;
    authMock.isAccountRejected = false;
  });

  it("renders the sign-in heading", async () => {
    renderAuthPage();
    expect(await screen.findByRole("heading", { name: /sign in to daynest/i })).toBeInTheDocument();
  });

  it("renders the sign-in button", async () => {
    renderAuthPage();
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("does not render email or password inputs", () => {
    const { container } = renderAuthPage();
    expect(container.querySelector('input[type="email"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).not.toBeInTheDocument();
  });

  it("renders an OIDC error when sign-in fails after redirect", async () => {
    authMock.oidcError = "State mismatch";

    renderAuthPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/sign-in failed/i);
    expect(screen.getByText("State mismatch")).toBeInTheDocument();
  });

  it("calls login() when the sign-in button is clicked", async () => {
    const user = userEvent.setup();
    renderAuthPage();

    await user.click(await screen.findByRole("button", { name: /sign in/i }));

    expect(authMock.loginStub).toHaveBeenCalledOnce();
  });

  it("does not start a second authorization request on a double click", async () => {
    const user = userEvent.setup();
    renderAuthPage();

    const button = await screen.findByRole("button", { name: /sign in/i });
    await user.dblClick(button);

    expect(authMock.loginStub).toHaveBeenCalledOnce();
  });

  it("offers sign-out instead of sign-in when the login has no Daynest account", async () => {
    authMock.isAccountRejected = true;

    const user = userEvent.setup();
    renderAuthPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no daynest account/i);
    // Signing in again would silently return here, so it must not be offered.
    expect(screen.queryByRole("button", { name: /^sign in$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(authMock.logoutStub).toHaveBeenCalledOnce();
  });
});
