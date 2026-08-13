import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("@a11y Phase 4 office has no automatically detectable violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('canvas[data-scene-renderer="pixi"]')).toHaveCount(1);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
