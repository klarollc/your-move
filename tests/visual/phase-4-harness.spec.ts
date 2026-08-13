import { expect, test } from "@playwright/test";

test("@visual Phase 4 graybox office captures a deterministic current build", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("main", { name: "CuckCode office workspace" })).toBeVisible();
  await expect(page.locator('canvas[data-scene-renderer="pixi"]')).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Office outline" })).toBeVisible();
  expect(testInfo.project.name).toMatch(/^chromium-(1440|1280)$/u);
  expect((await page.screenshot()).byteLength).toBeGreaterThan(100);
});
