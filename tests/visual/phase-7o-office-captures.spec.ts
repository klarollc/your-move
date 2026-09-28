import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import { OFFICE_FIXTURES } from "../../apps/web/src/office-fixtures/index.js";
import { evidenceOutputPath } from "../support/evidence-output.js";
import { openOfficeOutline } from "../support/office-outline.js";

/**
 * Phase 7-O Task 9 (spec §8, criterion 6): current-build captures of the office at both D-07
 * viewports, with the checks the criterion names.
 *
 * Each journey asserts the fact it is filed under, in words, before it is captured: a picture
 * proves something rendered, not that it was that state. The same text assertion is the
 * non-colour check. Captures and the manifest go through `evidenceOutputPath`, which writes to the
 * per-test output directory unless the owner regenerates committed evidence with
 * CUCKCODE_REGENERATE_EVIDENCE=1 (path `phase-7-o/browser/<project>/`).
 *
 * Comparison against the Active Phase 6 direction is the owner's, by eye. Nothing here approves
 * visual fidelity.
 */

// Decision 9-E, adopted for Phase 7-O by owner ruling 2026-09-26: the production bundle.
const ORIGIN = "http://127.0.0.1:4174";

const events = OFFICE_FIXTURES.default!.events;
const revision = events.length;

type Journey = Readonly<{
  id: string;
  path: string;
  drive?: (page: Page) => Promise<void>;
  verify: (page: Page) => Promise<void>;
  /** A gap this capture exists to show, for the owner's V-severity disposition. */
  finding?: string;
}>;

const inspector = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Entity inspector" });
const field = (page: Page, term: string): Locator =>
  inspector(page)
    .getByText(term, { exact: true })
    .and(page.locator("dt"))
    .locator("xpath=following-sibling::dd[1]");
const inspect = (label: string) => async (page: Page) => {
  await openOfficeOutline(page);
  await page.getByRole("button", { name: `Inspect ${label}` }).click();
  await expect(inspector(page)).toBeVisible();
};
const cause = (page: Page): Locator => page.getByTestId("workspace-cause");

const JOURNEYS: readonly Journey[] = [
  {
    id: "default",
    path: "/",
    verify: async (page) => {
      // Task 9e: the office is the whole surface; nothing is wrong, so no notice is shown.
      await expect(page.getByRole("region", { name: "Office outline" })).toHaveCount(0);
      await expect(page.getByTestId("workspace-notice")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "1 blocked · 1 review" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Office outline", exact: true })).toBeVisible();
    },
  },
  {
    id: "outline-open",
    path: "/",
    drive: openOfficeOutline,
    verify: async (page) => {
      // Task 9e (A-1): one action away, with the revision stated in its header (A-4).
      await expect(cause(page)).toContainText(
        `Canonical workspace revision ${revision} is current.`,
      );
      await expect(page.getByRole("region", { name: "Office outline" })).toContainText(
        "Blocked · Needs you",
      );
    },
  },
  {
    id: "selected-agent",
    path: "/",
    drive: inspect("Test Engineer"),
    verify: async (page) => {
      await expect(field(page, "What's happening")).toContainText(
        "Blocked on Provide current browser evidence",
      );
      await expect(field(page, "Why")).toContainText("Reported by the system (verified)");
    },
  },
  {
    id: "blocked-item",
    path: "/",
    drive: (page) => page.getByRole("button", { name: "1 blocked · 1 review" }).click(),
    verify: async (page) => {
      const rail = page.getByRole("complementary", { name: "Manager attention" });
      await expect(rail).toContainText("Provide current browser evidence: blocked");
      await expect(rail).toContainText("The Test Engineer needs current browser evidence");
      await expect(rail).toContainText("Redirect the evidence request or decline the blocker.");
    },
  },
  {
    id: "waiting",
    path: "/",
    drive: inspect("Implementation Engineer"),
    verify: async (page) => {
      await expect(field(page, "What's happening")).toContainText("Waiting for your review of");
      await expect(field(page, "What needs you")).toContainText(
        "Approve, decline, defer, cancel, or redirect the request.",
      );
    },
  },
  {
    id: "stale",
    path: "/?state=stale",
    drive: inspect("Test Engineer"),
    verify: async (page) => {
      await expect(cause(page)).toContainText("Updates unavailable");
      await expect(inspector(page).getByRole("note")).toContainText("may be out of date (delayed)");
    },
  },
  {
    id: "offline",
    path: "/?state=offline",
    drive: inspect("Test Engineer"),
    verify: async (page) => {
      await expect(cause(page)).toContainText("The runtime is offline");
      await expect(inspector(page).getByRole("note")).toContainText("The workspace is offline.");
    },
  },
  {
    id: "missing-evidence",
    path: "/",
    drive: inspect("Test Engineer"),
    verify: async (page) => {
      await expect(field(page, "Approval")).toContainText("Not approved: browser evidence missing");
      await expect(field(page, "Evidence")).toContainText("Browser evidence, version 1: failed");
    },
  },
  {
    id: "completed-unapproved",
    path: "/?fixture=completed-unapproved",
    drive: inspect("Implementation Engineer"),
    verify: async (page) => {
      await expect(field(page, "What's happening")).toContainText("(Completed)");
      await expect(field(page, "Approval")).toContainText("Not approved");
    },
  },
  {
    id: "unassigned-work",
    path: "/?fixture=unassigned",
    drive: openOfficeOutline,
    verify: async (page) => {
      await expect(cause(page)).toContainText("is current");
      // F-9-1 (V1), fixed in Task 9d: unassigned work has its own group in the outline.
      const group = page.getByRole("list", { name: "Unassigned work" });
      await group.scrollIntoViewIfNeeded();
      await expect(group).toContainText("Write the release notes");
      await expect(group).toContainText("Ready");
    },
  },
  {
    id: "conflict",
    path: "/?state=conflict",
    drive: inspect("Implementation Engineer"),
    verify: async (page) => {
      await expect(cause(page)).toContainText("out-of-order event conflict");
      await expect(inspector(page).getByRole("note")).toContainText(
        "The office read model is not current.",
      );
    },
  },
  {
    id: "evidence-link",
    path: "/",
    drive: async (page) => {
      await inspect("Test Engineer")(page);
      await inspector(page)
        .getByRole("button", { name: "Open Browser evidence, version 1" })
        .click();
    },
    verify: async (page) => {
      const focused = page.getByRole("dialog", { name: "Evidence: evidence_browser v1" });
      await expect(focused).toContainText("Failed");
      await expect(focused).toContainText("No summary recorded");
    },
  },
];

type Check = Readonly<{ performed: boolean; method: string; observed?: unknown }>;

const record = async (testInfo: TestInfo, body: unknown): Promise<void> => {
  const path = evidenceOutputPath(
    testInfo,
    `phase-7-o/browser/${testInfo.project.name}/manifest.json`,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
};

const capture = async (page: Page, testInfo: TestInfo, id: string): Promise<string> => {
  const relative = `phase-7-o/browser/${testInfo.project.name}/${id}.png`;
  const path = evidenceOutputPath(testInfo, relative);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: "disabled" });
  return relative;
};

test("@visual Phase 7-O office captures, with console, network, input, zoom and motion checks", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const consoleErrors: string[] = [];
  const requests = new Set<string>();
  const failed: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => requests.add(request.url()));
  page.on("requestfailed", (request) => failed.push(request.url()));

  const journeys: Array<Record<string, unknown>> = [];
  for (const journey of JOURNEYS) {
    await page.goto(`${ORIGIN}${journey.path}`);
    await expect(page.getByRole("region", { name: "Office scene" })).toBeVisible();
    await journey.drive?.(page);
    await journey.verify(page);
    journeys.push({
      id: journey.id,
      path: journey.path,
      capture: await capture(page, testInfo, journey.id),
      verified: true,
      ...(journey.finding ? { finding: journey.finding } : {}),
    });
  }

  // Keyboard: the skip link opens the outline, then a person, the inspector, and focus back on
  // Escape.
  await page.goto(`${ORIGIN}/`);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Open the Office outline" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Office outline" })).toBeFocused();
  const target = page.getByRole("button", { name: "Inspect Test Engineer" });
  let presses = 0;
  while (!(await target.evaluate((element) => element === document.activeElement))) {
    presses += 1;
    expect(presses, "Inspect Test Engineer is not reachable by Tab").toBeLessThan(60);
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Enter");
  await expect(field(page, "What's happening")).toContainText("Blocked on");
  await page.keyboard.press("Escape");
  await expect(inspector(page)).toHaveCount(0);
  await expect(target).toBeFocused();

  // Pointer: the canvas selects the same person, and the inspector reads the same record.
  await page.goto(`${ORIGIN}/`);
  const canvas = page.locator('canvas[data-scene-renderer="pixi"]');
  await expect(canvas).toHaveCount(1);
  const center = await page
    .locator("[data-office-canvas-host]")
    .getAttribute("data-agent-implementation-screen");
  const [x, y] = center?.split(",").map(Number) ?? [];
  await canvas.click({ position: { x: x ?? 0, y: y ?? 0 } });
  await expect(inspector(page)).toHaveAttribute(
    "data-selected-entity-id",
    "agent_implementation_engineer",
  );
  await expect(field(page, "What's happening")).toContainText("Waiting for your review of");

  // Focus return from an evidence dialog and the library.
  await page.goto(`${ORIGIN}/`);
  await inspect("Test Engineer")(page);
  const link = inspector(page).getByRole("button", { name: "Open Browser evidence, version 1" });
  await link.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Project Library" })).toBeFocused();
  await page.getByRole("button", { name: "Back to inspector" }).click();
  await expect(link).toBeFocused();

  // Reduced motion: the recorded handoff keeps its meaning as a label, with nothing animated.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${ORIGIN}/?motion=handoff&checkpoint=settled`);
  const cue = page.getByTestId("semantic-motion-cue");
  await expect(cue).toHaveAttribute("data-motion-presentation", "immediate-placement");
  await expect(cue).toContainText("Handoff to Visual QA Reviewer recorded");
  expect(await cue.evaluate((element) => element.getAnimations().length)).toBe(0);
  const reducedCapture = await capture(page, testInfo, "reduced-motion-handoff");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // 200% zoom, real (Decision 9-C), applied after navigation as the Phase 5 matrix does, with the
  // emulation asserted before anything is measured. The capture goes through the same CDP session:
  // Playwright's own screenshot can reset the device metrics and record an unzoomed page.
  await page.goto(`${ORIGIN}/`);
  await inspect("Test Engineer")(page);
  const viewport = page.viewportSize();
  const halfWidth = Math.round((viewport?.width ?? 1440) / 2);
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: halfWidth,
    height: Math.round((viewport?.height ?? 900) / 2),
    deviceScaleFactor: 2,
    mobile: false,
  });
  const emulation = await page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
    innerWidth: window.innerWidth,
  }));
  expect(emulation.devicePixelRatio, "the zoom emulation did not take effect").toBe(2);
  expect(emulation.innerWidth, "the zoom emulation did not narrow the layout").toBe(halfWidth);
  const blocker = field(page, "Why");
  await blocker.scrollIntoViewIfNeeded();
  await expect(blocker).toContainText("The Test Engineer needs current browser evidence");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const zoomCapture = `phase-7-o/browser/${testInfo.project.name}/zoom-200-selected-agent.png`;
  const zoomPath = evidenceOutputPath(testInfo, zoomCapture);
  await mkdir(dirname(zoomPath), { recursive: true });
  const shot = (await client.send("Page.captureScreenshot", { format: "png" })) as { data: string };
  await writeFile(zoomPath, Buffer.from(shot.data, "base64"));
  await client.send("Emulation.clearDeviceMetricsOverride");
  await client.detach();

  const external = [...requests].filter((url) => !url.startsWith(ORIGIN)).sort();
  const checks: Record<string, Check> = {
    console: {
      performed: true,
      method: "console errors collected across every journey and probe",
      observed: consoleErrors,
    },
    network: {
      performed: true,
      method: "every request URL and every failed request, across every journey and probe",
      observed: { requestCount: requests.size, external, failed },
    },
    keyboard: {
      performed: true,
      method: "Tab to the skip link, Enter to the outline, Tab to Inspect Test Engineer, Enter",
      observed: { tabPressesToTarget: presses },
    },
    pointer: {
      performed: true,
      method: "click the Implementation Engineer on the Pixi canvas; the inspector reads waiting",
    },
    focusReturn: {
      performed: true,
      method: "Escape from the inspector; Escape from an evidence dialog, then Back to inspector",
    },
    zoom200: {
      performed: true,
      method: "CDP device-metrics emulation at half width and DPR 2, asserted before use",
      // Page-level horizontal scroll only. Clipping inside fixed regions is not measured here; the
      // capture is what shows it.
      observed: { pageHorizontalScrollPx: overflow, capture: zoomCapture },
    },
    reducedMotion: {
      performed: true,
      method: "prefers-reduced-motion: reduce; the handoff cue is a label with no animation",
      observed: { capture: reducedCapture },
    },
    nonColourMeaning: {
      performed: true,
      method: "every journey asserts its state in words before it is captured",
    },
    phase6Direction: {
      performed: false,
      method: "comparison against the Active Phase 6 direction is the owner's, by eye",
    },
  };
  await record(testInfo, {
    schema: "cuckcode.phase-7-o.browser-captures.v1",
    project: testInfo.project.name,
    origin: ORIGIN,
    defaultLogRevision: revision,
    journeys,
    checks,
  });

  expect(consoleErrors).toStrictEqual([]);
  expect(external).toStrictEqual([]);
  expect(failed).toStrictEqual([]);
});
