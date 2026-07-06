// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/app/providers/AuthProvider";
import { AccountDeletionSection } from "@/features/settings/sections/AccountDeletionSection";

const apiMock = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
}));

vi.mock("@/lib/api/settings", () => ({
  deleteAccount: apiMock.deleteAccount,
}));

function renderSection(logout = vi.fn()) {
  render(
    <AuthContext.Provider
      value={{
        user: {
          id: 1,
          email: "user@example.com",
          full_name: "Test User",
          is_active: true,
          roles: [],
        },
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        logout,
        refreshUser: vi.fn(),
      }}
    >
      <AccountDeletionSection />
    </AuthContext.Provider>,
  );
  return { logout };
}

describe("AccountDeletionSection", () => {
  beforeEach(() => {
    apiMock.deleteAccount.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not delete the account when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderSection();

    await user.click(screen.getByRole("button", { name: /delete my account/i }));

    expect(apiMock.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the account and logs out after confirmation", async () => {
    const user = userEvent.setup();
    const { logout } = renderSection();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMock.deleteAccount.mockResolvedValue(undefined);

    await user.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() => {
      expect(apiMock.deleteAccount).toHaveBeenCalledTimes(1);
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the server error when deletion is blocked", async () => {
    const user = userEvent.setup();
    const { logout } = renderSection();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMock.deleteAccount.mockRejectedValue(new Error("Delete shared chores first."));

    await user.click(screen.getByRole("button", { name: /delete my account/i }));

    expect(await screen.findByText("Delete shared chores first.")).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });
});
