import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openOfficeOutline } from "../support/office-outline.js";

test("@a11y Phase 4 Library and focused evidence have no detectable violations", async ({
  page,
}) => {
  await page.goto("/");
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Locate Project Library" }).click();
  await page.getByRole("button", { name: "Open Project Library" }).click();
  await page.getByRole("button", { name: "View evidence_browser v1" }).click();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
