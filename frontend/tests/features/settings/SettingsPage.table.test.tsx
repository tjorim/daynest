// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { QueryTestProvider } from "../../utils/queryTestProvider";

vi.mock("@/paraglide/messages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/paraglide/messages")>();
  return { ...actual };
});

const apiMock = vi.hoisted(() => ({
  createIntegrationClient: vi.fn(),
  listIntegrationClients: vi.fn(),
  revokeIntegrationClient: vi.fn(),
  rotateIntegrationClient: vi.fn(),
  fetchUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  deleteAccount: vi.fn(),
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

    await user.click(screen.getByRole("checkbox", { name: /rate limit per minute/i }));
    expect(screen.queryByText("80/min")).not.toBeInTheDocument();
  });
});
