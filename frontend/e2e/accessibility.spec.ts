import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

const ROUTES = [
  "today",
  "calendar",
  "templates",
  "settings",
  "medication",
  "meal-plan",
  "shopping",
  "stats",
];
test.describe.configure({ mode: "parallel" });

for (const route of ROUTES) {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [1280, 390]) {
      test(`${route} is accessible in ${theme} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((value) => localStorage.setItem("daynest-theme", value), theme);
        await page.goto("/");
        await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
        const link = page.locator(`nav a[href="/${route}"]`).first();
        if (!(await link.isVisible()))
          await page.getByRole("button", { name: "Menu", exact: true }).click();
        await link.click();
        // Assert content, so a lazy-route error or pending screen cannot pass axe instead.
        await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
        if (route === "calendar")
          await expect(
            page.locator("[data-slot=daynest-calendar] .sx__calendar-wrapper"),
          ).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        let audit = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
        // Specialized vendor renderer: baseline-reproduced exceptions are recorded in
        // docs/ui-coverage-validation.md. Its surrounding app controls remain included.
        if (route === "calendar")
          audit = audit.exclude("[data-slot=daynest-calendar] .sx__calendar-wrapper");
        const results = await audit.analyze();
        expect(
          results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) })),
        ).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      });
    }
  }
}
