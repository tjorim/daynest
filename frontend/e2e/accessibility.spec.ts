import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

const ROUTES = [
  { path: "/today", name: "today" },
  { path: "/calendar", name: "calendar" },
  { path: "/templates", name: "templates" },
  { path: "/settings", name: "settings" },
  { path: "/medication", name: "medication" },
  { path: "/shopping", name: "shopping" },
  { path: "/stats", name: "stats" },
];

for (const { path, name } of ROUTES) {
  test(`${name} page has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}
