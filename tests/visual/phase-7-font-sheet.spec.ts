import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test } from "@playwright/test";

import { evidenceOutputPath } from "../support/evidence-output.js";

/**
 * Phase 7 Task 1 (spec F-5, plan Q-4). The font sheet the owner captures in Windows Chromium
 * before any token changes. A picture of text proves something rendered, not that it was Fira:
 * every face the sheet uses must be loaded from this origin before the capture, and the sheet's
 * own readout must say so.
 */
const ORIGIN = "http://127.0.0.1:4174";
const FACES = [
  ["Fira Sans", "400"],
  ["Fira Sans", "500"],
  ["Fira Sans", "600"],
  ["Fira Sans", "700"],
  ["Fira Mono", "400"],
  ["Fira Mono", "500"],
  ["Fira Mono", "700"],
] as const;

test("@visual Phase 7 font sheet: Fira Sans and Fira Mono, loaded locally", async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`${ORIGIN}/?surface=font-sheet`);
  const sheet = page.getByRole("main", { name: "Font sheet" });
  await expect(sheet).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const loaded = await page.evaluate(() =>
    [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => `${face.family.replaceAll('"', "")} ${face.weight}`),
  );
  for (const [family, weight] of FACES) {
    expect(loaded, `${family} ${weight} did not load`).toContain(`${family} ${weight}`);
  }
  // Every sample on the sheet is drawn in the face it names, not a fallback.
  for (const [family, weight] of FACES) {
    const sample = sheet.locator(`[data-face="${family} ${weight}"]`).first();
    await expect(sample).toHaveCSS("font-family", new RegExp(`^"?${family}"?`, "u"));
    await expect(sample).toHaveCSS("font-weight", weight);
  }
  await expect(sheet.getByTestId("font-readout")).toHaveText(/All 7 faces loaded/u);
  expect(requests.filter((url) => !url.startsWith(ORIGIN))).toEqual([]);

  // The whole sheet is on screen: nothing the owner is asked to judge is cut off.
  const overflow = await sheet.evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(overflow, "the font sheet does not fit the viewport").toBeLessThanOrEqual(0);

  const path = evidenceOutputPath(
    testInfo,
    `phase-7/fonts/${testInfo.project.name}/font-sheet.png`,
  );
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: "disabled" });
});
