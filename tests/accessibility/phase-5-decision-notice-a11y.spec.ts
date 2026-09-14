import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { evidenceOutputPath } from "../support/evidence-output.js";

/**
 * Phase 5 Task 7 — the accessibility and responsive half of the capture, covering C-09.
 *
 * Axe is a floor, not a ceiling: it finds violations of rules it encodes and says nothing about
 * whether a person can operate this. The zoom, overflow and content-preservation checks below are
 * the ones the surface contract actually states, and they are asserted rather than eyeballed.
 * C-17 — a real screen-reader walkthrough — is not in this file and cannot be.
 */

const STATES = [
  "pending",
  "acknowledged",
  "deferred",
  "overdue",
  "saving",
  "save-failed",
  "disabled",
  "severity-unknown",
  "date-malformed",
] as const;

const open = async (page: Page, state: string): Promise<void> => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/?surface=decision-notice-capture&state=${state}`);
  await expect(page.locator(`[data-capture-state="${state}"]`)).toBeVisible();
};

/**
 * Each check writes what it observed, not merely whether it passed.
 *
 * An assertion that throws leaves nothing behind, so a brief describing these runs to a reviewer
 * would be citing the author's memory. The Visual QA brief cites these files instead: a reviewer
 * told that accessibility was checked, with no artifact to read, is being asked to take it on trust.
 */
const record = async (testInfo: TestInfo, name: string, body: unknown): Promise<void> => {
  const path = evidenceOutputPath(
    testInfo,
    `phase-5/browser/${testInfo.project.name}/a11y-${name}.json`,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
};

/** The page must never scroll sideways; only a named container may. */
const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const state of STATES) {
  test(`@a11y Phase 5 decision notice has no detectable violations — ${state}`, async ({
    page,
  }, testInfo) => {
    if (state === "saving" || state === "save-failed") {
      await open(page, state);
      await page.getByRole("button", { name: "Acknowledge" }).click();
    } else {
      await open(page, state);
    }

    const results = await new AxeBuilder({ page }).analyze();
    await record(testInfo, `scan-${state}`, {
      state,
      viewport: testInfo.project.name,
      // Axe is a floor. `passes` counts rules it could check, `incomplete` counts rules it could not
      // decide, and neither number says a person can operate this.
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
      })),
      rulesPassed: results.passes.length,
      rulesIncomplete: results.incomplete.map((entry) => entry.id),
    });
    expect(results.violations).toEqual([]);
  });
}

test("@a11y Phase 5 decision notice stays operable and complete at 200% zoom", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await open(page, "deferred");
  const viewport = page.viewportSize();
  if (viewport) {
    // 200% zoom is emulated by halving the viewport at the same device scale factor, which is the
    // Phase 4 convention. Reflow, not shrinkage, is what the contract asks for.
    await page.setViewportSize({
      width: Math.round(viewport.width / 2),
      height: Math.round(viewport.height / 2),
    });
  }

  // Nothing the contract forbids hiding may disappear: status, severity, due date, evidence state.
  await expect(page.getByRole("status", { name: "Decision status: deferred" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Deferral details" })).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Significant");
  await expect(page.getByRole("button", { name: "Undo latest decision change" })).toBeVisible();
  await expect(page.locator('li[data-evidence-state="missing"]')).toContainText("Evidence missing");

  const overflow = await horizontalOverflow(page);
  const results = await new AxeBuilder({ page }).analyze();
  await record(testInfo, "zoom-200", {
    viewport: testInfo.project.name,
    emulatedBy: "halving the viewport at the same device scale factor",
    effectiveSize: page.viewportSize(),
    horizontalOverflowPx: overflow,
    preserved: ["status", "deferral details", "severity", "undo control", "evidence state"],
    consoleErrors,
    violations: results.violations.map((violation) => violation.id),
  });

  expect(overflow).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);
  expect(results.violations).toEqual([]);
});

test("@a11y Phase 5 decision notice preserves the full title and summary rather than truncating", async ({
  page,
}, testInfo) => {
  await open(page, "pending");
  const title = page.locator("#decision-notice-title");
  await expect(title).toHaveText("Adopt the bounded kickoff turn budget");

  // "Do not replace it with an ellipsis that removes identifying meaning" — checked against the
  // rendered box rather than the markup, because CSS is what truncates, not React.
  //
  // Overflowing a box is only truncation when the box clips. A wrapped heading reports a scrollHeight
  // a few pixels past its clientHeight from line-box rounding while every word is plainly visible,
  // and a check that ignored `overflow` would have called that a defect.
  const clipped = (element: Element): boolean => {
    const style = window.getComputedStyle(element);
    if (style.textOverflow === "ellipsis") return true;
    if (style.webkitLineClamp !== "none") return true;
    const hides = ["hidden", "clip", "scroll", "auto"];
    if (!hides.includes(style.overflowX) && !hides.includes(style.overflowY)) return false;
    return (
      element.scrollWidth > element.clientWidth + 1 ||
      element.scrollHeight > element.clientHeight + 1
    );
  };

  const titleClipped = await title.evaluate(clipped);
  const summary = page.locator("#decision-notice-summary");
  await expect(summary).toContainText("A plain-language summary of one decision awaiting");
  const summaryClipped = await summary.evaluate(clipped);

  await record(testInfo, "content-length", {
    viewport: testInfo.project.name,
    titleClipped,
    summaryClipped,
    rule: "do not replace identifying meaning with an ellipsis; overflow only counts as truncation when the box clips",
  });

  expect(titleClipped).toBe(false);
  expect(summaryClipped).toBe(false);
});

test("@a11y Phase 5 decision notice removes motion under the reduced-motion policy", async ({
  page,
}, testInfo) => {
  await open(page, "pending");

  // "Remove all transitions, progress animation, parallax, and ambient motion." Asserted on computed
  // style across every element the card renders, because a single transition left on one control is
  // exactly what an eyeball pass misses.
  const moving = await page.evaluate(() => {
    const article = document.querySelector("article");
    if (!article) return ["no article rendered"];
    return [...article.querySelectorAll("*"), article]
      .map((element) => {
        const style = window.getComputedStyle(element);
        const durations = [style.transitionDuration, style.animationDuration];
        const runs = durations.some((value) =>
          value
            .split(",")
            .some((entry) => Number.parseFloat(entry) > 0 && !entry.trim().startsWith("0")),
        );
        return runs ? `${element.tagName.toLowerCase()}.${element.className}` : "";
      })
      .filter(Boolean);
  });
  await record(testInfo, "reduced-motion", {
    viewport: testInfo.project.name,
    policy: "prefers-reduced-motion: reduce",
    elementsWithNonZeroDuration: moving,
    checkedEvery: "every descendant of the card plus the card itself, transition and animation",
  });
  expect(moving).toEqual([]);
});
