import { test, expect } from "@playwright/test";

// Bootstrap is imported into a named layer below Tailwind's utilities, so a utility class beats
// `.btn`, `.form-control` and friends. An unlayered Bootstrap rule would silently beat it instead.
test("Bootstrap sits in a cascade layer below Tailwind utilities", async ({ page }) => {
  await page.goto("/today");
  await page.waitForLoadState("networkidle");

  // The production build splits the layer order into blocks and statements, so read both.
  const result = await page.evaluate(() => {
    const order: string[] = [];
    const unlayered: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSLayerStatementRule) order.push(...rule.nameList);
        else if (rule instanceof CSSLayerBlockRule) order.push(rule.name);
        else if (rule instanceof CSSStyleRule) unlayered.push(rule.selectorText);
      }
    }
    return { order, unlayered };
  });

  const unique = [...new Set(result.order)];
  expect(unique.indexOf("bootstrap")).toBeGreaterThanOrEqual(0);
  expect(unique.indexOf("bootstrap")).toBeLessThan(unique.indexOf("utilities"));
  expect(
    result.unlayered.filter((selector) => /^\.(btn|form-control|card)$/.test(selector)),
  ).toEqual([]);
});

// Tailwind utilities carry the `tw:` prefix while Bootstrap is loaded. Bootstrap's `!important`
// spacing utilities would otherwise beat a same-named Tailwind class with a different value
// (Bootstrap `mt-4` is 1.5rem, Tailwind `mt-4` is 1rem). Classes below are scanned from this spec.
test("prefixed Tailwind utilities are not shadowed by Bootstrap's spacing scale", async ({
  page,
}) => {
  await page.goto("/today");
  await page.waitForLoadState("networkidle");

  const margins = await page.evaluate(() => {
    const measure = (className: string) => {
      const element = document.createElement("div");
      element.className = className;
      document.body.append(element);
      const value = getComputedStyle(element).marginTop;
      element.remove();
      return value;
    };
    return {
      bootstrap: measure("mt-4"),
      tailwind: measure("tw:mt-4"),
      prefixOnly: measure("mt-6"),
    };
  });

  expect(margins.bootstrap).toBe("24px");
  expect(margins.tailwind).toBe("16px");
  // Unprefixed Tailwind classes are not generated, so `mt-6` matches nothing.
  expect(margins.prefixOnly).toBe("0px");
});
