import { expect, test, type Page } from "@playwright/test";

// One mechanism: ThemeContext resolves light | dark | auto into data-bs-theme on <html>, and the
// design tokens, Bootstrap and the Schedule-X calendar all follow it, never the OS setting alone.
const OS_SCHEMES = ["light", "dark"] as const;
const CHOICES = ["auto", "light", "dark"] as const;

const expectedTheme = (os: (typeof OS_SCHEMES)[number], choice: (typeof CHOICES)[number]) =>
  choice === "auto" ? os : choice;

// Resolve the token through a probe element, since custom properties are returned as authored.
const pageGradientStart = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--tw-color-page-from)";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });

async function openCalendar(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: /calendar|kalender/i }).click();
  await expect(page.locator(".daynest-calendar .sx__calendar-wrapper")).toBeVisible();
}

for (const os of OS_SCHEMES) {
  for (const choice of CHOICES) {
    test(`${choice} theme on a ${os} OS applies one theme to tokens and calendar`, async ({
      page,
    }) => {
      const expected = expectedTheme(os, choice);
      await page.emulateMedia({ colorScheme: os });
      await page.addInitScript((value) => localStorage.setItem("daynest-theme", value), choice);

      await page.goto("/today");
      await expect(page.locator("html")).toHaveAttribute("data-bs-theme", expected);
      const gradientStart = await pageGradientStart(page);
      // The dark surface values are near-black; the light ones near-white.
      expect(gradientStart).toBe(
        expected === "dark" ? "rgba(18, 18, 28, 0.98)" : "rgba(248, 249, 250, 0.95)",
      );

      await openCalendar(page);
      await expect(page.locator(".daynest-calendar .is-dark")).toHaveCount(
        expected === "dark" ? 1 : 0,
      );
    });
  }
}

test("auto follows the OS live, including the calendar", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openCalendar(page);
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "light");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  await expect(page.locator(".daynest-calendar .is-dark").first()).toBeAttached();
  expect(await pageGradientStart(page)).toBe("rgba(18, 18, 28, 0.98)");
});

test("an explicit choice ignores later OS changes and survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    if (!localStorage.getItem("daynest-theme")) localStorage.setItem("daynest-theme", "light");
  });
  await page.goto("/today");
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "light");

  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "light");
});

test("switching the theme restyles an open calendar without a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    if (!localStorage.getItem("daynest-theme")) localStorage.setItem("daynest-theme", "light");
  });
  await openCalendar(page);
  await expect(page.locator(".daynest-calendar .is-dark")).toHaveCount(0);

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  await expect(page.locator(".daynest-calendar .is-dark").first()).toBeAttached();

  // Dark -> auto on a light OS resolves back to light.
  await page.getByRole("button", { name: "Switch to auto mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "light");
  await expect(page.locator(".daynest-calendar .is-dark")).toHaveCount(0);
});
