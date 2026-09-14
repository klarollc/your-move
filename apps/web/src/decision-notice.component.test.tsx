import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DecisionNoticeCard, type DecisionNoticeStorage } from "./decision-notice.js";
import type { Clock, DecisionNotice, DecisionState } from "@cuckcode/domain";

const clock: Clock = { now: () => "2026-09-14T12:00:00.000Z" };

const notice: DecisionNotice = {
  decisionId: "decision_fixture_001",
  title: "Adopt the bounded kickoff turn budget",
  summary: "A plain-language summary of one decision awaiting acknowledgement.",
  severity: "significant",
  dueAt: "2026-10-01T00:00:00.000Z",
  evidenceLinks: [
    { linkId: "link_a", label: "Preflight packet", artifactPath: "fixture/preflight.md" },
    { linkId: "link_b", label: "Round transcript", artifactPath: "fixture/transcript.json" },
    { linkId: "link_c", label: "Missing report", artifactPath: "fixture/missing.md" },
    { linkId: "link_d", label: "External report", artifactPath: "https://example.invalid/doc" },
  ],
};

const fixture: ReadonlyMap<string, string> = new Map([
  ["fixture/preflight.md", "# packet"],
  ["fixture/transcript.json", "{}"],
]);

function makeStorage(initial: DecisionState | null = null) {
  let value = initial;
  let failNextSave = false;
  const storage: DecisionNoticeStorage & {
    get value(): DecisionState | null;
    failNext(): void;
  } = {
    load: () => value,
    save: (next) => {
      if (failNextSave) {
        failNextSave = false;
        throw new Error("fixture save failed");
      }
      value = next;
    },
    get value() {
      return value;
    },
    failNext() {
      failNextSave = true;
    },
  };
  return storage;
}

function renderNotice(
  storage = makeStorage(),
  idSource: () => string = (() => {
    let next = 1;
    return () => `fixture-action-${next++}`;
  })(),
) {
  return render(
    <DecisionNoticeCard
      notice={notice}
      fixture={fixture}
      clock={clock}
      storage={storage}
      idSource={idSource}
      locale="en-US"
      animationPolicy="reduced"
    />,
  );
}

describe("DecisionNoticeCard", () => {
  afterEach(() => cleanup());

  it("C-01, C-02, C-07, C-14, C-15, C-16: renders the contract fields and ordered evidence states", () => {
    renderNotice();

    expect(screen.getByRole("article", { name: notice.title })).toHaveTextContent(
      "Adopt the bounded kickoff turn budget",
    );
    expect(
      screen.getByText("A plain-language summary of one decision awaiting acknowledgement."),
    ).toBeVisible();
    expect(screen.getByRole("status", { name: "Decision status: pending" })).toBeVisible();
    expect(screen.getByText("Significant")).toBeVisible();
    expect(screen.getByText("October 1, 2026")).toBeVisible();

    const evidence = screen.getByTestId("decision-evidence-list");
    expect([...evidence.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      expect.stringContaining("Preflight packet"),
      expect.stringContaining("Round transcript"),
      expect.stringContaining("Missing report"),
      expect.stringContaining("External report"),
    ]);
    expect(
      screen.getByRole("button", { name: "Evidence link: resolved, Preflight packet" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Evidence link: missing, Missing report" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Evidence link: unavailable, External report" }),
    ).toBeDisabled();
  });

  it("C-03: focus does not commit, while explicit keyboard and pointer activation do", async () => {
    const user = userEvent.setup();
    renderNotice();
    const acknowledge = screen.getByRole("button", { name: "Acknowledge" });

    acknowledge.focus();
    expect(screen.getByRole("status", { name: "Decision status: pending" })).toBeVisible();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("status", { name: "Decision status: acknowledged" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Undo latest decision change" })).toHaveFocus();
  });

  it("C-04, C-10: validates deferral in place, restores focus to the invalid field, then commits a valid deferral", async () => {
    const user = userEvent.setup();
    renderNotice();
    await user.click(screen.getByRole("button", { name: "Defer" }));

    const reason = screen.getByRole("textbox", { name: /Deferral reason/ });
    const reviewDate = screen.getByLabelText("Review date");
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    expect(
      screen.getByRole("alert", { name: "Deferral reason error: reason required" }),
    ).toBeVisible();
    expect(reason).toHaveFocus();

    await user.type(reason, "Wait for the owner decision record.");
    fireEvent.change(reviewDate, { target: { value: "2026-12-01" } });
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));

    expect(screen.getByRole("status", { name: "Decision status: deferred" })).toBeVisible();
    expect(screen.getByText("Wait for the owner decision record.")).toBeVisible();
    expect(screen.getByText("December 1, 2026")).toBeVisible();
  });

  /**
   * Added after the second verification pass. The existing C-04 test proves the empty *reason* path
   * and then jumps straight to a valid deferral, so neither date fault was exercised at the surface.
   *
   * The two faults are refused in different places — an empty date by the form, a past date by the
   * core — and the criterion requires both to name the date field and return focus to it. A test
   * that only covered the form's own check would pass with the core's refusal wired to nothing.
   */
  it("C-04, C-10: an empty and a past review date each name the date field and take focus", async () => {
    const user = userEvent.setup();
    const storage = makeStorage();
    const { container } = renderNotice(storage);
    const announced = () =>
      container.querySelector(".decision-notice__announcement")?.textContent ?? "";
    await user.click(screen.getByRole("button", { name: "Defer" }));

    const reason = screen.getByRole("textbox", { name: /Deferral reason/ });
    const reviewDate = screen.getByLabelText("Review date");
    await user.type(reason, "Wait for the owner decision record.");

    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    expect(screen.getByRole("alert", { name: /date/i })).toBeVisible();
    expect(reviewDate).toHaveFocus();
    expect(reviewDate).toHaveAttribute("aria-invalid", "true");
    // What is announced matters as much as where focus went, and it is read from the live region
    // rather than the inline error, which renders the same sentence either way. The core refuses an
    // absent date as an unreadable event and says so in its own words; a person hearing
    // `review time "" is not a valid time` has been told about the event log, not about the field
    // they are standing in. The form's own check is what keeps that sentence out of the ear.
    expect(announced()).toBe("Review date invalid. Choose a future date.");

    // A past date passes the form's own check and is refused by the core instead. Same destination.
    fireEvent.change(reviewDate, { target: { value: "2026-01-01" } });
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    expect(screen.getByRole("alert", { name: /date/i })).toBeVisible();
    expect(reviewDate).toHaveFocus();
    expect(announced()).toBe(
      "a review time must be in the future; focus returns to the date field",
    );
    expect(screen.getByRole("status", { name: "Decision status: pending" })).toBeVisible();
    expect(storage.value).toBeNull();

    fireEvent.change(reviewDate, { target: { value: "2026-12-01" } });
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    expect(screen.getByRole("status", { name: "Decision status: deferred" })).toBeVisible();
  });

  /**
   * C-13 was only exercised from the acknowledged state. Undo after a deferral has to clear the
   * displayed deferral as well as the status, and C-10's fourth transition — focus after a
   * successful save — has a different destination for undo than for the actions it reverses.
   */
  it("C-10, C-13: undo after a deferral clears it, keeps the log, and moves focus to the status", async () => {
    const user = userEvent.setup();
    const storage = makeStorage();
    renderNotice(storage);
    await user.click(screen.getByRole("button", { name: "Defer" }));
    await user.type(
      screen.getByRole("textbox", { name: /Deferral reason/ }),
      "Wait for the owner decision record.",
    );
    fireEvent.change(screen.getByLabelText("Review date"), { target: { value: "2026-12-01" } });
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));

    const undo = screen.getByRole("button", { name: "Undo latest decision change" });
    expect(undo).toHaveFocus();

    await user.click(undo);
    expect(screen.getByRole("status", { name: "Decision status: pending" })).toBeVisible();
    expect(screen.queryByText("Wait for the owner decision record.")).not.toBeInTheDocument();
    expect(screen.getByTestId("decision-status-icon")).toHaveFocus();
    expect(storage.value?.log.map(({ kind }) => kind)).toEqual(["defer", "undo"]);
    expect(storage.value?.deferral).toBeNull();
  });

  it("C-05, C-13: reloads saved state through the injected storage adapter and makes undo explicit", async () => {
    const user = userEvent.setup();
    const storage = makeStorage();
    const idSource = (() => {
      let next = 1;
      return () => `fixture-action-${next++}`;
    })();
    const first = renderNotice(storage, idSource);
    await user.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(storage.value?.status).toBe("acknowledged");
    first.unmount();

    renderNotice(storage, idSource);
    expect(screen.getByRole("status", { name: "Decision status: acknowledged" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Undo latest decision change" }));
    expect(screen.getByRole("status", { name: "Decision status: pending" })).toBeVisible();
    expect(storage.value?.log.map(({ kind }) => kind)).toEqual(["acknowledge", "undo"]);
  });

  it("C-10: preserves deferral input and focuses retry when saving fails", async () => {
    const user = userEvent.setup();
    const storage = makeStorage();
    storage.failNext();
    renderNotice(storage);
    await user.click(screen.getByRole("button", { name: "Defer" }));
    const reason = screen.getByRole("textbox", { name: /Deferral reason/ });
    await user.type(reason, "Preserve this input while the fixture save retries.");
    fireEvent.change(screen.getByLabelText("Review date"), { target: { value: "2026-12-01" } });
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));

    expect(screen.getByRole("status", { name: "Decision status: save failed" })).toBeVisible();
    expect(reason).toHaveValue("Preserve this input while the fixture save retries.");
    expect(screen.getByRole("button", { name: "Retry save" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.getByRole("status", { name: "Decision status: deferred" })).toBeVisible();
  });

  it.each([
    ["pending", "Pending"],
    ["acknowledged", "Acknowledged"],
    ["deferred", "Deferred"],
    ["overdue", "Overdue"],
    ["saving", "Saving"],
    ["save-failed", "Save failed"],
    ["disabled", "Unavailable"],
  ] as const)("C-07: renders the %s state with a structural status signature", (status, label) => {
    const state: DecisionState = {
      notice,
      status,
      revision: 0,
      log: [],
      deferral:
        status === "deferred" ? { reason: "Later", reviewAt: "2026-12-01T00:00:00.000Z" } : null,
    };
    renderNotice(makeStorage(state));
    expect(
      screen.getByRole("status", { name: `Decision status: ${label.toLowerCase()}` }),
    ).toHaveTextContent(label);
    expect(screen.getByTestId("decision-status-icon")).toHaveAttribute("data-status", status);
  });

  it("C-08: component source cannot reach ambient time, randomness, timers, storage, or network", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/web/src/decision-notice.tsx"), "utf8");
    expect(source).not.toMatch(
      /\bDate\b|Math\.random|setTimeout|setInterval|requestAnimationFrame|fetch\s*\(|localStorage|sessionStorage/,
    );
  });
});
