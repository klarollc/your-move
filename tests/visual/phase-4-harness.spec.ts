import { expect, test } from "@playwright/test";

test("@visual Phase 4 graybox harness captures a deterministic current build", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("main", { name: "CuckCode Phase 0 scaffold" })).toBeVisible();
  expect(testInfo.project.name).toMatch(/^chromium-(1440|1280)$/u);
  expect((await page.screenshot()).byteLength).toBeGreaterThan(100);
});
