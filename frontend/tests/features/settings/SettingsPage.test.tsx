// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { setLocale } from "@/paraglide/runtime";
import { QueryTestProvider } from "../../utils/queryTestProvider";

const apiMock = vi.hoisted(() => ({
  createIntegrationClient: vi.fn(),
  listIntegrationClients: vi.fn(),
  revokeIntegrationClient: vi.fn(),
  rotateIntegrationClient: vi.fn(),
  fetchUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  deleteAccount: vi.fn(),
}));

const pwaMock = vi.hoisted(() => ({
  getDeferredInstallPrompt: vi.fn(),
  promptToInstallApp: vi.fn(),
  subscribeInstallPrompt: vi.fn(),
}));

vi.mock("@/lib/api/integrationClients", () => ({
  createIntegrationClient: apiMock.createIntegrationClient,
  listIntegrationClients: apiMock.listIntegrationClients,
  revokeIntegrationClient: apiMock.revokeIntegrationClient,
  rotateIntegrationClient: apiMock.rotateIntegrationClient,
}));

vi.mock("@/lib/api/settings", () => ({
  fetchUserSettings: apiMock.fetchUserSettings,
  updateUserSettings: apiMock.updateUserSettings,
  deleteAccount: apiMock.deleteAccount,
}));

vi.mock("@/app/pwa/installPrompt", () => ({
  getDeferredInstallPrompt: pwaMock.getDeferredInstallPrompt,
  promptToInstallApp: pwaMock.promptToInstallApp,
  subscribeInstallPrompt: pwaMock.subscribeInstallPrompt,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.removeItem("daynest_lang");
    setLocale("en");
    apiMock.createIntegrationClient.mockReset();
    apiMock.listIntegrationClients.mockReset();
    apiMock.revokeIntegrationClient.mockReset();
    apiMock.rotateIntegrationClient.mockReset();
    apiMock.fetchUserSettings.mockReset();
    apiMock.updateUserSettings.mockReset();
    apiMock.deleteAccount.mockReset();
    pwaMock.getDeferredInstallPrompt.mockReset();
    pwaMock.promptToInstallApp.mockReset();
    pwaMock.subscribeInstallPrompt.mockReset();
    apiMock.listIntegrationClients.mockResolvedValue([]);
    apiMock.fetchUserSettings.mockResolvedValue({
      timezone: "UTC",
      push_overdue_chores_enabled: true,
      push_medication_reminders_enabled: true,
      push_missed_medications_enabled: true,
      medication_reminder_minutes: 30,
      quiet_hours_start: null,
      quiet_hours_end: null,
    });
    apiMock.createIntegrationClient.mockResolvedValue({
      id: 1,
      name: "Home Assistant Automations",
      rate_limit_per_minute: 120,
      is_active: true,
      api_key: "daynest_test_key",
      client_id: "1",
      client_secret: "daynest_test_key",
      token_url: "http://localhost/api/integrations/clients/token",
    });
    pwaMock.getDeferredInstallPrompt.mockReturnValue(null);
    pwaMock.promptToInstallApp.mockResolvedValue(false);
    pwaMock.subscribeInstallPrompt.mockImplementation(() => () => undefined);
  });

  it("shows Home Assistant setup details", async () => {
    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

    expect(await screen.findByText("Home Assistant connection details")).toBeInTheDocument();
    expect(screen.getByText("home-assistant; version=ha.v1")).toBeInTheDocument();
    expect(screen.getByText(/setup now uses browser-based oauth redirect/i)).toBeInTheDocument();
    expect(screen.getByText("https://my.home-assistant.io/redirect/oauth")).toBeInTheDocument();
  });

  it("creates a client with the given name and rate limit", async () => {
    const user = userEvent.setup();
    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

    await screen.findByText("Create integration client");
    await user.click(screen.getByRole("button", { name: /^create client$/i }));

    await waitFor(() => {
      expect(apiMock.createIntegrationClient).toHaveBeenCalledWith({
        name: "Home Assistant",
        rate_limit_per_minute: 120,
      });
    });
    expect(await screen.findByText("daynest_test_key")).toBeInTheDocument();
    expect(screen.getByText("http://localhost/api/integrations/clients/token")).toBeInTheDocument();
    expect(screen.getByText(/legacy integration client fallback/i)).toBeInTheDocument();
  });

  it("shows the install button when app install is available and prompts on click", async () => {
    const user = userEvent.setup();
    pwaMock.getDeferredInstallPrompt.mockReturnValue({
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    pwaMock.promptToInstallApp.mockResolvedValue(true);

    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

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
      render(
        <QueryTestProvider>
          <SettingsPage />
        </QueryTestProvider>,
      );

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
    apiMock.fetchUserSettings.mockResolvedValue({
      timezone: "Europe/Brussels",
      push_overdue_chores_enabled: true,
      push_medication_reminders_enabled: true,
      push_missed_medications_enabled: true,
      medication_reminder_minutes: 30,
      quiet_hours_start: null,
      quiet_hours_end: null,
    });
    apiMock.updateUserSettings.mockResolvedValue({ timezone: "America/New_York" });

    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

    const select = await screen.findByRole("combobox", { name: /timezone/i });
    expect(select).toHaveValue("Europe/Brussels");

    await user.selectOptions(select, "America/New_York");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(apiMock.updateUserSettings).toHaveBeenCalledWith({ timezone: "America/New_York" });
    });
    expect(await screen.findByText(/timezone saved/i)).toBeInTheDocument();
  });

  it("saves push toggle updates with only changed field", async () => {
    const user = userEvent.setup();
    apiMock.updateUserSettings.mockResolvedValue({});
    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

    const overdueToggle = await screen.findByLabelText(/overdue chore reminders/i);
    await user.click(overdueToggle);

    await waitFor(() => {
      expect(apiMock.updateUserSettings).toHaveBeenCalledWith({ push_overdue_chores_enabled: false });
    });
  });

  it("skips API call when toggle is reverted before server confirms", async () => {
    const user = userEvent.setup();
    let resolveFirst!: (v: unknown) => void;
    apiMock.updateUserSettings.mockImplementationOnce(
      () => new Promise((r) => { resolveFirst = r; }),
    );
    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

    const overdueToggle = await screen.findByLabelText(/overdue chore reminders/i);
    // Toggle off (API pending, server state still true)
    await user.click(overdueToggle);
    // Toggle back on before API resolves — no-op because UI matches server state
    await user.click(overdueToggle);
    resolveFirst({});
    // Only one API call was made — the revert was a no-op
    await waitFor(() => {
      expect(apiMock.updateUserSettings).toHaveBeenCalledTimes(1);
    });
  });

  it("saves notification numeric and quiet hours via apply button", async () => {
    const user = userEvent.setup();
    apiMock.updateUserSettings.mockResolvedValue({});
    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

    // Wait for user settings to be fully initialized (timezone transitions from "" to "UTC" after API loads)
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /timezone/i })).toHaveValue("UTC");
    });
    const minutesInput = screen.getByLabelText(/medication reminder \(minutes before\)/i);
    fireEvent.change(minutesInput, { target: { value: "45" } });
    await user.type(screen.getByLabelText(/^from$/i), "22:00");
    await user.type(screen.getByLabelText(/^to$/i), "07:00");
    await user.click(screen.getByRole("button", { name: /apply notification preferences/i }));

    await waitFor(() => {
      expect(apiMock.updateUserSettings).toHaveBeenCalledWith({
        medication_reminder_minutes: 45,
        quiet_hours_start: "22:00",
        quiet_hours_end: "07:00",
      });
    });
  });

  it("uses an inline confirmation before deleting an account", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    apiMock.deleteAccount.mockResolvedValue(undefined);

    try {
      render(
        <QueryTestProvider>
          <SettingsPage />
        </QueryTestProvider>,
      );

      const deleteButton = await screen.findByRole("button", { name: /delete my account/i });
      await user.click(deleteButton);

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(screen.getByText(/this permanently deletes your daynest account/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^confirm$/i }));

      await waitFor(() => {
        expect(apiMock.deleteAccount).toHaveBeenCalledTimes(1);
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("switches language to Dutch immediately", async () => {
    const user = userEvent.setup();
    render(
      <QueryTestProvider>
        <LanguageProvider><SettingsPage /></LanguageProvider>
      </QueryTestProvider>,
    );

    const languageSelect = await screen.findByRole("combobox", { name: /language/i });
    await user.selectOptions(languageSelect, "nl");

    expect(await screen.findByRole("heading", { level: 2, name: /instellingen/i })).toBeInTheDocument();
  });
});
