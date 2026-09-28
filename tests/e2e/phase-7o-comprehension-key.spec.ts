import { expect, test, type Locator, type Page } from "@playwright/test";

import { openOfficeOutline } from "../support/office-outline.js";

/**
 * Phase 7-O Task 10 (spec §8.7): every fact the comprehension answer key quotes is asserted on the
 * rendered interface at its task URL. The key is aligned to the interface by this spec, not by
 * the author's reading of fixtures; if the interface changes, this fails and the key (and so its
 * SHA-256 in the protocol preamble) must change with it.
 *
 * The operator must not open this file before the run: it holds the answers.
 */

const labels = (page: Page): Locator =>
  page
    .getByRole("region", { name: "Office scene" })
    .getByRole("list", { name: "People and places in the office" });
const label = (page: Page, person: string): Locator =>
  labels(page).getByRole("listitem").filter({ hasText: person });
const inspector = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Entity inspector" });
const field = (page: Page, term: string): Locator =>
  inspector(page)
    .getByText(term, { exact: true })
    .and(page.locator("dt"))
    .locator("xpath=following-sibling::dd[1]");
const rail = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Manager attention" });
// The header sits inside the page's own landmarks, so it is not exposed as a banner here.
const bar = (page: Page): Locator => page.locator('header[aria-label="Project bar"]');

async function inspect(page: Page, person: string) {
  await openOfficeOutline(page);
  await page.getByRole("button", { name: `Inspect ${person}` }).click();
  await expect(inspector(page)).toBeVisible();
}

async function openKickoff(page: Page, zone: string) {
  await openOfficeOutline(page);
  await page.getByRole("button", { name: `Locate ${zone}` }).click();
  await page.getByRole("button", { name: "Open collaborative kickoff" }).click();
  const panel = page.getByRole("region", { name: "Collaborative kickoff" });
  await expect(panel).toBeVisible();
  return panel;
}

const STATES_ON_DEFAULT = {
  "Delivery Lead": "Delivery Lead · Idle",
  "Product Designer": "Product Designer · Idle",
  "Implementation Engineer": "Implementation Engineer · Waiting · Needs you",
  "Test Engineer": "Test Engineer · Blocked · Needs you",
  "Visual QA Reviewer": "Visual QA Reviewer · Waiting",
  "Release Reviewer": "Release Reviewer · Idle",
} as const;

test("@e2e Phase 7-O comprehension key T1: states and held work on /", async ({ page }) => {
  await page.goto("/");
  for (const [person, text] of Object.entries(STATES_ON_DEFAULT)) {
    await expect(label(page, person)).toHaveText(text);
  }
  await inspect(page, "Implementation Engineer");
  await expect(field(page, "What's happening")).toHaveText(
    "Waiting for your review of Deliver the approved graybox slice",
  );
  await page.getByRole("button", { name: "Back to outline" }).click();
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  await expect(field(page, "What's happening")).toHaveText(
    "Blocked on Provide current browser evidence",
  );
  for (const person of ["Delivery Lead", "Visual QA Reviewer", "Release Reviewer"]) {
    await page.goto("/");
    await inspect(page, person);
    await expect(field(page, "Why")).toHaveText("Work is not assigned");
    await expect(field(page, "What needs you")).toHaveText("Nothing needs you");
  }
});

test("@e2e Phase 7-O comprehension key T2: two attention items on /", async ({ page }) => {
  await page.goto("/");
  await bar(page).getByRole("button", { name: "1 blocked · 1 review" }).click();
  await expect(rail(page)).toContainText("1 of 2");
  await expect(rail(page)).toContainText("Provide current browser evidence: blocked");
  await expect(rail(page)).toContainText(
    "The Test Engineer needs current browser evidence; the recorded capture failed on an earlier build.",
  );
  await expect(rail(page)).toContainText(
    "Manager action: Redirect the evidence request or decline the blocker.",
  );
  await rail(page).getByRole("button", { name: "Next item" }).click();
  await expect(rail(page)).toContainText("2 of 2");
  await expect(rail(page)).toContainText("Deliver the approved graybox slice: review requested");
  await expect(rail(page)).toContainText(
    "The graybox slice is ready for the manager's disposition.",
  );
  await expect(rail(page)).toContainText(
    "Manager action: Approve, decline, defer, cancel, or redirect the request.",
  );
});

test("@e2e Phase 7-O comprehension key T3: stale", async ({ page }) => {
  await page.goto("/?state=stale");
  await expect(bar(page)).toContainText("Updates unavailable");
  await expect(page.getByTestId("workspace-cause")).toHaveText(
    "Updates unavailable. What the office shows is as last confirmed at 09:00 UTC; current activity is unknown.",
  );
  for (const person of Object.keys(STATES_ON_DEFAULT)) {
    await expect(label(page, person)).toContainText(`${person} · Status unknown`);
  }
  await bar(page).getByRole("button", { name: "1 blocked · 1 review" }).click();
  await expect(rail(page).getByRole("alert")).toHaveText(
    "Refresh the current workspace before recording a disposition.",
  );
});

test("@e2e Phase 7-O comprehension key T3: permission-denied", async ({ page }) => {
  await page.goto("/?state=permission-denied");
  await expect(bar(page)).toContainText("Permission blocked");
  await expect(page.getByTestId("workspace-cause")).toHaveText(
    "The required permission request was denied; the agent did not continue.",
  );
  await expect(label(page, "Test Engineer")).toHaveText("Test Engineer · Blocked · Needs you");
  await inspect(page, "Test Engineer");
  await expect(field(page, "Why")).toContainText(
    "The permission to run the browser capture was denied; the Test Engineer stopped.",
  );
  await expect(field(page, "What needs you")).toHaveText(
    "Review the permission boundary, then redirect or cancel the work.",
  );
});

test("@e2e Phase 7-O comprehension key T3: partial", async ({ page }) => {
  await page.goto("/?state=partial");
  await expect(bar(page)).toContainText("Partially available");
  await expect(page.getByTestId("workspace-cause")).toHaveText(
    "Two agent records are unavailable; four current records remain visible.",
  );
  await expect(label(page, "Visual QA Reviewer")).toHaveText("Visual QA Reviewer · Unavailable");
  await expect(label(page, "Release Reviewer")).toHaveText("Release Reviewer · Unavailable");
  await expect(label(page, "Test Engineer")).toHaveText("Test Engineer · Blocked · Needs you");
  await expect(label(page, "Implementation Engineer")).toHaveText(
    "Implementation Engineer · Waiting · Needs you",
  );
});

test("@e2e Phase 7-O comprehension key T4: nothing is approved", async ({ page }) => {
  await page.goto("/");
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Locate Delivery area" }).click();
  await expect(field(page, "What's happening")).toHaveText("No activity is recorded here.");
  await page.getByRole("button", { name: "Open Project Library" }).click();
  const library = page.getByRole("complementary", { name: "Project Library" });
  await expect(library.getByText("Complete — not approved", { exact: true })).toHaveCount(2);
  await expect(library.getByText("Failed", { exact: true })).toHaveCount(1);
  await page.goto("/");
  await inspect(page, "Implementation Engineer");
  await expect(field(page, "Approval")).toHaveText("Not approved");
  await page.getByRole("button", { name: "Back to outline" }).click();
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  await expect(field(page, "Approval")).toHaveText("Not approved: browser evidence missing");
});

test("@e2e Phase 7-O comprehension key T5: the revision kickoff", async ({ page }) => {
  await page.goto("/?kickoff=revision");
  const panel = await openKickoff(page, "Collaboration table");
  await expect(panel).toContainText("Build the Decision Notice as the first isolated slice.");
  await expect(panel).toContainText(
    "Release Reviewer: Independent review must stay separate from delivery",
  );
  await expect(panel.getByText(/: No response recorded$/)).toHaveCount(6);
  await expect(panel).toContainText("No rendered evidence exists yet");
  await expect(panel).toContainText(
    "No work is authorised yet. A manager-approved charter is required first.",
  );
});

test("@e2e Phase 7-O comprehension key T6: nobody is working", async ({ page }) => {
  await page.goto("/?kickoff=round");
  const panel = await openKickoff(page, "Collaboration table");
  await expect(panel).toContainText(
    "Synthesis is blocked. No entry yet from Test Engineer, Visual QA Reviewer, Release Reviewer. Consensus is not inferred from an incomplete round.",
  );
  await expect(panel).toContainText(
    "No work is authorised yet. A manager-approved charter is required first.",
  );
  await page.goto("/");
  await expect(
    labels(page)
      .getByRole("listitem")
      .filter({ hasText: /Working/ }),
  ).toHaveCount(0);
  for (const [person, text] of Object.entries(STATES_ON_DEFAULT)) {
    await expect(label(page, person)).toHaveText(text);
  }
  await inspect(page, "Test Engineer");
  await expect(field(page, "Why")).toContainText("Reported by the system (verified). Recorded");
  expect(await page.locator("html").evaluate((element) => element.getAnimations().length)).toBe(0);
});
