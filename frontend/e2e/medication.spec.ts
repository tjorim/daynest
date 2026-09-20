import { expect, test } from "@playwright/test";

test("medication page opens from navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("link", { name: /medication|medicatie/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /medication|medicatie/i })).toBeVisible();
});
