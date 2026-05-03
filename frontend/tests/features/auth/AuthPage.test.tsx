// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthPage } from "../../../src/features/auth/AuthPage";

// Provide a minimal AuthContext so AuthPage can consume useAuth()
vi.mock("../../../src/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
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
    const { container } = renderAuthPage();
    expect(container.querySelector('input[autocomplete="name"]')).not.toBeInTheDocument();
  });

  it("switches to register mode when the Register toggle is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderAuthPage();

    await user.click(getModeGroup(container).getByRole("button", { name: /^register$/i }));

    expect(screen.getByText(/full name/i)).toBeInTheDocument();
    expect(container.querySelector('input[autocomplete="name"]')).toBeInTheDocument();
  });

  it("switches back to login mode when Login toggle is clicked after register", async () => {
    const user = userEvent.setup();
    const { container } = renderAuthPage();

    await user.click(getModeGroup(container).getByRole("button", { name: /^register$/i }));
    await user.click(getModeGroup(container).getByRole("button", { name: /^login$/i }));

    expect(container.querySelector('input[autocomplete="name"]')).not.toBeInTheDocument();
  });
});
