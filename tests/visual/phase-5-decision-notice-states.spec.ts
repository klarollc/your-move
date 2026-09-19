import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import { evidenceOutputPath } from "../support/evidence-output.js";

/**
 * Phase 5 Task 7 — current-build capture of every state the surface contract names.
 *
 * Each state is a *journey*: a URL, an optional interaction a person could perform, and an assertion
 * on the non-colour cue the Product Designer specified. The assertion is what separates this from a
 * screenshot run — a picture proves something was rendered, not that it was the state it is filed
 * under, and a matrix of twenty indistinguishable images would still look complete.
 *
 * Diffs detect change. They never approve taste. Nothing here is a promoted baseline and nothing
 * here is high-fidelity evidence; C-19 still needs the owner's own eyes.
 */

/**
 * Decision 9-E. The captures are taken against the production bundle, not the dev server. A
 * dev-server page issues ninety-five module requests per journey and schedules them in a different
 * order each run, so the recorded evidence was neither auditable nor reproducible.
 */
const ORIGIN = "http://127.0.0.1:4174";

type Journey = Readonly<{
  id: string;
  drive?: (page: Page) => Promise<void>;
  target?: (page: Page) => Locator;
  verify: (page: Page) => Promise<void>;
  /**
   * Set when the build cannot enter this state at all. The journey then proves the *blockage* rather
   * than staging a picture of a state a person can never see, because a capture filed under a state
   * the product cannot reach is the most convincing kind of false evidence this project can produce.
   */
  unreachableBecause?: string;
}>;

const card = (page: Page): Locator => page.getByRole("article");

const statusNamed = (page: Page, name: string): Promise<void> =>
  expect(page.getByRole("status", { name })).toBeVisible();

const openDeferEditor = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Defer" }).click();
  await expect(page.getByRole("textbox", { name: /Deferral reason/ })).toBeVisible();
};

const severityBlock = (page: Page, severity: string): Locator =>
  page.getByRole("region", { name: `Severity: ${severity}` });

const evidenceRow = (page: Page, state: string): Locator =>
  page.locator(`[data-testid="decision-evidence-list"] li[data-evidence-state="${state}"]`).first();

const JOURNEYS: Journey[] = [
  {
    id: "pending",
    verify: async (page) => {
      await statusNamed(page, "Decision status: pending");
      await expect(page.getByRole("button", { name: "Acknowledge" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Defer" })).toBeEnabled();
    },
  },
  {
    id: "acknowledged",
    verify: (page) => statusNamed(page, "Decision status: acknowledged"),
  },
  {
    id: "deferred",
    verify: async (page) => {
      await statusNamed(page, "Decision status: deferred");
      await expect(page.getByRole("region", { name: "Deferral details" })).toBeVisible();
    },
  },
  {
    id: "overdue",
    // Derived from the injected clock alone. Nothing wrote "overdue" anywhere.
    verify: (page) => statusNamed(page, "Decision status: overdue"),
  },
  {
    id: "saving",
    drive: async (page) => {
      await page.getByRole("button", { name: "Acknowledge" }).click();
    },
    verify: async (page) => {
      await statusNamed(page, "Decision status: saving");
      // Decision 7-C: duplicate submission is disabled rather than removed, so the control the
      // person just activated is still under their focus instead of gone.
      await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    },
  },
  {
    id: "save-failed",
    drive: async (page) => {
      await page.getByRole("button", { name: "Acknowledge" }).click();
    },
    verify: async (page) => {
      await statusNamed(page, "Decision status: save failed");
      await expect(page.getByRole("button", { name: /Retry/ })).toBeVisible();
    },
  },
  {
    id: "disabled",
    verify: async (page) => {
      // Decisions 7-B and 7-C. Task 7 captured this state named "Unavailable" with its controls
      // removed from the DOM; the contract asked for "Disabled" and for controls that expose
      // disabled semantics. Both were ruled and both moved.
      await statusNamed(page, "Decision status: disabled");
      await expect(page.getByRole("note")).toBeVisible();
      await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(page.getByRole("button", { name: "Defer" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    },
  },
  {
    id: "severity-routine",
    // Scoped to the severity block. Captured whole, this state and `pending` are the same picture,
    // because the base notice *is* significant — and two states filed under one image is how a
    // capture matrix reports twenty states while holding eighteen.
    target: (page) => severityBlock(page, "routine"),
    verify: (page) => expect(severityBlock(page, "routine")).toContainText("Routine"),
  },
  {
    id: "severity-significant",
    // Scoped to the severity block. Captured whole, this state and `pending` are the same picture,
    // because the base notice *is* significant — and two states filed under one image is how a
    // capture matrix reports twenty states while holding eighteen.
    target: (page) => severityBlock(page, "significant"),
    verify: (page) => expect(severityBlock(page, "significant")).toContainText("Significant"),
  },
  {
    id: "severity-critical",
    // Scoped to the severity block. Captured whole, this state and `pending` are the same picture,
    // because the base notice *is* significant — and two states filed under one image is how a
    // capture matrix reports twenty states while holding eighteen.
    target: (page) => severityBlock(page, "critical"),
    verify: (page) => expect(severityBlock(page, "critical")).toContainText("Critical"),
  },
  {
    id: "severity-unknown",
    target: (page) => severityBlock(page, "unknown"),
    // Named, never blank and never guessed, so the raw value has to reach the page.
    verify: async (page) => {
      await expect(severityBlock(page, "unknown")).toContainText("Unknown severity");
      await expect(severityBlock(page, "unknown")).toContainText("blocker");
    },
  },
  {
    id: "date-malformed",
    verify: async (page) => {
      await expect(card(page)).toContainText("Due date unavailable: malformed");
      await expect(card(page)).toContainText("2026-13-45T99:99:99Z");
    },
  },
  {
    id: "link-resolved",
    target: (page) => evidenceRow(page, "resolved"),
    verify: async (page) => {
      await expect(evidenceRow(page, "resolved")).toContainText("Evidence available");
      await expect(
        page.getByRole("button", { name: "Evidence link: resolved, Preflight packet" }),
      ).toBeEnabled();
    },
  },
  {
    id: "link-missing",
    target: (page) => evidenceRow(page, "missing"),
    verify: async (page) => {
      await expect(evidenceRow(page, "missing")).toContainText("Evidence missing");
      await expect(
        page.getByRole("button", { name: "Evidence link: missing, Missing report" }),
      ).toHaveAttribute("aria-disabled", "true");
    },
  },
  {
    id: "link-invalid",
    target: (page) => evidenceRow(page, "invalid"),
    verify: (page) =>
      expect(evidenceRow(page, "invalid")).toContainText("Evidence reference invalid"),
  },
  {
    id: "link-unavailable",
    target: (page) => evidenceRow(page, "unavailable"),
    verify: (page) =>
      expect(evidenceRow(page, "unavailable")).toContainText("Evidence unavailable"),
  },
  {
    id: "validation-reason-empty",
    drive: async (page) => {
      await openDeferEditor(page);
      await page.getByRole("button", { name: "Submit deferral" }).click();
    },
    verify: async (page) => {
      await expect(
        page.getByRole("alert", { name: "Deferral reason error: reason required" }),
      ).toBeVisible();
      await expect(page.getByRole("textbox", { name: /Deferral reason/ })).toBeFocused();
    },
  },
  {
    id: "validation-reason-too-long",
    drive: async (page) => {
      await openDeferEditor(page);
      await page.getByRole("textbox", { name: /Deferral reason/ }).fill("x".repeat(281));
      await page.getByRole("button", { name: "Submit deferral" }).click();
    },
    verify: async (page) => {
      const reason = page.getByRole("textbox", { name: /Deferral reason/ });
      // Decision 7-A. Task 7 found this state unenterable: the field carried maxLength=280, so the
      // browser refused the 281st character and the core's refusal could never fire for a person.
      // The contract says reject rather than truncate, and show the count. All three are asserted,
      // and the absent maxLength is asserted too, because that attribute returning is the exact way
      // this state would go quietly unreachable again.
      await expect(reason).not.toHaveAttribute("maxlength", /.*/u);
      await expect(reason).toHaveValue("x".repeat(281));
      await expect(page.getByTestId("decision-reason-count")).toContainText(
        "1 character over the 280 limit",
      );
      await expect(
        page.getByRole("alert", { name: "Deferral reason error: reason too long" }),
      ).toBeVisible();
    },
  },
  {
    id: "validation-date-invalid",
    drive: async (page) => {
      await openDeferEditor(page);
      await page
        .getByRole("textbox", { name: /Deferral reason/ })
        .fill("Wait for the owner decision record.");
      await page.getByRole("button", { name: "Submit deferral" }).click();
    },
    verify: async (page) => {
      await expect(
        page.getByRole("alert", {
          name: "Deferral review date error: invalid future date required",
        }),
      ).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Review date" })).toBeFocused();
    },
  },
  {
    id: "undo-available",
    // Scoped to the affordance, for the same reason: the whole card here is the acknowledged
    // capture. The contract names this control "Undo available for the latest decision change";
    // the build calls it "Undo latest decision change". Recorded as a finding, asserted as built.
    target: (page) => page.locator('footer[aria-label="Decision actions"]'),
    verify: async (page) => {
      await expect(page.getByRole("button", { name: "Undo latest decision change" })).toBeEnabled();
      await statusNamed(page, "Decision status: acknowledged");
    },
  },
];

/**
 * Captures route through the sanctioned helper, which writes into committed evidence only when
 * CUCKCODE_REGENERATE_EVIDENCE is set and into the ephemeral run directory otherwise. Writing there
 * on every ordinary run silently rewrites owner-reviewed artifacts — defects D4-P-001 and D4-P-003.
 */
const capturePath = (testInfo: TestInfo, name: string): string =>
  evidenceOutputPath(testInfo, `phase-5/browser/${testInfo.project.name}/${name}`);

const write = async (path: string, body: string | Buffer): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
};

for (const journey of JOURNEYS) {
  test(`@visual Phase 5 decision notice — ${journey.id}`, async ({ page }, testInfo) => {
    const consoleLog: Array<{ type: string; text: string }> = [];
    const requests: string[] = [];
    page.on("console", (message) =>
      consoleLog.push({ type: message.type(), text: message.text() }),
    );
    page.on("request", (request) => requests.push(request.url()));

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${ORIGIN}/?surface=decision-notice-capture&state=${journey.id}`);
    await expect(page.locator(`[data-capture-state="${journey.id}"]`)).toBeVisible();

    if (journey.drive) await journey.drive(page);
    await journey.verify(page);

    const external = () => requests.filter((url) => !url.startsWith(ORIGIN));
    const target = journey.target ? journey.target(page) : card(page);
    await write(capturePath(testInfo, `${journey.id}.png`), await target.screenshot());
    // The accessibility tree, not the pixels, is what C-01, C-02, C-07 and C-14 actually assert.
    await write(capturePath(testInfo, `${journey.id}.aria.yaml`), await card(page).ariaSnapshot());
    await write(
      capturePath(testInfo, `${journey.id}.journey.json`),
      `${JSON.stringify(
        {
          state: journey.id,
          viewport: testInfo.project.name,
          viewportSize: page.viewportSize(),
          driven: Boolean(journey.drive),
          captured: !journey.unreachableBecause,
          unreachableBecause: journey.unreachableBecause ?? null,
          consoleLog,
          // Sorted, because the browser schedules parallel asset loads in whatever order it likes.
          // Which resources were requested is the claim; the order it happened to fetch them is not,
          // and leaving it unsorted made forty otherwise identical records differ between runs.
          requests: [...requests].sort(),
          externalRequests: external(),
        },
        null,
        2,
      )}\n`,
    );

    // Isolation is a property of every journey, not one test that runs once at the end.
    expect(external()).toStrictEqual([]);
    expect(consoleLog.filter((entry) => entry.type === "error")).toStrictEqual([]);
  });
}
