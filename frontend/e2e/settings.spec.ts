import { expect, test } from "@playwright/test";

test("settings timezone and language controls are visible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /settings|instellingen/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /settings|instellingen/i })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /language|taal/i })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /timezone|tijdzone/i })).toBeVisible();
});

test("switching language to Dutch updates the page heading", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /settings|instellingen/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /settings|instellingen/i })).toBeVisible();

  const languageSelect = page.getByRole("combobox", { name: /language|taal/i });
  await languageSelect.selectOption("nl");

  await expect(page.getByRole("heading", { level: 2, name: /instellingen/i })).toBeVisible({ timeout: 5_000 });
});
