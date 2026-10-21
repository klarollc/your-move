import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { evidenceOutputPath } from "../support/evidence-output.js";
import { routeHostedApi, signIn, streetDrafts } from "../support/your-move-hosted.js";

/**
 * Structural pass (2026-10-20) captures, which double as the deferred Section 6 walk-through
 * screenshots: the street with nothing selected, the street with a sheet open, the draft sheet, and
 * List. The brief names 1280×800 and 1920×945, so one project run sets both viewports itself.
 * Each capture is full length: the hosted page scrolls inside `.hosted-workspace`, and the sheet sits
 * beneath the street by design, so a viewport-only frame would cut the composition under review.
 * Its top `height` pixels are what the viewport shows. All data is synthetic and browser-routed.
 */
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 945 },
] as const;

async function capture(page: Page, testInfo: TestInfo, folder: string, name: string) {
  await page.addStyleTag({
    content:
      "html, body, #app, .hosted-workspace { height: auto !important; overflow: visible !important; }",
  });
  const path = evidenceOutputPath(testInfo, `your-move-structural-pass/${folder}/${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: true, animations: "disabled", caret: "hide" });
}

/** Back to a clean surface: the routed session stays signed in across the reload. */
async function reopen(page: Page) {
  await page.reload();
  await expect(page.getByRole("group", { name: "Work view" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test.describe("Your Move structural pass captures", () => {
  for (const viewport of VIEWPORTS) {
    const folder = `${viewport.width}x${viewport.height}`;
    test(`@visual Your Move structural pass at ${folder}`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium-1440",
        "One run sets both brief viewports itself.",
      );
      await page.setViewportSize(viewport);
      await routeHostedApi(page, streetDrafts);
      await signIn(page);
      await expect(page.getByText("7 windows lit · oldest first")).toBeVisible();
      const loaded = await page.evaluate(() =>
        [...document.fonts]
          .filter((face) => face.status === "loaded")
          .map((face) => face.family.replaceAll('"', "")),
      );
      expect(loaded).toEqual(expect.arrayContaining(["Literata", "Commissioner"]));

      await capture(page, testInfo, folder, "01-street");

      await reopen(page);
      await page
        .getByRole("group", { name: "The street" })
        .getByRole("button", { name: "Add a setup section — Review a proposed change" })
        .click();
      await expect(page.getByRole("region", { name: "Add a setup section" })).toBeVisible();
      await capture(page, testInfo, folder, "02-street-sheet-open");

      await reopen(page);
      await page.getByLabel(/What should get done/).fill("Add a changelog page to the docs site");
      await page.getByRole("button", { name: "Draft it" }).click();
      await expect(page.getByRole("region", { name: "New work draft" })).toBeVisible();
      await capture(page, testInfo, folder, "03-draft-sheet");

      await reopen(page);
      await page.getByRole("button", { name: "List", exact: true }).click();
      await expect(page.getByRole("table")).toBeVisible();
      await capture(page, testInfo, folder, "04-list");
    });
  }
});
