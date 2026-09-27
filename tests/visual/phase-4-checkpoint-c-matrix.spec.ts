import { expect, test } from "@playwright/test";
import { OFFICE_FIXTURES } from "../../apps/web/src/office-fixtures/index.js";
import { openOfficeOutline } from "../support/office-outline.js";

// Phase 7-O Task 6 (P-4): the revision is the length of the canonical default log, not a literal.
const revision = OFFICE_FIXTURES.default!.events.length;

test("@visual Phase 4 captures blocked and offline truth", async ({ page }, testInfo) => {
  for (const state of ["permission-denied", "offline"] as const) {
    await page.goto(`/?state=${state}`);
    // Task 9e (P-4, A-4): the cause sits in the status notice; the outline is on demand.
    await expect(page.getByTestId("workspace-notice")).toBeVisible();
    await expect(page.getByTestId("workspace-cause")).not.toContainText(
      `Canonical workspace revision ${revision} is current`,
    );
    await page.screenshot({ path: testInfo.outputPath(`${state}.png`) });
  }
});

test("@visual Phase 4 captures reconnect recovery", async ({ page }, testInfo) => {
  await page.goto("/?state=offline");
  await page.getByRole("button", { name: "Reconnect runtime" }).click();
  // Task 9e (A-4): once current, the notice goes and the revision is stated in the outline.
  await expect(page.getByTestId("workspace-notice")).toHaveCount(0);
  await openOfficeOutline(page);
  await expect(page.getByTestId("workspace-cause")).toContainText(
    `Canonical workspace revision ${revision} is current`,
  );
  await page.screenshot({ path: testInfo.outputPath("reconnected.png") });
});

test("@visual Phase 4 captures keyboard-first focus", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Open the Office outline" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("keyboard-focus.png") });
});
