import { expect, test } from "@playwright/test";

// Phase 7-O Task 8 (spec §6). The default office's Project Library is still the Phase 4 list, which
// does not hold the office log's browser evidence. The link must say so, with the ID and version,
// and must not open the Phase 4 test record in its place.
test("@e2e Phase 7-O an inspector Evidence link opens at its item and version, or says it cannot", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  const inspector = page.getByRole("complementary", { name: "Entity inspector" });
  const link = inspector.getByRole("button", { name: "Open evidence_browser v1" });
  await link.click();

  const library = page.getByRole("complementary", { name: "Project Library" });
  await expect(library).toBeVisible();
  const unavailable = page.getByRole("dialog", { name: "Evidence link unavailable" });
  await expect(unavailable).toContainText("evidence_browser");
  await expect(unavailable).toContainText("version 1");
  await expect(page.getByRole("dialog", { name: /^Evidence: / })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(unavailable).toHaveCount(0);
  await expect(library).toBeFocused();
  await page.getByRole("button", { name: "Close Library" }).click();
  await expect(link).toBeFocused();
});
