import { fetchWithAuth, getJson, parseJsonResponse, sendJson } from "@/lib/api/http";
import { z } from "zod";

export interface IntegrationClient {
  id: number;
  name: string;
  rate_limit_per_minute: number;
  is_active: boolean;
}

export interface IntegrationClientInput {
  name: string;
  rate_limit_per_minute: number;
}

export interface IntegrationClientCreateResponse extends IntegrationClient {
  api_key: string;
  client_id: string;
  client_secret: string;
  token_url: string;
}

const integrationClientSchema = z.object({
  id: z.number(),
  name: z.string(),
  rate_limit_per_minute: z.number(),
  is_active: z.boolean(),
});

const integrationClientCreateResponseSchema = integrationClientSchema.extend({
  api_key: z.string(),
  client_id: z.string(),
  client_secret: z.string(),
  token_url: z.string(),
});

export async function listIntegrationClients(signal?: AbortSignal): Promise<IntegrationClient[]> {
  return getJson("/api/integrations/clients", z.array(integrationClientSchema), signal, 2);
}

export async function createIntegrationClient(
  input: IntegrationClientInput,
): Promise<IntegrationClientCreateResponse> {
  return sendJson("POST", "/api/integrations/clients", input, integrationClientCreateResponseSchema);
}

export async function rotateIntegrationClient(
  clientId: number,
): Promise<IntegrationClientCreateResponse> {
  const response = await fetchWithAuth(`/api/integrations/clients/${clientId}/rotate`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(
    response,
    "Failed to rotate integration client",
    false,
    integrationClientCreateResponseSchema,
  );
}

export async function revokeIntegrationClient(clientId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/integrations/clients/${clientId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    // Error-only parse; successful revocations return 204 with no JSON body.
    await parseJsonResponse<never>(response, "Failed to revoke integration client");
  }
}
