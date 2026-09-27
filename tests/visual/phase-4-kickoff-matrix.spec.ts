import { expect, test, type Page } from "@playwright/test";
import { OFFICE_FIXTURES } from "../../apps/web/src/office-fixtures/index.js";

// Phase 7-O Task 6 (P-4): the revision is the length of the canonical default log, not a literal.
const revision = OFFICE_FIXTURES.default!.events.length;

// Named kickoff states for the Phase 4 graybox capture matrix. Captures land in the ephemeral
// per-test output directory, matching the Checkpoint C precedent: they are current-build evidence,
// not promoted visual baselines, and nothing here may be labelled high fidelity.

async function openKickoff(page: Page, query: string, anchor: string) {
  await page.goto(query);
  await page.getByRole("button", { name: `Locate ${anchor}` }).click();
  await page.getByRole("button", { name: "Open collaborative kickoff" }).click();
  await expect(page.getByRole("region", { name: "Collaborative kickoff" })).toBeVisible();
}

test("@visual Phase 4 captures the kickoff round with synthesis blocked", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openKickoff(page, "/?kickoff=round", "Collaboration table");

  // The state is named by what it truthfully shows, not by what it looks like.
  await expect(page.getByTestId("kickoff-synthesis-blocked")).toBeVisible();
  await expect(page.getByTestId("kickoff-decision-impact")).toContainText(
    "No work is authorised yet",
  );
  await page.screenshot({ path: testInfo.outputPath("kickoff-round-blocked.png") });
});

test("@visual Phase 4 captures the synthesised round with preserved dissent", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openKickoff(page, "/?kickoff=revision", "Collaboration table");

  await expect(page.getByRole("list", { name: "Disagreement register" })).toContainText(
    "Release Reviewer",
  );
  await expect(page.getByRole("list", { name: "Revision responses" })).toContainText(
    "No response recorded",
  );
  await page.screenshot({ path: testInfo.outputPath("kickoff-revision-dissent.png") });
});

test("@visual Phase 4 captures the kickoff from the manager desk anchor", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openKickoff(page, "/?kickoff=revision", "Manager desk");

  await expect(page.locator("main")).toHaveAttribute("data-kickoff-open", "true");
  await page.screenshot({ path: testInfo.outputPath("kickoff-manager-desk.png") });
});

test("@visual Phase 4 captures the kickoff while the runtime is offline", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openKickoff(page, "/?kickoff=round&state=offline", "Collaboration table");

  await expect(page.getByTestId("workspace-cause")).not.toContainText(
    `Canonical workspace revision ${revision} is current`,
  );
  await expect(page.getByTestId("kickoff-decision-impact")).toContainText(
    "No work is authorised yet",
  );
  await page.screenshot({ path: testInfo.outputPath("kickoff-offline.png") });
});

test("@visual Phase 4 captures keyboard focus inside the kickoff", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openKickoff(page, "/?kickoff=revision", "Collaboration table");

  await page.getByRole("button", { name: "Close kickoff" }).focus();
  await expect(page.getByRole("button", { name: "Close kickoff" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("kickoff-keyboard-focus.png") });
});
