// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthPage } from "@/features/auth/AuthPage";

const authMock = vi.hoisted(() => ({
  loginStub: vi.fn(),
  registerStub: vi.fn(),
  logoutStub: vi.fn(),
  refreshUserStub: vi.fn(),
}));

// Provide a minimal AuthContext so AuthPage can consume useAuth()
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    login: authMock.loginStub,
    register: authMock.registerStub,
    logout: authMock.logoutStub,
    refreshUser: authMock.refreshUserStub,
    user: null,
  }),
}));

function renderAuthPage() {
  return render(
    <MemoryRouter initialEntries={["/auth"]}>
      <AuthPage />
    </MemoryRouter>,
  );
}

/** Returns the mode-toggle btn-group scoped to the render container. */
function getModeGroup(container: HTMLElement) {
  const group = container.querySelector<HTMLElement>('[aria-label="Authentication mode"]');
  if (!group) throw new Error("Mode toggle group not found");
  return within(group);
}

describe("AuthPage", () => {
  beforeEach(() => {
    authMock.loginStub.mockReset();
    authMock.registerStub.mockReset();
    authMock.logoutStub.mockReset();
    authMock.refreshUserStub.mockReset();
  });

  it("renders the sign-in heading", () => {
    renderAuthPage();
    expect(screen.getByRole("heading", { name: /sign in to daynest/i })).toBeInTheDocument();
  });

  it("shows email and password fields in login mode", () => {
    const { container } = renderAuthPage();
    expect(container.querySelector('input[type="email"]')).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it("does not show the full-name field in login mode", () => {
    renderAuthPage();
    expect(screen.queryByRole("textbox", { name: /full ?name/i })).not.toBeInTheDocument();
  });

  it("switches to register mode when the Register toggle is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderAuthPage();

    await user.click(getModeGroup(container).getByRole("button", { name: /^register$/i }));

    expect(screen.getByText(/full name/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /full ?name/i })).toBeInTheDocument();
  });

  it("switches back to login mode when Login toggle is clicked after register", async () => {
    const user = userEvent.setup();
    const { container } = renderAuthPage();

    await user.click(getModeGroup(container).getByRole("button", { name: /^register$/i }));
    await user.click(getModeGroup(container).getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /full ?name/i })).not.toBeInTheDocument();
    });
  });
});
