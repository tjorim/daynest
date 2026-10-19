import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const kind of ["routine", "chore"]) {
  test(`${kind} modal protects drafts, traps focus and returns focus`, async ({ page }) => {
    await page.goto("/templates");
    const trigger = page.getByRole("button", { name: `New ${kind}` });
    await expect(page.getByText("Morning routine", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: `New ${kind}`, exact: true });
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    const name = dialog.getByLabel(`${kind === "routine" ? "Routine" : "Chore"} name`);
    await name.fill("Unsaved draft");
    // Outside press must use the same dirty guard as keyboard and buttons.
    await page.mouse.click(2, 2);
    const confirm = page.getByRole("dialog", { name: "Discard unsaved changes?" });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole("button", { name: "Continue editing" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirm).toHaveCount(0);
    await expect(name).toHaveValue("Unsaved draft");
    await cancel.click();
    await confirm.getByRole("button", { name: "Discard changes" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(name).toHaveValue("");
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [1280, 375]) {
    test(`editors are accessible in ${theme} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/templates");
      await expect(page.getByText("Morning routine", { exact: true })).toBeVisible();
      for (const kind of ["routine", "chore"]) {
        await page.getByRole("button", { name: `New ${kind}` }).click();
        const dialog = page.getByRole("dialog", { name: `New ${kind}`, exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
        expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        const results = await new AxeBuilder({ page })
          .include(".editor-dialog-popup")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(results.violations).toEqual([]);
        await testInfo.attach(`${kind}-${theme}-${width}`, {
          body: await page.screenshot({ path: `/tmp/daynest-${kind}-${theme}-${width}.png` }),
          contentType: "image/png",
        });
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      }
    });
  }
}
