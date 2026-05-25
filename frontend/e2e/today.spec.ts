import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("today page loads and shows sections", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
  await login(page);
  await expect(page.getByRole("heading", { level: 2, name: /today|vandaag/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /refresh|vernieuwen/i })).toBeVisible();
});

test("quick add planned item appears in the list", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
  await login(page);

  const quickAddButton = page.getByRole("button", { name: /quick add|snel toevoegen/i });
  await expect(quickAddButton).toBeVisible();
  await quickAddButton.click();

  const titleInput = page.getByPlaceholder(/plan title for today|plantitel voor vandaag/i);
  await expect(titleInput).toBeVisible();
  const itemTitle = `E2E test item ${Date.now()}`;
  await titleInput.fill(itemTitle);
  await page.getByRole("button", { name: /^add$|^toevoegen$/i }).click();

  await expect(page.getByText(itemTitle)).toBeVisible({ timeout: 10_000 });
});
