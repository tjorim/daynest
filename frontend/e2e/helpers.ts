import { expect, type Page } from "@playwright/test";

export async function login(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("E2E_EMAIL and E2E_PASSWORD must be set");

  await page.goto("/auth");

  await page.getByRole("button", { name: /sign in|aanmelden/i }).click();

  const emailField = page.getByLabel(/email/i);
  const passwordField = page.getByLabel(/password/i);

  await emailField.fill(email);
  await passwordField.fill(password);
  await page.getByRole("button", { name: /sign in|aanmelden/i }).click();

  await page.waitForURL(/today|home/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 2, name: /today|vandaag/i })).toBeVisible();
}
