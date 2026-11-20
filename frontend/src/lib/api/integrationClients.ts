import { fetchWithAuth, getJson, parseJsonResponse, sendJson } from "@/lib/api/http";
import type {
  IntegrationClient,
  IntegrationClientCreateResponse,
  IntegrationClientInput,
} from "@/api-types";
import * as m from "@/paraglide/messages";

export async function listIntegrationClients(signal?: AbortSignal): Promise<IntegrationClient[]> {
  return getJson<IntegrationClient[]>("/api/integrations/clients", signal, 2);
}

export async function createIntegrationClient(
  input: IntegrationClientInput,
): Promise<IntegrationClientCreateResponse> {
  return sendJson<IntegrationClientCreateResponse>("POST", "/api/integrations/clients", input);
}

export async function rotateIntegrationClient(
  clientId: number,
): Promise<IntegrationClientCreateResponse> {
  const response = await fetchWithAuth(`/api/integrations/clients/${clientId}/rotate`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<IntegrationClientCreateResponse>(
    response,
    m.api_integration_client_rotate_failed(),
    false,
  );
}

export async function revokeIntegrationClient(clientId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/integrations/clients/${clientId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    // Error-only parse; successful revocations return 204 with no JSON body.
    await parseJsonResponse<never>(response, m.api_integration_client_revoke_failed());
  }
}
