import { expect, test } from "@playwright/test";

test("@e2e Phase 4 kickoff opens from its spatial anchors and never authorises work early", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const nonLoopbackRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("request", (request) => {
    if (new URL(request.url()).hostname !== "127.0.0.1") nonLoopbackRequests.push(request.url());
  });

  await page.goto("/?kickoff=round");
  await page.getByRole("button", { name: "Locate Collaboration table" }).click();
  await page.getByRole("button", { name: "Open collaborative kickoff" }).click();

  const panel = page.getByRole("region", { name: "Collaborative kickoff" });
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("kickoff-briefing")).toContainText("Briefing version 3");
  await expect(page.getByTestId("kickoff-decision-impact")).toContainText(
    "No work is authorised yet",
  );

  // The office is never replaced by the workflow.
  await expect(page.getByRole("region", { name: "Office outline" })).toBeVisible();
  await expect(page.locator('canvas[data-scene-renderer="pixi"]')).toHaveCount(1);
  await expect(page.locator("main")).toHaveAttribute("data-kickoff-open", "true");

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(nonLoopbackRequests).toEqual([]);
});

test("@e2e Phase 4 kickoff preserves attribution, dissent, and unanswered roles", async ({
  page,
}) => {
  await page.goto("/?kickoff=revision");
  await page.getByRole("button", { name: "Locate Manager desk" }).click();
  await page.getByRole("button", { name: "Open collaborative kickoff" }).click();

  const entries = page.getByRole("list", { name: "Role contributions" });
  for (const roleId of ["delivery", "design", "implementation", "test", "visual", "release"]) {
    await expect(page.getByTestId(`kickoff-entry-${roleId}`)).toContainText(`agent_${roleId}`);
  }
  await expect(entries).toBeVisible();

  await expect(page.getByRole("list", { name: "Disagreement register" })).toContainText(
    "Release Reviewer",
  );

  // Silence is never rendered as agreement.
  const revisions = page.getByRole("list", { name: "Revision responses" });
  await expect(revisions).toContainText("No response recorded");
  await expect(revisions).not.toContainText(/agreed|affirmed/iu);

  // No chat transcript surface exists.
  await expect(page.getByRole("log")).toHaveCount(0);
});

test("@e2e Phase 4 kickoff is keyboard operable and restores focus on close", async ({ page }) => {
  await page.goto("/?kickoff=round");
  await page.getByRole("button", { name: "Locate Collaboration table" }).click();
  const trigger = page.getByRole("button", { name: "Open collaborative kickoff" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("region", { name: "Collaborative kickoff" })).toBeVisible();
  await page.getByRole("button", { name: "Close kickoff" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("region", { name: "Collaborative kickoff" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("@e2e Phase 4 kickoff stays truthful while the runtime is offline", async ({ page }) => {
  await page.goto("/?kickoff=round&state=offline");
  await page.getByRole("button", { name: "Locate Collaboration table" }).click();
  await page.getByRole("button", { name: "Open collaborative kickoff" }).click();

  // A degraded runtime must not silently promote the kickoff to an authorised state.
  await expect(page.getByTestId("kickoff-decision-impact")).toContainText(
    "No work is authorised yet",
  );
  await expect(page.getByTestId("workspace-cause")).not.toContainText(
    "Canonical workspace revision 42 is current",
  );
});

test("@e2e Phase 4 kickoff keeps meaning with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?kickoff=revision");
  await page.getByRole("button", { name: "Locate Collaboration table" }).click();
  await page.getByRole("button", { name: "Open collaborative kickoff" }).click();

  await expect(page.getByTestId("kickoff-briefing")).toContainText("Briefing version 3");
  expect(await page.locator("html").evaluate((element) => element.getAnimations().length)).toBe(0);
});
