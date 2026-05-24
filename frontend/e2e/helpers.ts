import { expect, type Page } from "@playwright/test";

export async function login(page: Page) {
  await page.goto("/auth");

  const signInButton = page.getByRole("button", { name: /sign in|aanmelden/i });
  if (await signInButton.isVisible()) {
    await signInButton.click();
  }

  const emailField = page.getByLabel(/email/i);
  const passwordField = page.getByLabel(/password/i);

  if ((await emailField.count()) > 0 && (await passwordField.count()) > 0) {
    await emailField.fill(process.env.E2E_EMAIL ?? "test@example.com");
    await passwordField.fill(process.env.E2E_PASSWORD ?? "password");
    await page.getByRole("button", { name: /sign in|aanmelden/i }).click();
  }

  await page.waitForURL(/today|home/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 2, name: /today|vandaag/i })).toBeVisible();
}
