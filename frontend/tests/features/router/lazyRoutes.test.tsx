// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../utils/router";

const statsModule = vi.hoisted(() => {
  let resolve!: () => void;
  const ready = new Promise<void>((r) => {
    resolve = r;
  });
  return { ready, resolve };
});

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/features/today/TodayPage", () => ({
  TodayPage: () => <div>Today Page</div>,
}));

vi.mock("@/features/stats/StatsPage", async () => {
  await statsModule.ready;
  return { StatsPage: () => <div>Stats Page</div> };
});

vi.mock("@/features/settings/SettingsPage", () => {
  throw new Error("chunk failed");
});

describe("lazy routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an accessible pending state while a deferred page loads", async () => {
    renderWithRouter({ path: "/stats" });

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Loading page…");

    statsModule.resolve();
    await waitFor(() => expect(screen.getByText("Stats Page")).toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a recoverable error when a page chunk fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithRouter({ path: "/settings" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This page could not be loaded");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("keeps the Today shell immediate and navigates to a deferred route", async () => {
    const { router } = renderWithRouter({ path: "/today" });
    expect(await screen.findByText("Today Page")).toBeInTheDocument();

    statsModule.resolve();
    await router.navigate({ to: "/stats" });
    await waitFor(() => expect(screen.getByText("Stats Page")).toBeInTheDocument());
    expect(router.state.location.pathname).toBe("/stats");

    await router.history.back();
    await waitFor(() => expect(screen.getByText("Today Page")).toBeInTheDocument());
  });
});
