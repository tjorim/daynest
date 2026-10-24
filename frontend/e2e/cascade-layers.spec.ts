import { test, expect } from "@playwright/test";

test("vendor styles remain layered below utilities", async ({ page }) => {
  await page.goto("/calendar");
  await page.waitForLoadState("networkidle");
  const order = await page.evaluate(() =>
    Array.from(document.styleSheets).flatMap((sheet) =>
      Array.from(sheet.cssRules).flatMap((rule) =>
        rule instanceof CSSLayerStatementRule
          ? Array.from(rule.nameList)
          : rule instanceof CSSLayerBlockRule
            ? [rule.name]
            : [],
      ),
    ),
  );
  const unique = [...new Set(order)];
  expect(unique.indexOf("schedule-x")).toBeLessThan(unique.indexOf("utilities"));
});

test("unprefixed utilities use the Tailwind spacing scale", async ({ page }) => {
  await page.goto("/today");
  const margin = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "mt-4";
    document.body.append(probe);
    const value = getComputedStyle(probe).marginTop;
    probe.remove();
    return value;
  });
  expect(margin).toBe("16px");
});
