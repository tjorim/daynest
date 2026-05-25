import { expect, test } from "@playwright/test";

test("login form is reachable", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 2, name: /sign in|aanmelden/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in|aanmelden/i })).toBeVisible();
});
