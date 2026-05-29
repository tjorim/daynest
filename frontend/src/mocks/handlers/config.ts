import { http, HttpResponse } from "msw";

export const configHandlers = [
  http.get("/api/v1/auth/oidc-config", () =>
    HttpResponse.json({
      issuer: "http://localhost/mock-issuer",
      authorization_url: "http://localhost/mock-issuer/auth",
      token_url: "http://localhost/mock-issuer/token",
    }),
  ),
];
