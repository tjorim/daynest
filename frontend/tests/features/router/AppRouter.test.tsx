// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../utils/router";

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({ isLoading: false }),
}));

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: null, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }),
}));

vi.mock("@/app/layout/AppLayout", async () => {
  const { Outlet } = await import("@tanstack/react-router");
  return { AppLayout: Outlet };
});

vi.mock("@/paraglide/messages", () => ({
  router_loading_session: () => "Loading session",
  router_completing_sign_in: () => "Completing sign in",
}));

vi.mock("@/features/auth/AuthPage", () => ({
  AuthPage: () => <div>Auth Page</div>,
}));

vi.mock("@/features/today/TodayPage", () => ({
  TodayPage: () => <div>Today Page</div>,
}));

vi.mock("@/features/calendar/CalendarPage", () => ({
  CalendarPage: () => <div>Calendar Page</div>,
}));

vi.mock("@/features/medication/MedicationPage", () => ({
  MedicationPage: () => <div>Medication Page</div>,
}));

vi.mock("@/features/templates/TemplatesPage", () => ({
  TemplatesPage: () => <div>Templates Page</div>,
}));

vi.mock("@/features/stats/StatsPage", () => ({
  StatsPage: () => <div>Stats Page</div>,
}));

vi.mock("@/features/settings/SettingsPage", () => ({
  SettingsPage: () => <div>Settings Page</div>,
}));

describe("AppRouter", () => {
  it("redirects unauthenticated users to /auth and preserves from", async () => {
    const { router } = renderWithRouter({
      path: "/calendar?month=2026-05&date=2026-05-26#details",
      auth: { isAuthenticated: false, isLoading: false },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/auth");
    });

    expect(router.state.location.search).toMatchObject({
      from: "/calendar?month=2026-05&date=2026-05-26#details",
    });
    expect(screen.getByText("Auth Page")).toBeInTheDocument();
  });

  it("renders protected routes when authenticated", async () => {
    const { router } = renderWithRouter({
      path: "/today",
      auth: { isAuthenticated: true, isLoading: false },
    });

    await waitFor(() => {
      expect(screen.getByText("Today Page")).toBeInTheDocument();
    });

    await router.navigate({ to: "/calendar", search: { month: "2026-05", date: "2026-05-26" } });
    await waitFor(() => {
      expect(screen.getByText("Calendar Page")).toBeInTheDocument();
    });

    await router.navigate({ to: "/medication" });
    await waitFor(() => {
      expect(screen.getByText("Medication Page")).toBeInTheDocument();
    });

    await router.navigate({ to: "/templates" });
    await waitFor(() => {
      expect(screen.getByText("Templates Page")).toBeInTheDocument();
    });

    await router.navigate({ to: "/settings" });
    await waitFor(() => {
      expect(screen.getByText("Settings Page")).toBeInTheDocument();
    });
  });

  it("renders auth callback route", async () => {
    renderWithRouter({
      path: "/auth/callback",
      auth: { isAuthenticated: false, isLoading: false },
    });

    await waitFor(() => {
      expect(screen.getByText("Completing sign in")).toBeInTheDocument();
    });
  });
});
