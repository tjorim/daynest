import { test, expect } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`meal planner keeps days in one grid row at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/meal-plan");
    if (width === 1280) {
      const previous = await page.getByRole("button", { name: "Previous week" }).boundingBox();
      const next = await page.getByRole("button", { name: "Next week" }).boundingBox();
      expect(previous!.y).toBe(next!.y);
    }
    const days = page.locator(".meal-plan-day-header");
    await expect(days).toHaveCount(7);
    const bounds = await days.evaluateAll((elements) =>
      elements.map((element) => {
        const { top, left } = element.getBoundingClientRect();
        return { top, left };
      }),
    );
    expect(new Set(bounds.map(({ top }) => top)).size).toBe(1);
    expect(bounds[6]!.left).toBeGreaterThan(bounds[0]!.left);
    const slot = await page.locator(".meal-slot-card").first().boundingBox();
    expect(slot!.y).toBeGreaterThan(bounds[0]!.top);
  });
}
