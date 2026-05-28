import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { server } from "@/mocks/server";
import { resetMockState } from "@/mocks/data/state";
import { setOidcAccessToken } from "@/lib/auth/session";
import { MOCK_TOKEN } from "@/mocks/data/constants";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

beforeEach(() => {
  setOidcAccessToken(MOCK_TOKEN);
});

afterEach(() => {
  server.resetHandlers();
  resetMockState();
  setOidcAccessToken(undefined);
});

afterAll(() => server.close());
