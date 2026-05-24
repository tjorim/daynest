import { expect, test } from "@playwright/test";

test("login form is reachable", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 2, name: /sign in|meld je aan/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in|aanmelden/i })).toBeVisible();
});
