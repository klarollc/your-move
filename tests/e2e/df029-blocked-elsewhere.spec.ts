import { expect, test } from "@playwright/test";

import { openOfficeOutline } from "../support/office-outline.js";

/**
 * DF-029 Task 6 (spec §10, B-4; AR-03 column 1). The `blocked-elsewhere` log: the Test Engineer is
 * blocked on the Implementation Engineer and nothing is asked of the manager. Runs at both D-07
 * viewports.
 */
test("@e2e DF-029 a blocker that is not on the manager says who can resolve it", async ({
  page,
}) => {
  await page.goto("/?fixture=blocked-elsewhere");
  // Only the graybox review asks the manager: the bar does not count the blocker.
  const summary = page.getByRole("button", { name: "1 review", exact: true });
  await expect(summary).toBeVisible();

  await openOfficeOutline(page);
  const card = page
    .getByRole("list", { name: "Office people" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Test Engineer" }) });
  await expect(card).toContainText("Blocked");
  await expect(card).not.toContainText("Needs you");

  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  const inspector = page.getByRole("complementary", { name: "Entity inspector" });
  const needs = inspector
    .getByText("What needs you", { exact: true })
    .and(page.locator("dt"))
    .locator("xpath=following-sibling::dd[1]");
  await expect(needs).toHaveText("Nothing needs you. Implementation Engineer can resolve it.");
  await expect(
    inspector
      .getByText("Why", { exact: true })
      .and(page.locator("dt"))
      .locator("xpath=following-sibling::dd[1]"),
  ).toContainText("needs the Implementation Engineer's current build");

  await summary.click();
  const rail = page.getByRole("complementary", { name: "Manager attention" });
  await expect(rail).toContainText("Deliver the approved graybox slice");
  await expect(rail).not.toContainText("Provide current browser evidence");
});
