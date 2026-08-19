import { expect, test, type Page } from "@playwright/test";

import { evidenceOutputPath } from "../support/evidence-output.js";

const roleNames = [
  "Delivery Lead",
  "Product Designer",
  "Implementation Engineer",
  "Test Engineer",
  "Visual QA Reviewer",
  "Release Reviewer",
];

function captureBrowserFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      failures.push(`console:${message.type()}:${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    failures.push(`request:${request.method()}:${request.url()}`);
  });
  return failures;
}

test("@visual Phase 4 layout trial renders the canonical reset without overlays", async ({
  page,
}, testInfo) => {
  const browserFailures = captureBrowserFailures(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?surface=layout-trial");

  await expect(page.getByRole("main", { name: "Phase 4 graybox layout trial" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Manager attention" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Layout measurements" })).toHaveCount(0);
  await expect(page.getByText("Manager desk", { exact: true })).toBeVisible();
  await expect(page.getByText("Delivery area", { exact: true })).toBeVisible();

  await page.screenshot({
    path: evidenceOutputPath(
      testInfo,
      `phase-4/layout-trials/${testInfo.project.name}-canonical-reset.png`,
    ),
    fullPage: true,
  });
  expect(browserFailures).toEqual([]);
});

test("@visual Phase 4 layout trial keeps the whole office legible with both overlays", async ({
  page,
}, testInfo) => {
  const browserFailures = captureBrowserFailures(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?surface=layout-trial&overlays=both");

  await expect(page.getByRole("main", { name: "Phase 4 graybox layout trial" })).toBeVisible();
  await expect(page.getByText("Manager desk", { exact: true })).toBeVisible();
  await expect(page.getByText("Project library", { exact: true })).toBeVisible();
  await expect(page.getByText("Collaboration table", { exact: true })).toBeVisible();
  await expect(page.getByText("Review station", { exact: true })).toBeVisible();
  await expect(page.getByText("Delivery area", { exact: true })).toBeVisible();
  for (const roleName of roleNames) {
    await expect(page.getByRole("listitem").filter({ hasText: roleName })).toBeVisible();
  }

  await page.screenshot({
    path: evidenceOutputPath(
      testInfo,
      `phase-4/layout-trials/${testInfo.project.name}-both-overlays.png`,
    ),
    fullPage: true,
  });
  expect(browserFailures).toEqual([]);
});
