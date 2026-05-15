// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/features/settings/SettingsPage";

const apiMock = vi.hoisted(() => ({
  createIntegrationClient: vi.fn(),
  listIntegrationClients: vi.fn(),
}));

vi.mock("@/lib/api/today", () => ({
  createIntegrationClient: apiMock.createIntegrationClient,
  isRetryableApiError: () => false,
  listIntegrationClients: apiMock.listIntegrationClients,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    apiMock.createIntegrationClient.mockReset();
    apiMock.listIntegrationClients.mockReset();
    apiMock.listIntegrationClients.mockResolvedValue([]);
    apiMock.createIntegrationClient.mockResolvedValue({
      id: 1,
      name: "Home Assistant Automations",
      scopes: ["ha:read", "ha:write"],
      rate_limit_per_minute: 120,
      is_active: true,
      api_key: "daynest_test_key",
    });
  });

  it("shows Home Assistant setup details and the action scope", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("Home Assistant connection details")).toBeInTheDocument();
    expect(screen.getByText("home-assistant; version=ha.v1")).toBeInTheDocument();
    expect(screen.getByText("X-Integration-Key")).toBeInTheDocument();
    expect(screen.getByLabelText(/home assistant actions/i)).toBeInTheDocument();
  });

  it("applies the Home Assistant automation preset when creating a client", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await screen.findByText("Integration presets");
    await user.click(screen.getByRole("button", { name: /home assistant automations/i }));
    await user.click(screen.getByRole("button", { name: /^create client$/i }));

    await waitFor(() => {
      expect(apiMock.createIntegrationClient).toHaveBeenCalledWith({
        name: "Home Assistant Automations",
        scopes: ["ha:read", "ha:write"],
        rate_limit_per_minute: 120,
      });
    });
    expect(await screen.findByText("daynest_test_key")).toBeInTheDocument();
  });
});
