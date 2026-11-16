import { jsonResponse } from "@/mocks/response";
import type { OidcDiscoveryConfig } from "@/api-schema";
import { http } from "msw/http";

export const configHandlers = [
  http.get("/api/auth/oidc-config", () =>
    jsonResponse<OidcDiscoveryConfig>({
      end_session_endpoint: null,
      issuer: "http://localhost/mock-issuer",
      authorization_url: "http://localhost/mock-issuer/auth",
      token_url: "http://localhost/mock-issuer/token",
    }),
  ),
];
