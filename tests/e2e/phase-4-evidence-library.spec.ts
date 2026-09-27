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
  // Task 9e (P-4): the outline takes its own width, so the library's 420 px is measured from it.
  await openOfficeOutline(page);
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
  await page.getByRole("button", { name: "Locate origin in office" }).click();
  await expect(scene).toHaveAttribute("data-selected-entity-id", "agent_test_engineer");
  await page.getByRole("button", { name: "Close evidence" }).click();
  await expect(viewEvidence).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("project-library.png") });

  await page.getByRole("button", { name: "Close Library" }).click();
  await expect(page.getByRole("region", { name: "Office outline" })).toBeFocused();
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
