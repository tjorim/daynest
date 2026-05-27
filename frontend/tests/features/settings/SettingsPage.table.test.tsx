// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { QueryTestProvider } from "../../utils/queryTestProvider";

vi.mock("@/paraglide/messages", () => {
  const keys = [
    "settings_timezone_load_error",
    "settings_timezone_saved",
    "settings_timezone_save_error",
    "settings_notification_prefs_save_error",
    "settings_notification_prefs_saved",
    "settings_rate_limit_label",
    "status_active",
    "status_inactive",
    "settings_rotating",
    "settings_rotate_secret",
    "settings_revoking",
    "settings_revoke",
    "settings_title",
    "settings_install_app",
    "settings_refresh",
    "settings_subtitle",
    "settings_loading",
    "settings_retry",
    "settings_backend_server_header",
    "settings_default",
    "settings_custom_self_hosted",
    "settings_custom_placeholder",
    "settings_apply",
    "settings_user_prefs_header",
    "settings_language",
    "settings_language_english",
    "settings_language_dutch",
    "settings_timezone",
    "settings_timezone_loading",
    "settings_saving",
    "settings_save",
    "settings_notifications_header",
    "settings_overdue_chore_reminders",
    "settings_medication_reminders",
    "settings_missed_medication_alerts",
    "settings_medication_reminder_minutes",
    "settings_quiet_hours",
    "settings_quiet_hours_from",
    "settings_quiet_hours_to",
    "settings_save_notification_prefs",
    "settings_enable_browser_notifications",
    "settings_create_client_header",
    "settings_client_name_placeholder",
    "settings_rate_limit_hint",
    "settings_creating",
    "settings_create_client",
    "settings_ha_header",
    "settings_ha_description",
    "settings_ha_base_url",
    "settings_ha_oauth_callback",
    "settings_ha_contract",
    "settings_ha_endpoints_summary",
    "settings_integration_clients_header",
    "settings_no_clients",
    "settings_oauth_sessions_header",
    "settings_loading_sessions",
    "settings_no_sessions",
    "settings_ip_address",
    "settings_last_active",
    "settings_unknown_client",
  ] as const;

  return Object.fromEntries(
    keys.map((key) => [key, () => key]),
  );
});

const apiMock = vi.hoisted(() => ({
  createIntegrationClient: vi.fn(),
  listIntegrationClients: vi.fn(),
  revokeIntegrationClient: vi.fn(),
  rotateIntegrationClient: vi.fn(),
  fetchUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  listOAuthSessions: vi.fn(),
  revokeOAuthSession: vi.fn(),
}));

const installPromptMock = vi.hoisted(() => ({
  getDeferredInstallPrompt: vi.fn(),
  promptToInstallApp: vi.fn(),
  subscribeInstallPrompt: vi.fn(),
}));

vi.mock("@/lib/api/today", () => ({
  createIntegrationClient: apiMock.createIntegrationClient,
  isRetryableApiError: () => false,
  listIntegrationClients: apiMock.listIntegrationClients,
  revokeIntegrationClient: apiMock.revokeIntegrationClient,
  rotateIntegrationClient: apiMock.rotateIntegrationClient,
  fetchUserSettings: apiMock.fetchUserSettings,
  updateUserSettings: apiMock.updateUserSettings,
}));

vi.mock("@/lib/api/auth", () => ({
  listOAuthSessions: authMock.listOAuthSessions,
  revokeOAuthSession: authMock.revokeOAuthSession,
}));

vi.mock("@/app/pwa/installPrompt", () => ({
  getDeferredInstallPrompt: installPromptMock.getDeferredInstallPrompt,
  promptToInstallApp: installPromptMock.promptToInstallApp,
  subscribeInstallPrompt: installPromptMock.subscribeInstallPrompt,
}));

vi.mock("@/lib/api/serverConfig", () => ({
  getCustomServerUrl: () => null,
  setCustomServerUrl: vi.fn(),
}));

describe("SettingsPage integration clients table", () => {
  beforeEach(() => {
    apiMock.listIntegrationClients.mockReset();
    apiMock.fetchUserSettings.mockReset();
    authMock.listOAuthSessions.mockReset();
    installPromptMock.getDeferredInstallPrompt.mockReset();
    installPromptMock.subscribeInstallPrompt.mockReset();

    apiMock.listIntegrationClients.mockResolvedValue([
      { id: 1, name: "Home Assistant", rate_limit_per_minute: 120, is_active: true },
      { id: 2, name: "Node-RED", rate_limit_per_minute: 80, is_active: false },
    ]);
    apiMock.fetchUserSettings.mockResolvedValue({
      timezone: "UTC",
      push_overdue_chores_enabled: true,
      push_medication_reminders_enabled: true,
      push_missed_medications_enabled: true,
      medication_reminder_minutes: 30,
      quiet_hours_start: null,
      quiet_hours_end: null,
    });
    authMock.listOAuthSessions.mockResolvedValue([]);
    installPromptMock.getDeferredInstallPrompt.mockReturnValue(null);
    installPromptMock.subscribeInstallPrompt.mockImplementation(() => () => undefined);
  });

  it("filters clients and toggles table column visibility", async () => {
    const user = userEvent.setup();
    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

    expect(await screen.findByText("Home Assistant")).toBeInTheDocument();
    expect(screen.getByText("Node-RED")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search clients"), "Node");

    await waitFor(() => {
      expect(screen.getByText("Node-RED")).toBeInTheDocument();
      expect(screen.queryByText("Home Assistant")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("checkbox", { name: "settings_rate_limit_label" }));
    expect(screen.queryByText("80/min")).not.toBeInTheDocument();
  });
});
