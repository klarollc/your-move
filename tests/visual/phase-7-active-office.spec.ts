import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test } from "@playwright/test";
import { RECONCILIATION_B_CLARITY } from "@cuckcode/ui-system/scene";

import { evidenceOutputPath } from "../support/evidence-output.js";

/**
 * Phase 7 Task 3b (plan Q-3; rulings G-1 to G-3). The default office as the app now draws it, for
 * the owner to compare beside AR-01 at both viewports. Captured from the production build, as the
 * Phase 7-O captures are. A picture proves something rendered, not what: before the capture, the
 * Active system's art is in the scene, none of Phase 6's baked labels or fixed figures is, every
 * person and zone carries its DOM label, and the office's face is loaded.
 */
const ORIGIN = "http://127.0.0.1:4174";

test("@visual Phase 7 the Active office, default state", async ({ page }, testInfo) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`${ORIGIN}/`);
  const scene = page.getByRole("region", { name: "Office scene" });
  const art = scene.locator('svg[data-scene-renderer="svg"] [data-scene-art]');
  await expect(art).toHaveCount(1);
  expect(await art.locator("polygon").count()).toBeGreaterThan(0);
  // G-3 and G-2: no text and no figure drawn into the art.
  await expect(art.locator("text")).toHaveCount(0);
  const { figure, figureShade } = RECONCILIATION_B_CLARITY.palette;
  await expect(art.locator(`[fill="${figure}"], [fill="${figureShade}"]`)).toHaveCount(0);
  await expect(
    scene.getByRole("list", { name: "People and places in the office" }).getByRole("listitem"),
  ).toHaveCount(13);
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => face.family.replaceAll('"', "")),
  );
  expect(loaded).toContain("Fira Sans");
  expect(requests.filter((url) => !url.startsWith(ORIGIN))).toEqual([]);

  const path = evidenceOutputPath(
    testInfo,
    `phase-7/active-office/${testInfo.project.name}/default-office.png`,
  );
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: "disabled" });
});
