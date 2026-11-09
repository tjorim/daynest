import { expect, test } from "@playwright/test";

test("the mock worker keeps control across navigation and reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: /today|vandaag/i })).toBeVisible();

  const workerScripts = () =>
    page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.map((registration) => new URL(registration.active!.scriptURL).pathname);
    });

  await expect.poll(workerScripts).toEqual(["/mockServiceWorker.js"]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: /today|vandaag/i })).toBeVisible();
  await expect.poll(workerScripts).toEqual(["/mockServiceWorker.js"]);

  await page.getByRole("link", { name: /calendar|kalender/i }).click();
  await expect(page.locator("[data-slot=daynest-calendar] .sx__calendar-wrapper")).toBeVisible();
});
