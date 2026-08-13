import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const state of ["ready", "fallback"] as const) {
  test(`@a11y Phase 4 camera controls have no detectable WCAG violations in ${state}`, async ({
    page,
  }) => {
    await page.goto("/?surface=pixi-probe");
    const scene = page.getByRole("main", { name: "Phase 4 Pixi scene probe" });
    const canvas = scene.locator('canvas[data-scene-renderer="pixi"]');
    await expect(canvas).toHaveCount(1);

    if (state === "fallback") {
      await canvas.dispatchEvent("webglcontextlost");
      await expect(page.getByRole("button", { name: "Retry canvas" })).toBeVisible();
    }

    const results = await new AxeBuilder({ page }).include(".pixi-probe").analyze();
    expect(results.violations).toEqual([]);
  });
}
