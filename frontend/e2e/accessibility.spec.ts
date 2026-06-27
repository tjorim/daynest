import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

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
    test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");
    await login(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}
