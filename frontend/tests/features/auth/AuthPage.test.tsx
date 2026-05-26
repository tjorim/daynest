// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../utils/router";

const authMock = vi.hoisted(() => ({
  loginStub: vi.fn(),
  logoutStub: vi.fn(),
  refreshUserStub: vi.fn(),
}));

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    login: authMock.loginStub,
    logout: authMock.logoutStub,
    refreshUser: authMock.refreshUserStub,
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
  });

  it("renders the sign-in heading", () => {
    renderAuthPage();
    expect(screen.getByRole("heading", { name: /sign in to daynest/i })).toBeInTheDocument();
  });

  it("renders the sign-in button", () => {
    renderAuthPage();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("does not render email or password inputs", () => {
    const { container } = renderAuthPage();
    expect(container.querySelector('input[type="email"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).not.toBeInTheDocument();
  });

  it("calls login() when the sign-in button is clicked", async () => {
    const user = userEvent.setup();
    renderAuthPage();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(authMock.loginStub).toHaveBeenCalledOnce();
  });
});
