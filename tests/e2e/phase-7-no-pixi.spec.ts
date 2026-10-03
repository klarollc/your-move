import { expect, test } from "@playwright/test";

/**
 * Phase 7 Task 4 (R-1). The Pixi probe surface is gone: its old address opens the office, drawn as
 * SVG, with no canvas anywhere.
 */
test("@e2e Phase 7 the retired Pixi probe address opens the office without a canvas", async ({
  page,
}) => {
  await page.goto("/?surface=pixi-probe");
  const scene = page.getByRole("region", { name: "Office scene" });
  await expect(scene.locator('svg[data-scene-renderer="svg"]')).toHaveCount(1);
  await expect(page.getByRole("main", { name: "Phase 4 Pixi scene probe" })).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
});
