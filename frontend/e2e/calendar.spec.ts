import { expect, test } from "@playwright/test";

test("calendar page opens from navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /calendar|kalender/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /calendar|kalender/i })).toBeVisible();
});

test("month navigation moves forward and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /calendar|kalender/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: /calendar|kalender/i })).toBeVisible();
  await page.waitForLoadState("networkidle"); // schedule-x attaches its toolbar slightly after paint

  // Calendar defaults to week view, where a single "Next period" click
  // doesn't necessarily cross a month boundary, so the range heading below
  // wouldn't reliably change. Switch to month view first.
  await page.getByRole("button", { name: "Select View" }).click();
  await page.getByRole("button", { name: "Select View Month" }).click();

  const periodLabel = page.getByText(/20\d\d/).first();
  const initialHeading = await periodLabel.textContent();

  await page.getByRole("button", { name: "Next period" }).click();
  const nextHeading = await periodLabel.textContent();
  expect(nextHeading).not.toBe(initialHeading);

  await page.getByRole("button", { name: "Previous period" }).click();
  const backHeading = await periodLabel.textContent();
  expect(backHeading).toBe(initialHeading);
});
