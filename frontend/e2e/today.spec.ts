import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("today page loads and shows sections", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
  await login(page);
  await expect(page.getByRole("heading", { level: 2, name: /today|vandaag/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /refresh|vernieuwen/i })).toBeVisible();
});
