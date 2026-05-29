import { http, HttpResponse } from "msw";
import { MOCK_USER, MOCK_TODAY } from "../data/constants";
import { getMockState } from "../data/state";
import { auth401, forbidden403 } from "./errors";

export const authHandlers = [
  http.get("/api/v1/auth/me", () => {
    const { scenario } = getMockState();
    if (scenario === "signed-out" || scenario === "expired-session") return auth401();
    if (scenario === "forbidden") return forbidden403();
    return HttpResponse.json(MOCK_USER);
  }),

  http.get("/api/v1/auth/sessions", () => {
    const { scenario } = getMockState();
    if (scenario === "signed-out") return auth401();
    const base = new Date(MOCK_TODAY + "T12:00:00Z").getTime();
    return HttpResponse.json([
      {
        id: "session-001",
        ip_address: "127.0.0.1",
        started: base - 3_600_000,
        last_access: base - 60_000,
        expires: base + 86_400_000,
        clients: [],
      },
    ]);
  }),

  http.delete("/api/v1/auth/sessions/:sessionId", () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
