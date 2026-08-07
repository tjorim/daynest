// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/features/settings/SettingsPage";
import type {
  IntegrationClient,
  IntegrationClientCreateResponse,
} from "@/lib/api/integrationClients";
import { QueryTestProvider } from "../../utils/queryTestProvider";

vi.mock("@/paraglide/messages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/paraglide/messages")>();
  return { ...actual };
});

const apiMock = vi.hoisted(() => ({
  createIntegrationClient: vi.fn(),
  listIntegrationClients: vi.fn<(signal?: AbortSignal) => Promise<IntegrationClient[]>>(),
  revokeIntegrationClient: vi.fn<(clientId: number) => Promise<void>>(),
  rotateIntegrationClient: vi.fn<
    (clientId: number) => Promise<IntegrationClientCreateResponse>
  >(),
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
    apiMock.revokeIntegrationClient.mockReset();
    apiMock.rotateIntegrationClient.mockReset();
    apiMock.fetchUserSettings.mockReset();
    authMock.listOAuthSessions.mockReset();
    installPromptMock.getDeferredInstallPrompt.mockReset();
    installPromptMock.subscribeInstallPrompt.mockReset();

    apiMock.listIntegrationClients.mockResolvedValue([
      {
        id: 1,
        name: "Home Assistant",
        rate_limit_per_minute: 120,
        scopes: ["home_assistant:*"],
        is_active: true,
      },
      {
        id: 2,
        name: "Node-RED",
        rate_limit_per_minute: 80,
        scopes: ["home_assistant:*"],
        is_active: false,
      },
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

    const clientsTable = within(screen.getByRole("table"));
    expect(await clientsTable.findByText("Node-RED")).toBeInTheDocument();
    expect(clientsTable.getByText("Home Assistant")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search clients"), "nOdE");

    await waitFor(() => {
      expect(clientsTable.getByText("Node-RED")).toBeInTheDocument();
      expect(clientsTable.queryByText("Home Assistant")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("checkbox", { name: /rate limit per minute/i }));
    expect(screen.queryByText("80/min")).not.toBeInTheDocument();
  });

  it("sorts client names in alphanumeric table body order", async () => {
    apiMock.listIntegrationClients.mockResolvedValue([
      {
        id: 1,
        name: "Client 10",
        rate_limit_per_minute: 120,
        scopes: ["home_assistant:*"],
        is_active: true,
      },
      {
        id: 2,
        name: "Client 2",
        rate_limit_per_minute: 80,
        scopes: ["home_assistant:*"],
        is_active: true,
      },
      {
        id: 3,
        name: "Client 1",
        rate_limit_per_minute: 60,
        scopes: ["home_assistant:*"],
        is_active: false,
      },
    ]);
    const user = userEvent.setup();
    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

    const clientsTable = await screen.findByRole("table");
    expect(await within(clientsTable).findByText("Client 10")).toBeInTheDocument();

    await user.click(within(clientsTable).getByRole("button", { name: "Client" }));

    await waitFor(() => {
      const tableBody = clientsTable.querySelector("tbody");
      expect(tableBody).not.toBeNull();
      const clientNames = within(tableBody as HTMLTableSectionElement)
        .getAllByRole("row")
        .map((row) => {
          const [clientNameCell] = within(row).getAllByRole("cell");
          return clientNameCell?.textContent;
        });
      expect(clientNames).toEqual(["Client 1", "Client 2", "Client 10"]);
    });
  });

  it("keeps row actions bound to the sorted client", async () => {
    const client2: IntegrationClient = {
      id: 2,
      name: "Client 2",
      rate_limit_per_minute: 80,
      scopes: ["home_assistant:*"],
      is_active: true,
    };
    const clients: IntegrationClient[] = [
      {
        id: 10,
        name: "Client 10",
        rate_limit_per_minute: 120,
        scopes: ["home_assistant:*"],
        is_active: true,
      },
      client2,
    ];
    const rotatedClient: IntegrationClientCreateResponse = {
      ...client2,
      api_key: "daynest_rotated_key",
      client_id: "2",
      client_secret: "daynest_rotated_key",
      token_url: "http://localhost/api/integrations/clients/token",
    };
    apiMock.listIntegrationClients.mockResolvedValue(clients);
    apiMock.rotateIntegrationClient.mockResolvedValue(rotatedClient);
    apiMock.revokeIntegrationClient.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <QueryTestProvider>
        <SettingsPage />
      </QueryTestProvider>,
    );

    const clientsTable = await screen.findByRole("table");
    expect(await within(clientsTable).findByText("Client 10")).toBeInTheDocument();
    await user.click(within(clientsTable).getByRole("button", { name: "Client" }));

    const clientRow = within(clientsTable)
      .getAllByRole("row")
      .find((row) => within(row).queryByText("Client 2"));
    expect(clientRow).toBeDefined();
    await user.click(within(clientRow!).getByRole("button", { name: /rotate secret/i }));
    await waitFor(() => expect(apiMock.rotateIntegrationClient).toHaveBeenCalledWith(2));

    await waitFor(() => {
      const refreshedClientRow = within(clientsTable)
        .getAllByRole("row")
        .find((row) => within(row).queryByText("Client 2"));
      expect(refreshedClientRow).toBeDefined();
      expect(
        within(refreshedClientRow!).getByRole("button", { name: /^revoke$/i }),
      ).toBeEnabled();
    });

    const refreshedClientRow = within(clientsTable)
      .getAllByRole("row")
      .find((row) => within(row).queryByText("Client 2"));
    expect(refreshedClientRow).toBeDefined();
    await user.click(within(refreshedClientRow!).getByRole("button", { name: /^revoke$/i }));
    await waitFor(() => expect(apiMock.revokeIntegrationClient).toHaveBeenCalledWith(2));
  });
});
