import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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

/** The page must never scroll sideways; only a named container may. */
const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const state of STATES) {
  test(`@a11y Phase 5 decision notice has no detectable violations — ${state}`, async ({
    page,
  }) => {
    if (state === "saving" || state === "save-failed") {
      await open(page, state);
      await page.getByRole("button", { name: "Acknowledge" }).click();
    } else {
      await open(page, state);
    }

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("@a11y Phase 5 decision notice stays operable and complete at 200% zoom", async ({ page }) => {
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

  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("@a11y Phase 5 decision notice preserves the full title and summary rather than truncating", async ({
  page,
}) => {
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

  expect(await title.evaluate(clipped)).toBe(false);

  const summary = page.locator("#decision-notice-summary");
  await expect(summary).toContainText("A plain-language summary of one decision awaiting");
  expect(await summary.evaluate(clipped)).toBe(false);
});

test("@a11y Phase 5 decision notice removes motion under the reduced-motion policy", async ({
  page,
}) => {
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
  expect(moving).toEqual([]);
});
