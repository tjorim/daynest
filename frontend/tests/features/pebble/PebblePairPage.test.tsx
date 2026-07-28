import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PebblePairPage } from "@/features/pebble/PebblePairPage";
import { useAuth } from "@/app/providers/AuthProvider";
import { fetchWithAuth } from "@/lib/api/http";

vi.mock("@/app/providers/AuthProvider");
vi.mock("@/lib/api/http", () => ({
  fetchWithAuth: vi.fn(),
}));

describe("PebblePairPage", () => {
  const login = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 1,
        email: "pebble@example.com",
        full_name: "Pebble User",
        is_active: true,
        roles: [],
      },
      isLoading: false,
      isAuthenticated: true,
      login,
      logout: vi.fn(),
      refreshUser: vi.fn(),
      sessionError: null,
      oidcError: null,
    });
    vi.mocked(fetchWithAuth).mockReset();
    login.mockReset();
  });

  it("starts sign-in directly when the pairing webview has no session", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login,
      logout: vi.fn(),
      refreshUser: vi.fn(),
      sessionError: null,
      oidcError: null,
    });

    render(<PebblePairPage />);

    await waitFor(() => expect(login).toHaveBeenCalledOnce());
    expect(fetchWithAuth).not.toHaveBeenCalled();
  });

  it("allows retrying a transient token-creation failure", async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ api_key: "daynest_retry-token" }), {
          status: 200,
        }),
      );

    const user = userEvent.setup();
    render(<PebblePairPage />);

    expect(await screen.findByText("Pairing failed (503)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry pairing" }));

    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText("You can close this window and return to your watch."),
    ).toBeInTheDocument();
  });
});
