import { expect, test } from "@playwright/test";
import { openOfficeOutline } from "../support/office-outline.js";

// Phase 7-O Tasks 8 and 8b (spec §6). The Test Engineer's Evidence link opens the Project Library
// at the recorded item and version, which since 8b is the office log's own evidence record. The
// unavailable path is covered by apps/web/src/evidence-link.component.test.tsx.
test("@e2e Phase 7-O an inspector Evidence link opens the log's record at its version", async ({
  page,
}) => {
  await page.goto("/");
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  const inspector = page.getByRole("complementary", { name: "Entity inspector" });
  const link = inspector.getByRole("button", { name: "Open Browser evidence, version 1" });
  await link.click();

  const library = page.getByRole("complementary", { name: "Project Library" });
  await expect(library).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Evidence link unavailable" })).toHaveCount(0);
  const focused = page.getByRole("dialog", { name: "Evidence: evidence_browser v1" });
  await expect(focused).toContainText("Failed");
  await expect(focused).toContainText("No summary recorded");
  await expect(focused).toContainText("work_browser_evidence");

  await page.keyboard.press("Escape");
  await expect(focused).toHaveCount(0);
  await expect(library).toBeFocused();
  await page.getByRole("button", { name: "Back to inspector" }).click();
  await expect(link).toBeFocused();
});

// Phase 7-O Task 9f-4 (AR-02 frame 6; constitution rule 3): opened evidence takes the surface
// below the project bar, rather than squeezing the office into a strip beside it.
test("@e2e Phase 7-O opened evidence takes the whole surface below the bar", async ({ page }) => {
  await page.goto("/");
  const scene = page.getByRole("region", { name: "Office scene" });
  const sceneBox = await scene.boundingBox();
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  await page.getByRole("button", { name: "Open Browser evidence, version 1" }).click();
  const library = page.getByRole("complementary", { name: "Project Library" });
  await expect(library).toBeVisible();
  const libraryBox = await library.boundingBox();
  expect(Math.abs(libraryBox!.x - sceneBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(libraryBox!.width - sceneBox!.width)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Back to office" })).toBeVisible();
});
