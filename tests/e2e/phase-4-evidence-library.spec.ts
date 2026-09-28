import { expect, test } from "@playwright/test";
import { OFFICE_FIXTURES } from "../../apps/web/src/office-fixtures/index.js";
import { openOfficeOutline } from "../support/office-outline.js";

const recordedKinds = [
  ...new Set(
    OFFICE_FIXTURES.default!.events.filter((event) => event.kind === "evidence.recorded").map(
      (event) => (event.payload as { kind: string }).kind,
    ),
  ),
];
const passedCount = OFFICE_FIXTURES.default!.events.filter(
  (event) =>
    event.kind === "evidence.recorded" && (event.payload as { result: string }).result === "passed",
).length;
const capitalize = (value: string) => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;

test("@e2e Phase 4 Library preserves lifecycle, evidence lanes, and spatial origin", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const scene = page.getByRole("region", { name: "Office scene" });
  // Measured from the office with nothing open (Task 9f-2, P-4).
  const initialScene = await scene.boundingBox();
  await openOfficeOutline(page);

  await page.getByRole("button", { name: "Locate Project Library" }).click();
  const openLibrary = page.getByRole("button", { name: "Open Project Library" });
  await openLibrary.click();

  const library = page.getByRole("complementary", { name: "Project Library" });
  await expect(library).toBeVisible();
  // Task 9f-4 (P-4; AR-02 frame 6): the Library takes the surface below the bar rather than
  // taking 420 px off the office.
  const libraryBox = await library.boundingBox();
  expect(Math.abs((libraryBox?.x ?? 0) - (initialScene?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((libraryBox?.width ?? 0) - (initialScene?.width ?? 0))).toBeLessThanOrEqual(1);
  await expect(library.getByTestId("knowledge-status")).toHaveText([
    "authoritative",
    "approved",
    "provisional",
    "contested",
    "stale",
    "superseded",
    "rejected",
  ]);
  // Every passed record in the log is complete and, with no approval recorded, not approved.
  await expect(library.getByText("Complete — not approved")).toHaveCount(passedCount);
  expect(passedCount).toBeGreaterThan(0);
  // Phase 7-O Task 8b-1 (P-4): the lanes are the kinds the office log records, not a fixed three.
  for (const kind of recordedKinds) {
    await expect(
      library.getByRole("region", { name: `${capitalize(kind)} evidence` }),
    ).toBeVisible();
  }
  await expect(library.getByRole("region", { name: "Release evidence" })).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain("Unauthorized roadmap");
  expect(await page.locator("body").innerText()).not.toContain("private chain of thought");
  await page.screenshot({ path: testInfo.outputPath("project-library-overview.png") });

  const viewEvidence = page.getByRole("button", { name: "View evidence_browser v1" });
  await viewEvidence.click();
  const focused = page.getByRole("dialog", { name: "Evidence: evidence_browser v1" });
  await expect(focused).toContainText("agent_test_engineer");
  await page.screenshot({ path: testInfo.outputPath("project-library.png") });
  // Task 9f-2 (P-2): locating the origin replaces the Library with the inspector; going back
  // returns to the Library with focus on the record that was open.
  await page.getByRole("button", { name: "Locate origin in office" }).click();
  await expect(scene).toHaveAttribute("data-selected-entity-id", "agent_test_engineer");
  await expect(library).toHaveCount(0);
  await page.getByRole("button", { name: "Back to Library" }).click();
  await expect(viewEvidence).toBeFocused();

  await page.getByRole("button", { name: "Back to inspector" }).click();
  await expect(page.getByRole("button", { name: "Open Project Library" })).toBeFocused();
});

// Phase 7-O Task 8b-3 (P-4): the review station opens the Library unfocused. The visual evidence
// is the log's, held by the Implementation Engineer, and no approval is recorded for it.
test("@e2e Phase 4 review station opens the Library, and its visual evidence by ID", async ({
  page,
}) => {
  await page.goto("/");
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Locate Review station" }).click();
  await page.getByRole("button", { name: "Open Project Library" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "View evidence_graybox_visual v1" }).click();
  const focused = page.getByRole("dialog", { name: "Evidence: evidence_graybox_visual v1" });
  await expect(focused).toContainText("agent_implementation_engineer");
  await expect(focused).toContainText("Complete — not approved");
});
