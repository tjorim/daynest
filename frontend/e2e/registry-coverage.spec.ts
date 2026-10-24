import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };

for (const [locale, messages] of [
  ["en", en],
  ["nl", nl],
] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [1280, 390]) {
      test(`registry coverage ${locale} ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((value) => localStorage.setItem("daynest-theme", value), theme);
        await page.addInitScript((value) => localStorage.setItem("daynest_lang", value), locale);
        await page.goto("/shopping");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const filters = page.getByRole("group", { name: messages.shopping_tabs_label });
        const active = filters.getByRole("button", { name: messages.status_active, exact: true });
        const archived = filters.getByRole("button", {
          name: messages.shopping_archived,
          exact: true,
        });
        await expect(active).toHaveAttribute("aria-pressed", "true");
        await archived.focus();
        await page.keyboard.press("Space");
        await expect(archived).toHaveAttribute("aria-pressed", "true");
        await expect(active).toHaveAttribute("aria-pressed", "false");
        await expect(archived).toBeFocused();
        await archived.hover();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await testInfo.attach(`shopping-${locale}-${theme}-${width}`, {
          body: await page.screenshot({
            path: `/tmp/daynest-1137/shopping-${locale}-${theme}-${width}.png`,
          }),
          contentType: "image/png",
        });
        await active.click();
        await expect(active).toHaveAttribute("aria-pressed", "true");
        const trigger = page.getByRole("button", { name: messages.app_search, exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: messages.app_search, exact: true });
        const input = dialog.getByRole("searchbox", { name: messages.app_search, exact: true });
        await expect(input).toBeFocused();
        await input.fill("routine");
        const result = dialog.getByRole("button", { name: /Morning routine/ });
        await expect(result).toBeVisible();
        await page.keyboard.press("ArrowDown");
        await expect(result).toBeFocused();
        await result.hover();
        expect(
          (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
        ).toEqual([]);
        await testInfo.attach(`search-${locale}-${theme}-${width}`, {
          body: await page.screenshot({
            path: `/tmp/daynest-1137/search-${locale}-${theme}-${width}.png`,
          }),
          contentType: "image/png",
        });
        await page.keyboard.press("ArrowUp");
        await expect(input).toBeFocused();
        await input.fill("in");
        const rows = dialog.locator("button[id]");
        await expect.poll(() => rows.count()).toBeGreaterThan(1);
        await page.keyboard.press("ArrowDown");
        await expect(rows.first()).toBeFocused();
        await page.keyboard.press("End");
        await expect(rows.last()).toBeFocused();
        await page.keyboard.press("Home");
        await expect(rows.first()).toBeFocused();
        await page.keyboard.press("ArrowUp");
        await expect(input).toBeFocused();
        await input.fill("zz-no-results");
        await expect(result).toHaveCount(0);
        await expect(dialog.getByRole("status")).toContainText(
          messages.search_no_results.replace("{query}", "zz-no-results"),
        );
        await page.keyboard.press("ArrowDown");
        await expect(input).toBeFocused();
        await input.fill("r");
        await expect(
          dialog.getByText(messages.search_min_chars.replace("{min}", "2")),
        ).toBeVisible();
        await expect(result).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await trigger.click();
        await dialog.getByRole("searchbox").fill("routine");
        await expect(result).toBeVisible();
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/templates$/);
        await expect(dialog).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      });
    }
  }
}
