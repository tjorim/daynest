import { expect, test } from "@playwright/test";

// The mock service worker's MockAuthProvider (src/mocks/MockAuthProvider.tsx)
// starts every e2e run already authenticated, so /auth isn't reachable as a
// login form here — this instead verifies an authenticated visitor to /auth
// gets redirected straight into the app rather than getting stuck.
test("visiting /auth while already authenticated redirects into the app", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 2, name: /today|vandaag/i })).toBeVisible();
});
