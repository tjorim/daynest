import { http, HttpResponse } from "msw";
import { MOCK_USER } from "../data/constants";
import { getMockState } from "../data/state";
import { auth401 } from "./errors";

export const authHandlers = [
  http.get("/api/v1/auth/me", () => {
    const { scenario } = getMockState();
    if (scenario === "signed-out") return auth401();
    if (scenario === "expired-session") return auth401();
    return HttpResponse.json(MOCK_USER);
  }),

  http.get("/api/v1/auth/sessions", () => {
    const { scenario } = getMockState();
    if (scenario === "signed-out") return auth401();
    return HttpResponse.json([
      {
        id: "session-001",
        ip_address: "127.0.0.1",
        started: Date.now() - 3600_000,
        last_access: Date.now() - 60_000,
        expires: Date.now() + 86_400_000,
        clients: [],
      },
    ]);
  }),

  http.delete("/api/v1/auth/sessions/:sessionId", () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
