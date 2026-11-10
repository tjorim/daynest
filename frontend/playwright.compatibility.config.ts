import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
const baseURL = "http://localhost:4193";
export default defineConfig({
  ...base,
  workers: 1,
  testMatch: ["**/calendar.spec.ts", "**/templates.spec.ts"],
  use: { ...base.use, baseURL },
  projects: ["firefox", "webkit"].map((browser) => ({
    name: browser,
    use: {
      ...devices[browser === "firefox" ? "Desktop Firefox" : "Desktop Safari"],
      ...(browser === "firefox" && process.env.REMOTE_FIREFOX_WS_ENDPOINT
        ? { connectOptions: { wsEndpoint: process.env.REMOTE_FIREFOX_WS_ENDPOINT } }
        : {}),
      ...(browser === "webkit" && process.env.REMOTE_WEBKIT_WS_ENDPOINT
        ? { connectOptions: { wsEndpoint: process.env.REMOTE_WEBKIT_WS_ENDPOINT } }
        : {}),
    },
  })),
  webServer: {
    command: "pnpm build:mock && pnpm exec vite preview --port 4193 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
