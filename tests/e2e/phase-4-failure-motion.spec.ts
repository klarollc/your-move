import { expect, test } from "@playwright/test";
import { OFFICE_FIXTURES } from "../../apps/web/src/office-fixtures/index.js";
import { openOfficeOutline } from "../support/office-outline.js";

// Phase 7-O Task 9, owner ruling (a) (P-4): the cue comes from the default log's recorded handoff.
// Its revisions are the log's, not the Phase 4 literals 43 and 44.
const events = OFFICE_FIXTURES.default!.events;
const revision = events.length;
const handoffRevision = events.findIndex((event) => event.kind === "handoff.recorded") + 1;

const failureStates = [
  ["offline", "The runtime is offline", "Reconnect runtime"],
  ["stale", "Updates unavailable", "Refresh workspace"],
  ["rate-limit", "provider rate limit", "Retry after limit"],
  ["budget-limit", "budget ceiling is exhausted", "Request budget decision"],
  ["permission-denied", "permission request was denied", "Review permission boundary"],
  ["missing-artifact", "required artifact is missing", "Locate missing artifact"],
  ["test-failure", "test evidence failed", "Review failed test"],
  ["reviewer-disagreement", "reviewers disagree", "Resolve reviewer disagreement"],
  ["conflict", "out-of-order event conflict", "Reconcile conflict"],
  ["restart", "runtime restarted", "Restore current state"],
  ["cancelled", "manager cancellation", "Review cancellation"],
] as const;

test("@e2e Phase 4 failure and recovery projections never manufacture ordinary work", async ({
  page,
}) => {
  test.setTimeout(60_000);
  for (const [state, cause, recovery] of failureStates) {
    await page.goto(`/?state=${state}`);
    await expect(page.getByTestId("workspace-cause")).toContainText(new RegExp(cause, "i"));
    await expect(page.getByRole("button", { name: recovery })).toBeEnabled();
    // Task 9e (P-4): the outline is on demand; its header still names the state. Task 9f-4
    // (P-4): in the bar's plain words rather than the state's identifier.
    await openOfficeOutline(page);
    const health = await page
      .locator('header[aria-label="Project bar"] .office-health')
      .innerText();
    expect(health.length).toBeGreaterThan(0);
    await expect(
      page.getByRole("region", { name: "Office outline" }).locator("header > strong"),
    ).toHaveText(health);
  }
});

test("@e2e Phase 4 semantic motion uses a named checkpoint after canonical state", async ({
  page,
}) => {
  await page.goto("/?motion=handoff&checkpoint=responsibility-transferred");
  const cue = page.getByTestId("semantic-motion-cue");
  await expect(cue).toHaveAttribute("data-canonical-revision", String(revision));
  await expect(cue).toHaveAttribute("data-motion-presentation", "travel");
  await expect(cue).toHaveAttribute("data-motion-checkpoint", "responsibility-transferred");
  await expect(cue).toHaveAttribute("data-motion-loop", "false");
  await expect(cue).toHaveAttribute("data-runtime-paused", "false");
  expect(await cue.evaluate((element) => element.getAnimations().length)).toBe(1);
  expect(
    await cue.evaluate((element) => element.getAnimations()[0]?.effect?.getTiming().iterations),
  ).toBe(1);
});

test("@e2e Phase 4 reduced motion preserves meaning with immediate placement", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?motion=handoff&checkpoint=responsibility-transferred");
  const cue = page.getByTestId("semantic-motion-cue");
  await expect(cue).toHaveAttribute("data-canonical-revision", String(revision));
  await expect(cue).toHaveAttribute("data-motion-presentation", "immediate-placement");
  await expect(cue).toContainText(
    `Handoff to Visual QA Reviewer recorded · revision ${handoffRevision}`,
  );
  await expect(page.getByRole("status")).toContainText("Handoff to Visual QA Reviewer recorded");
  expect(await cue.evaluate((element) => element.getAnimations().length)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("reduced-motion-handoff.png") });
});

test("@e2e Phase 7-O shows no motion cue for a log that records no handoff", async ({ page }) => {
  await page.goto("/?state=empty&motion=handoff&checkpoint=responsibility-transferred");
  await expect(page.getByRole("region", { name: "Office outline" })).toBeVisible();
  await expect(page.getByTestId("semantic-motion-cue")).toHaveCount(0);
});

// Phase 7-O Task 9f-4, constitution rule 6: a stale workspace shows no work moving.
test("@e2e Phase 7-O suspends the handoff's travel while updates are unavailable", async ({
  page,
}) => {
  await page.goto("/?state=stale&motion=handoff&checkpoint=responsibility-transferred");
  const cue = page.getByTestId("semantic-motion-cue");
  await expect(cue).toHaveAttribute("data-motion-presentation", "persistent-label");
  expect(await cue.evaluate((element) => element.getAnimations().length)).toBe(0);
});
