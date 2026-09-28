import { expect, test, type Page } from "@playwright/test";
import { openOfficeOutline } from "../support/office-outline.js";

/**
 * Phase 7-O Task 9f-5: three defects seen in the Task 9f current-build screenshots. AR-03
 * "Several requests" (the rail's stepper) and AR-02 frame 6 (evidence with an obvious way back).
 */

/** Hit tests at the centre and four inset corners land on the control itself. */
async function expectUncovered(page: Page, name: string) {
  const control = page.getByRole("button", { name, exact: true });
  const covered = await control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const inset = 3;
    const points = [
      [box.x + box.width / 2, box.y + box.height / 2],
      [box.left + inset, box.top + inset],
      [box.right - inset, box.top + inset],
      [box.left + inset, box.bottom - inset],
      [box.right - inset, box.bottom - inset],
    ];
    return points.flatMap(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      return hit && (hit === element || element.contains(hit))
        ? []
        : [`(${Math.round(x!)},${Math.round(y!)}) ${hit?.outerHTML.slice(0, 60) ?? "nothing"}`];
    });
  });
  expect(covered, `${name} is covered by another element`).toStrictEqual([]);
}

test("@e2e Phase 7-O the rail's Previous and Next read on one line", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "1 blocked · 1 review" }).click();
  const rail = page.getByRole("complementary", { name: "Manager attention" });
  const railBox = (await rail.boundingBox())!;
  for (const name of ["Previous item", "Next item"]) {
    const button = rail.getByRole("button", { name });
    // Lines of text, counted from the rendered text boxes; min-height makes box height useless.
    const lines = await button.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
    });
    expect(lines, `${name} wraps`).toBe(1);
    const box = (await button.boundingBox())!;
    expect(box.x + box.width, `${name} runs outside the rail`).toBeLessThanOrEqual(
      railBox.x + railBox.width + 0.5,
    );
  }
});

test("@e2e Phase 7-O an open evidence record leaves the way back uncovered", async ({ page }) => {
  await page.goto("/");
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  await page.getByRole("button", { name: "Open Browser evidence, version 1" }).click();
  await expect(page.getByRole("dialog", { name: "Evidence: evidence_browser v1" })).toBeVisible();
  await expectUncovered(page, "Back to inspector");
  await expectUncovered(page, "Back to office");
});

test("@e2e Phase 7-O an open record's plain sentence is not smaller than its heading", async ({
  page,
}) => {
  await page.goto("/");
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  await page.getByRole("button", { name: "Open Browser evidence, version 1" }).click();
  const record = page.getByRole("dialog", { name: "Evidence: evidence_browser v1" });
  await expect(record).toBeVisible();
  const size = (selector: string) =>
    record
      .locator(selector)
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  // AR-02 frame 6, rule 10: the finding is read first, so it may not be demoted below the
  // identifier heading by a general Library paragraph rule.
  expect(await size(".focused-evidence-plain")).toBeGreaterThanOrEqual(await size("h3"));
});
