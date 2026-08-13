import { expect, test } from "@playwright/test";

test("@e2e Phase 4 Library preserves lifecycle, evidence lanes, and spatial origin", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const scene = page.getByRole("region", { name: "Office scene" });
  const initialScene = await scene.boundingBox();

  await page.getByRole("button", { name: "Locate Project Library" }).click();
  const openLibrary = page.getByRole("button", { name: "Open Project Library" });
  await openLibrary.click();

  const library = page.getByRole("complementary", { name: "Project Library" });
  await expect(library).toBeVisible();
  expect((initialScene?.width ?? 0) - ((await scene.boundingBox())?.width ?? 0)).toBe(420);
  await expect(library.getByTestId("knowledge-status")).toHaveText([
    "authoritative",
    "approved",
    "provisional",
    "contested",
    "stale",
    "superseded",
    "rejected",
  ]);
  await expect(library.getByText("Complete — not approved")).toBeVisible();
  await expect(library.getByRole("region", { name: "Test evidence" })).toBeVisible();
  await expect(library.getByRole("region", { name: "Visual evidence" })).toBeVisible();
  await expect(library.getByRole("region", { name: "Release evidence" })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("Unauthorized roadmap");
  expect(await page.locator("body").innerText()).not.toContain("private chain of thought");

  const viewEvidence = page.getByRole("button", { name: "View Automated verification" });
  await viewEvidence.click();
  const focused = page.getByRole("dialog", { name: "Evidence: Automated verification" });
  await expect(focused).toContainText("agent_test_engineer");
  await page.getByRole("button", { name: "Locate origin in office" }).click();
  await expect(scene).toHaveAttribute("data-selected-entity-id", "agent_test_engineer");
  await page.getByRole("button", { name: "Close evidence" }).click();
  await expect(viewEvidence).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("project-library.png") });

  await page.getByRole("button", { name: "Close Library" }).click();
  await expect(page.getByRole("region", { name: "Office outline" })).toBeFocused();
});

test("@e2e Phase 4 review station opens its focused visual evidence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Locate Review station" }).click();
  await page.getByRole("button", { name: "Open Visual QA evidence" }).click();
  const focused = page.getByRole("dialog", { name: "Evidence: Visual QA review" });
  await expect(focused).toContainText("zone_review");
  await expect(focused).toContainText("Approved");
});
