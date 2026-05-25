import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4173",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "corepack pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
});
