// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/app/providers/AuthProvider";
import { ApiError } from "@/lib/api/http";
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
        sessionError: null,
        oidcError: null,
        isAccountRejected: false,
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

  it("does not delete the account when inline confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    renderSection();

    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    expect(screen.getByText(/this permanently deletes your daynest account/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(apiMock.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the account and logs out after confirmation", async () => {
    const user = userEvent.setup();
    const { logout } = renderSection();
    const confirmSpy = vi.spyOn(window, "confirm");
    apiMock.deleteAccount.mockResolvedValue(undefined);

    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    await user.type(
      screen.getByLabelText(/type your email address to confirm/i),
      "user@example.com",
    );
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(apiMock.deleteAccount).toHaveBeenCalledTimes(1);
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });

  it("clears server errors when inline confirmation is cancelled", async () => {
    const user = userEvent.setup();
    renderSection();
    apiMock.deleteAccount.mockRejectedValue(new Error("Delete shared chores first."));

    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    await user.type(
      screen.getByLabelText(/type your email address to confirm/i),
      "user@example.com",
    );
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(await screen.findByText("Failed to delete account.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByText("Failed to delete account.")).not.toBeInTheDocument();
  });

  it("shows the translated message when deletion is blocked", async () => {
    const user = userEvent.setup();
    const { logout } = renderSection();
    apiMock.deleteAccount.mockRejectedValue(
      new ApiError(
        "Delete shared chores first.",
        409,
        false,
        null,
        "account_deletion_blocked_shared_chores",
      ),
    );

    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    await user.type(
      screen.getByLabelText(/type your email address to confirm/i),
      "user@example.com",
    );
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(await screen.findByText(/cannot delete your account while you own/)).toBeInTheDocument();
    expect(screen.queryByText("Delete shared chores first.")).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });
});
