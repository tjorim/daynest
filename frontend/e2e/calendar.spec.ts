import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("calendar page opens from navigation", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
  await login(page);
  await page.getByRole("link", { name: /calendar|kalender/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /calendar|kalender/i })).toBeVisible();
});

test("month navigation moves forward and back", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
  await login(page);
  await page.getByRole("link", { name: /calendar|kalender/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /calendar|kalender/i })).toBeVisible();

  const initialHeading = await page.getByRole("paragraph").filter({ hasText: /20\d\d/ }).first().textContent();

  await page.getByRole("button", { name: /^next$|^volgende$/i }).click();
  const nextHeading = await page.getByRole("paragraph").filter({ hasText: /20\d\d/ }).first().textContent();
  expect(nextHeading).not.toBe(initialHeading);

  await page.getByRole("button", { name: /^prev$|^vorige$/i }).click();
  const backHeading = await page.getByRole("paragraph").filter({ hasText: /20\d\d/ }).first().textContent();
  expect(backHeading).toBe(initialHeading);
});
