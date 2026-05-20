// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/features/settings/SettingsPage";

const apiMock = vi.hoisted(() => ({
  createIntegrationClient: vi.fn(),
  listIntegrationClients: vi.fn(),
}));

const pwaMock = vi.hoisted(() => ({
  getDeferredInstallPrompt: vi.fn(),
  promptToInstallApp: vi.fn(),
  subscribeInstallPrompt: vi.fn(),
}));

vi.mock("@/lib/api/today", () => ({
  createIntegrationClient: apiMock.createIntegrationClient,
  isRetryableApiError: () => false,
  listIntegrationClients: apiMock.listIntegrationClients,
}));

vi.mock("@/app/pwa/installPrompt", () => ({
  getDeferredInstallPrompt: pwaMock.getDeferredInstallPrompt,
  promptToInstallApp: pwaMock.promptToInstallApp,
  subscribeInstallPrompt: pwaMock.subscribeInstallPrompt,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    apiMock.createIntegrationClient.mockReset();
    apiMock.listIntegrationClients.mockReset();
    pwaMock.getDeferredInstallPrompt.mockReset();
    pwaMock.promptToInstallApp.mockReset();
    pwaMock.subscribeInstallPrompt.mockReset();
    apiMock.listIntegrationClients.mockResolvedValue([]);
    apiMock.createIntegrationClient.mockResolvedValue({
      id: 1,
      name: "Home Assistant Automations",
      scopes: ["ha:read", "ha:write"],
      rate_limit_per_minute: 120,
      is_active: true,
      api_key: "daynest_test_key",
      client_id: "1",
      client_secret: "daynest_test_key",
      token_url: "http://localhost/api/v1/integrations/clients/token",
    });
    pwaMock.getDeferredInstallPrompt.mockReturnValue(null);
    pwaMock.promptToInstallApp.mockResolvedValue(false);
    pwaMock.subscribeInstallPrompt.mockImplementation(() => () => undefined);
  });

  it("shows Home Assistant setup details and the action scope", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("Home Assistant connection details")).toBeInTheDocument();
    expect(screen.getByText("home-assistant; version=ha.v1")).toBeInTheDocument();
    expect(screen.getByText("https://my.home-assistant.io/redirect/oauth")).toBeInTheDocument();
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
    expect(screen.getByText("http://localhost/api/v1/integrations/clients/token")).toBeInTheDocument();
  });

  it("shows the install button when app install is available and prompts on click", async () => {
    const user = userEvent.setup();
    pwaMock.getDeferredInstallPrompt.mockReturnValue({
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    pwaMock.promptToInstallApp.mockResolvedValue(true);

    render(<SettingsPage />);

    const installButton = await screen.findByRole("button", { name: /install app/i });
    await user.click(installButton);

    await waitFor(() => {
      expect(pwaMock.promptToInstallApp).toHaveBeenCalledTimes(1);
    });
  });

  it("re-enables install button when prompting fails", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    pwaMock.getDeferredInstallPrompt.mockReturnValue({
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    pwaMock.promptToInstallApp.mockRejectedValue(new Error("prompt failed"));

    try {
      render(<SettingsPage />);

      const installButton = await screen.findByRole("button", { name: /install app/i });
      await user.click(installButton);

      await waitFor(() => {
        expect(installButton).toBeEnabled();
        expect(pwaMock.promptToInstallApp).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
