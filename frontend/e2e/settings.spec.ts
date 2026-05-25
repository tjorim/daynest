import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("settings timezone and language controls are visible", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
  await login(page);
  await page.getByRole("link", { name: /settings|instellingen/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /settings|instellingen/i })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /language|taal/i })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /timezone|tijdzone/i })).toBeVisible();
});

test("switching language to Dutch updates the page heading", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
  await login(page);
  await page.getByRole("link", { name: /settings|instellingen/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /settings|instellingen/i })).toBeVisible();

  const languageSelect = page.getByRole("combobox", { name: /language|taal/i });
  await languageSelect.selectOption("nl");

  await expect(page.getByRole("heading", { level: 2, name: /instellingen/i })).toBeVisible({ timeout: 5_000 });
});
