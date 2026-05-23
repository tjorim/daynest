// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/features/settings/SettingsPage";

const apiMock = vi.hoisted(() => ({
  createIntegrationClient: vi.fn(),
  listIntegrationClients: vi.fn(),
  fetchUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
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
  fetchUserSettings: apiMock.fetchUserSettings,
  updateUserSettings: apiMock.updateUserSettings,
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
    apiMock.fetchUserSettings.mockReset();
    apiMock.updateUserSettings.mockReset();
    pwaMock.getDeferredInstallPrompt.mockReset();
    pwaMock.promptToInstallApp.mockReset();
    pwaMock.subscribeInstallPrompt.mockReset();
    apiMock.listIntegrationClients.mockResolvedValue([]);
    apiMock.fetchUserSettings.mockResolvedValue({ timezone: "UTC" });
    apiMock.createIntegrationClient.mockResolvedValue({
      id: 1,
      name: "Home Assistant Automations",
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

  it("shows Home Assistant setup details", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("Home Assistant connection details")).toBeInTheDocument();
    expect(screen.getByText("home-assistant; version=ha.v1")).toBeInTheDocument();
    expect(screen.getByText(/setup now uses browser-based oauth redirect/i)).toBeInTheDocument();
    expect(screen.getByText("https://my.home-assistant.io/redirect/oauth")).toBeInTheDocument();
  });

  it("creates a client with the given name and rate limit", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await screen.findByText("Create integration client");
    await user.click(screen.getByRole("button", { name: /^create client$/i }));

    await waitFor(() => {
      expect(apiMock.createIntegrationClient).toHaveBeenCalledWith({
        name: "Home Assistant",
        rate_limit_per_minute: 120,
      });
    });
    expect(await screen.findByText("daynest_test_key")).toBeInTheDocument();
    expect(screen.getByText("http://localhost/api/v1/integrations/clients/token")).toBeInTheDocument();
    expect(screen.getByText(/legacy integration client fallback/i)).toBeInTheDocument();
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

  it("timezone selector loads current timezone and saves on change", async () => {
    const user = userEvent.setup();
    apiMock.fetchUserSettings.mockResolvedValue({ timezone: "Europe/Brussels" });
    apiMock.updateUserSettings.mockResolvedValue({ timezone: "America/New_York" });

    render(<SettingsPage />);

    const select = await screen.findByRole("combobox", { name: /timezone/i });
    expect(select).toHaveValue("Europe/Brussels");

    await user.selectOptions(select, "America/New_York");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(apiMock.updateUserSettings).toHaveBeenCalledWith({ timezone: "America/New_York" });
    });
    expect(await screen.findByText(/timezone saved/i)).toBeInTheDocument();
  });
});
