import { expect, test } from "@playwright/test";
import { openOfficeOutline } from "../support/office-outline.js";

test("@visual Phase 4 graybox office captures a deterministic current build", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("main", { name: "CuckCode office workspace" })).toBeVisible();
  await expect(page.locator('svg[data-scene-renderer="svg"]')).toHaveCount(1);
  // Task 9e (P-4): the office fills the surface; the outline is one action away.
  await openOfficeOutline(page);
  await expect(page.getByRole("region", { name: "Office outline" })).toBeVisible();
  expect(testInfo.project.name).toMatch(/^chromium-(1440|1280)$/u);
  expect((await page.screenshot()).byteLength).toBeGreaterThan(100);
});
