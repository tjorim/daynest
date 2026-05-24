import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("medication page opens from navigation", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
  await login(page);
  await page.getByRole("link", { name: /medication|medicatie/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /medication|medicatie/i })).toBeVisible();
});
