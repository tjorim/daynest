import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

type DialogCase = {
  name: string;
  path: string;
  open: (page: Page) => Promise<Locator>;
  dialogName: string | RegExp;
  /** Control that must hold focus when the dialog opens. */
  initialFocus: (dialog: Locator) => Locator;
};

const cases: DialogCase[] = [
  {
    name: "medication",
    path: "/medication",
    open: async (page) => {
      const trigger = page.getByRole("button", { name: "Edit", exact: true }).first();
      await trigger.focus();
      await page.keyboard.press("Enter");
      return trigger;
    },
    dialogName: "Edit medication plan",
    initialFocus: (dialog) => dialog.getByRole("button", { name: "Close", exact: true }),
  },
  {
    name: "meal slot",
    path: "/meal-plan",
    open: async (page) => {
      const trigger = page.locator(".meal-slot-card:enabled").first();
      await trigger.focus();
      await page.keyboard.press("Enter");
      return trigger;
    },
    dialogName: "Edit meal slot",
    initialFocus: (dialog) => dialog.getByRole("button", { name: "Cancel" }).first(),
  },
  {
    name: "shopping list",
    path: "/meal-plan",
    open: async (page) => {
      const trigger = page.getByRole("button", { name: "Generate shopping list" }).first();
      await trigger.focus();
      await page.keyboard.press("Enter");
      return trigger;
    },
    dialogName: "Generate shopping list",
    initialFocus: (dialog) => dialog.getByRole("button", { name: "Cancel" }).first(),
  },
  {
    name: "search",
    path: "/",
    open: async (page) => {
      const trigger = page.getByRole("button", { name: "Search", exact: true });
      await trigger.focus();
      await page.keyboard.press("Enter");
      return trigger;
    },
    dialogName: "Search",
    initialFocus: (dialog) => dialog.getByRole("searchbox"),
  },
];

for (const item of cases) {
  test.describe(`${item.name} dialog`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(item.path);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("focus, keyboard, backdrop dismissal and focus return", async ({ page }) => {
      const trigger = await item.open(page);
      const dialog = page.getByRole("dialog", { name: item.dialogName, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("aria-modal", "true");

      const first = item.initialFocus(dialog);
      await expect(first).toBeFocused();

      // Focus stays inside the dialog however far Tab travels.
      for (let step = 0; step < 14; step += 1) {
        await page.keyboard.press("Tab");
        await expect
          .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
          .toBe(true);
      }
      for (let step = 0; step < 14; step += 1) {
        await page.keyboard.press("Shift+Tab");
        await expect
          .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
          .toBe(true);
      }

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();

      await item.open(page);
      await expect(dialog).toBeVisible();
      await page.mouse.click(2, 2);
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });

    for (const theme of ["light", "dark"] as const) {
      for (const width of [1280, 375]) {
        test(`is accessible in ${theme} at ${width}px`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width, height: 800 });
          await page.emulateMedia({ colorScheme: theme });
          await item.open(page);
          const dialog = page.getByRole("dialog", { name: item.dialogName, exact: true });
          await expect(dialog).toBeVisible();
          await expect(dialog).toBeInViewport();
          expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
          expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
          const results = await new AxeBuilder({ page })
            .include('[role="dialog"]')
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          expect(
            results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) })),
          ).toEqual([]);
          await testInfo.attach(`${item.name}-${theme}-${width}`, {
            body: await page.screenshot({
              path: `/tmp/daynest-dialog-${item.name.replace(" ", "-")}-${theme}-${width}.png`,
            }),
            contentType: "image/png",
          });
        });
      }
    }
  });
}
