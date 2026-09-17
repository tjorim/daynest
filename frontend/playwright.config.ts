import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4173",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    // Built with the MSW mock service worker baked in (VITE_MSW is read at
    // build time, not just dev time), so the suite is fully self-contained —
    // no real backend, database, or credentials required. The mocked
    // MockAuthProvider (src/mocks/MockAuthProvider.tsx) starts already
    // authenticated as MOCK_USER by default, so specs don't need to log in.
    command: "corepack pnpm build:mock && corepack pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
});
