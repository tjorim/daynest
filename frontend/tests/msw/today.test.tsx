// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { TodayPage } from "@/features/today/TodayPage";
import { QueryTestProvider } from "../utils/queryTestProvider";

// Minimal auth mock — we only need useAuth to be available, not the real OIDC flow.
// The real API fetch goes through MSW (no vi.mock on the api module).
vi.mock("@/app/providers/AuthProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/providers/AuthProvider")>();
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 1, email: "demo@daynest.app", full_name: "Demo User", is_active: true, roles: ["user"] },
      isLoading: false,
      isAuthenticated: true,
      login: () => {},
      logout: () => {},
      refreshUser: async () => {},
      sessionError: null,
    }),
  };
});

describe("TodayPage — MSW-backed", () => {
  it("renders items fetched via real HTTP through MSW handlers", async () => {
    render(
      <QueryTestProvider>
        <TodayPage />
      </QueryTestProvider>,
    );

    // Seed data from busyTodayPayload includes "Morning vitamin" as scheduled medication.
    // It appears in both the focus panel and the medication section.
    const vitaminMatches = await screen.findAllByText("Morning vitamin");
    expect(vitaminMatches.length).toBeGreaterThanOrEqual(1);
    // And "Water plants" as a due-today chore
    expect(screen.getByText("Water plants")).toBeInTheDocument();
    // And "Order groceries" as a planned item
    expect(screen.getByText("Order groceries")).toBeInTheDocument();
  });

  it("shows error UI when MSW returns a 500 for /api/today", async () => {
    server.use(
      http.get("/api/today", () =>
        HttpResponse.json({ detail: "Internal server error" }, { status: 500 }),
      ),
    );

    render(
      <QueryTestProvider>
        <TodayPage />
      </QueryTestProvider>,
    );

    expect(await screen.findByText(/Internal server error/i)).toBeInTheDocument();
  });

  it("shows error UI when MSW returns a 401 for /api/today", async () => {
    server.use(
      http.get("/api/today", () =>
        HttpResponse.json({ detail: "Not authenticated" }, { status: 401 }),
      ),
    );

    render(
      <QueryTestProvider>
        <TodayPage />
      </QueryTestProvider>,
    );

    expect(await screen.findByText(/Not authenticated/i)).toBeInTheDocument();
  });
});
