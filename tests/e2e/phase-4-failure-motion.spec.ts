import { expect, test } from "@playwright/test";

const failureStates = [
  ["offline", "loopback runtime is unavailable", "Reconnect runtime"],
  ["stale", "freshness window", "Refresh workspace"],
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
  for (const [state, cause, recovery] of failureStates) {
    await page.goto(`/?state=${state}`);
    await expect(page.getByTestId("workspace-cause")).toContainText(new RegExp(cause, "i"));
    await expect(page.getByRole("button", { name: recovery })).toBeEnabled();
    await expect(
      page.getByRole("region", { name: "Office outline" }).locator("header > strong"),
    ).toHaveText(state);
  }
});

test("@e2e Phase 4 semantic motion uses a named checkpoint after canonical state", async ({
  page,
}) => {
  await page.goto("/?motion=handoff&checkpoint=responsibility-transferred");
  const cue = page.getByTestId("semantic-motion-cue");
  await expect(cue).toHaveAttribute("data-canonical-revision", "44");
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
  await expect(cue).toHaveAttribute("data-canonical-revision", "44");
  await expect(cue).toHaveAttribute("data-motion-presentation", "immediate-placement");
  await expect(cue).toContainText("Handoff recorded at revision 43");
  await expect(page.getByRole("status")).toContainText("Handoff moved to Review station");
  expect(await cue.evaluate((element) => element.getAnimations().length)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("reduced-motion-handoff.png") });
});
