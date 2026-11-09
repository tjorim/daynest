import { expect, test } from "@playwright/test";

test("the mock worker keeps control across navigation and reload", async ({ page }) => {
  const startedWorkers: string[] = [];
  page.context().on("serviceworker", (worker) => {
    startedWorkers.push(new URL(worker.url()).pathname);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: /today|vandaag/i })).toBeVisible();

  const workerScripts = () =>
    page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.map((registration) => new URL(registration.active!.scriptURL).pathname);
    });

  await expect.poll(workerScripts).toEqual(["/mockServiceWorker.js"]);
  // An installing PWA worker can lose the race initially, then take over on a
  // later reload. Check workers that were started as well as the active one.
  for (let reload = 0; reload < 3; reload++) {
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: /today|vandaag/i })).toBeVisible();
    await expect.poll(workerScripts).toEqual(["/mockServiceWorker.js"]);
    expect(startedWorkers).not.toContain("/sw.js");
  }

  await page.getByRole("link", { name: /calendar|kalender/i }).click();
  await expect(page.locator("[data-slot=daynest-calendar] .sx__calendar-wrapper")).toBeVisible();
});
