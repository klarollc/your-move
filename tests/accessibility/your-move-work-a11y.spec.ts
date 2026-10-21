import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { routeHostedApi, signIn, streetDrafts } from "../support/your-move-hosted.js";

/** Structural pass: every Work surface composition stays free of detectable violations. */
async function expectNoViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, state).toEqual([]);
}

test("@a11y Your Move Work surface has no automatically detectable violations", async ({
  page,
}) => {
  await routeHostedApi(page, streetDrafts);
  await signIn(page);
  await expectNoViolations(page, "street, nothing selected");

  await page
    .getByRole("group", { name: "The street" })
    .getByRole("button", { name: "Add a setup section — Review a proposed change" })
    .click();
  await expect(page.getByRole("region", { name: "Add a setup section" })).toBeVisible();
  await expectNoViolations(page, "street with the correspondence sheet open");

  await page.getByLabel(/What should get done/).fill("Add a changelog page to the docs site");
  await page.getByRole("button", { name: "Draft it" }).click();
  await expect(page.getByRole("region", { name: "New work draft" })).toBeVisible();
  await expectNoViolations(page, "draft sheet");

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expectNoViolations(page, "List, waiting work");
  await page.getByRole("button", { name: "All work & history" }).click();
  await expectNoViolations(page, "List, all work and history");
});
