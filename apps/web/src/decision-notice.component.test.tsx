import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DecisionNoticeCard, type DecisionNoticeStorage } from "./decision-notice.js";
import { createDecisionState, storedDateViolations } from "@cuckcode/domain";
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
  let hang = false;
  const storage: DecisionNoticeStorage & {
    get value(): DecisionState | null;
    failNext(): void;
    hangForever(): void;
  } = {
    load: () => value,
    save: (next) => {
      if (failNextSave) {
        failNextSave = false;
        throw new Error("fixture save failed");
      }
      // A save that never settles is what the saving state is. Holding the promise open is the only
      // way to observe that state rather than a label someone wrote.
      if (hang) return new Promise<void>(() => {});
      value = next;
    },
    get value() {
      return value;
    },
    failNext() {
      failNextSave = true;
    },
    hangForever() {
      hang = true;
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

// Registered at module scope, not inside one describe: a sibling block otherwise renders into a
// DOM the previous test left behind, and the queries then find several of everything.
afterEach(() => cleanup());

describe("DecisionNoticeCard", () => {
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
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Evidence link: unavailable, External report" }),
    ).toHaveAttribute("aria-disabled", "true");
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
    // Decision 7-D: both date faults now announce the same sentence, written for a person. Before
    // the ruling this path read the core's own detail aloud, ending "focus returns to the date
    // field" — an instruction to an implementer, in someone's ear.
    expect(announced()).toBe("Review date invalid. Choose a future date.");
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

  /**
   * Decision 7-A. The textarea used to carry maxLength, so the browser refused the 281st character
   * and the core's over-length refusal could never fire for a person. The contract says the
   * opposite: reject overlong input rather than truncate it, and show the remaining count.
   */
  it("C-04: an over-length reason is rejected rather than truncated, with the count shown", async () => {
    const user = userEvent.setup();
    const storage = makeStorage();
    const { container } = renderNotice(storage);
    const announced = () =>
      container.querySelector(".decision-notice__announcement")?.textContent ?? "";
    await user.click(screen.getByRole("button", { name: "Defer" }));

    const reason = screen.getByRole("textbox", { name: /Deferral reason/ });
    const overlong = "x".repeat(281);
    fireEvent.change(reason, { target: { value: overlong } });

    // Nothing was silently dropped: what the person typed is still what the field holds.
    expect(reason).toHaveValue(overlong);
    expect(screen.getByTestId("decision-reason-count")).toHaveTextContent("1 character over");
    expect(screen.getByTestId("decision-reason-count")).toHaveTextContent("280");

    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    expect(
      screen.getByRole("alert", { name: "Deferral reason error: reason too long" }),
    ).toBeVisible();
    expect(reason).toHaveValue(overlong);
    expect(reason).toHaveFocus();
    expect(announced()).toBe("Reason too long. Shorten the explanation before deferring.");
    expect(storage.value).toBeNull();
  });

  it("C-04: the remaining count is shown while the reason is still within its bound", async () => {
    const user = userEvent.setup();
    renderNotice();
    await user.click(screen.getByRole("button", { name: "Defer" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Deferral reason/ }), {
      target: { value: "x".repeat(30) },
    });
    expect(screen.getByTestId("decision-reason-count")).toHaveTextContent(
      "250 characters remaining",
    );
  });

  /**
   * Decision 7-C. The controls used to be removed from the DOM in these states. A keyboard user then
   * finds nothing where a control should be, and in `saving` focus is left on a button that vanished
   * underneath the person who just activated it.
   */
  it("C-07, C-10: saving and unavailable make their controls inert rather than removing them", async () => {
    const user = userEvent.setup();
    const storage = makeStorage();
    storage.hangForever();
    const saving = renderNotice(storage);
    await user.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect(screen.getByRole("status", { name: "Decision status: saving" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Acknowledge" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Defer" })).toHaveAttribute("aria-disabled", "true");
    // Focus never lands on the body: the control the person activated is still there, inert.
    expect(document.activeElement).not.toBe(document.body);
    saving.unmount();

    const unavailable = makeStorage({ ...createDecisionState(notice), status: "disabled" });
    renderNotice(unavailable);
    expect(screen.getByRole("status", { name: "Decision status: disabled" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Acknowledge" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Defer" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("note")).toBeVisible();
  });

  /** Decision 7-D. The core's detail strings are written for a log. One of them was read aloud. */
  it("C-10: every refusal a person can trigger is announced in wording written for a person", async () => {
    const user = userEvent.setup();
    const { container } = renderNotice();
    const announced = () =>
      container.querySelector(".decision-notice__announcement")?.textContent ?? "";
    await user.click(screen.getByRole("button", { name: "Defer" }));
    await user.type(
      screen.getByRole("textbox", { name: /Deferral reason/ }),
      "Wait for the owner decision record.",
    );

    fireEvent.change(screen.getByLabelText("Review date"), { target: { value: "2026-01-01" } });
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));

    expect(announced()).toBe("Review date invalid. Choose a future date.");
    expect(announced()).not.toContain("focus returns to");
  });

  /** Decision 9-F. What the component writes, and what survives a reload, is the thing C-15 claims. */
  it("C-15: dates written by the component survive a reload as ISO-8601 UTC", async () => {
    const user = userEvent.setup();
    const storage = makeStorage();
    const first = renderNotice(storage);
    await user.click(screen.getByRole("button", { name: "Defer" }));
    await user.type(
      screen.getByRole("textbox", { name: /Deferral reason/ }),
      "Wait for the owner decision record.",
    );
    fireEvent.change(screen.getByLabelText("Review date"), { target: { value: "2026-12-01" } });
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));

    const saved = storage.value;
    expect(saved).not.toBeNull();
    if (!saved) return;
    expect(storedDateViolations(saved)).toStrictEqual([]);
    first.unmount();

    // Round-tripped, not merely written: a reload must return the same bytes, not a re-rendering
    // of them.
    renderNotice(storage);
    expect(screen.getByRole("status", { name: "Decision status: deferred" })).toBeVisible();
    expect(storage.value?.deferral?.reviewAt).toBe(saved.deferral?.reviewAt);
    expect(storage.value?.log.map((event) => event.at)).toStrictEqual(
      saved.log.map((event) => event.at),
    );
  });

  /**
   * Decision 9-D. C-10 requires focus to land on an element "stated in advance", and until now the
   * advance statement was the test itself — which proves the code agrees with the test, not that it
   * agrees with the specification. The destinations are read from the focus contract.
   */
  it("C-10: focus lands where the focus contract says, for every transition it names", async () => {
    const contract = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "docs/evidence/phase-5/surface-contract/focus-contract.json"),
        "utf8",
      ),
    ) as { transitions: Array<{ transition: string; target: string }> };
    const target = (transition: string): string => {
      const declared = contract.transitions.find((entry) => entry.transition === transition);
      if (!declared) throw new Error(`FOCUS_CONTRACT_MISSING_TRANSITION:${transition}`);
      return declared.target;
    };
    const focused = (): string | undefined =>
      (document.activeElement as HTMLElement | null)?.dataset.focusTarget;

    const user = userEvent.setup();
    const storage = makeStorage();
    const session = renderNotice(storage);

    await user.click(screen.getByRole("button", { name: "Defer" }));
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    expect(focused()).toBe(target("validation-reason-empty"));

    await user.type(screen.getByRole("textbox", { name: /Deferral reason/ }), "x".repeat(281));
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    expect(focused()).toBe(target("validation-reason-too-long"));

    fireEvent.change(screen.getByRole("textbox", { name: /Deferral reason/ }), {
      target: { value: "Wait for the owner decision record." },
    });
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    expect(focused()).toBe(target("validation-date-invalid"));

    fireEvent.change(screen.getByLabelText("Review date"), { target: { value: "2026-12-01" } });
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    expect(focused()).toBe(target("defer-success"));

    await user.click(screen.getByRole("button", { name: "Undo latest decision change" }));
    expect(focused()).toBe(target("undo-success"));

    await user.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(focused()).toBe(target("acknowledge-success"));
    session.unmount();

    // Reload: the adapter returns a state with history, and the contract says a returning person is
    // told what the decision is now rather than left on the document body.
    renderNotice(storage);
    expect(focused()).toBe(target("reload"));
    expect(document.activeElement).not.toBe(document.body);
  });

  it("C-10: a failed save sends focus to retry, as the contract declares", async () => {
    const contract = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "docs/evidence/phase-5/surface-contract/focus-contract.json"),
        "utf8",
      ),
    ) as { transitions: Array<{ transition: string; target: string }> };
    const declared = contract.transitions.find((entry) => entry.transition === "save-failure");

    const user = userEvent.setup();
    const storage = makeStorage();
    storage.failNext();
    renderNotice(storage);
    await user.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect((document.activeElement as HTMLElement | null)?.dataset.focusTarget).toBe(
      declared?.target,
    );
  });

  /** Decision 9-A. One reload case was covered. The criterion says every action. */
  it("C-05: every action survives a reload through the injected adapter", async () => {
    const user = userEvent.setup();

    for (const action of ["acknowledge", "defer", "undo"] as const) {
      const storage = makeStorage();
      const first = renderNotice(storage);
      if (action === "defer") {
        await user.click(screen.getByRole("button", { name: "Defer" }));
        await user.type(
          screen.getByRole("textbox", { name: /Deferral reason/ }),
          "Wait for the owner decision record.",
        );
        fireEvent.change(screen.getByLabelText("Review date"), { target: { value: "2026-12-01" } });
        await user.click(screen.getByRole("button", { name: "Submit deferral" }));
      } else {
        await user.click(screen.getByRole("button", { name: "Acknowledge" }));
        if (action === "undo") {
          await user.click(screen.getByRole("button", { name: "Undo latest decision change" }));
        }
      }
      const saved = storage.value;
      first.unmount();

      renderNotice(storage);
      const expected =
        action === "acknowledge" ? "acknowledged" : action === "defer" ? "deferred" : "pending";
      expect(
        screen.getByRole("status", { name: `Decision status: ${expected}` }),
        `after reloading ${action}`,
      ).toBeVisible();
      // The log is what makes this a restoration rather than a coincidence of status.
      expect(storage.value?.log.map((event) => event.kind)).toStrictEqual(
        saved?.log.map((event) => event.kind),
      );
      cleanup();
    }
  });

  it("C-05: a corrupt persisted state is refused and said out loud, never adopted", () => {
    const corrupt = {
      ...createDecisionState(notice),
      status: "banana",
    } as unknown as DecisionState;
    const storage = makeStorage(corrupt);
    const { container } = renderNotice(storage);

    // Not silently substituted: starting fresh without saying so would show a person "pending" for a
    // decision they deferred, and nothing anywhere would record that something was discarded.
    expect(screen.getByRole("status", { name: "Decision status: pending" })).toBeVisible();
    expect(container.querySelector(".decision-notice__announcement")?.textContent).toContain(
      "saved state could not be read",
    );
  });

  it("C-05: an adapter that throws on load is reported rather than silently starting fresh", () => {
    const storage: DecisionNoticeStorage = {
      load: () => {
        throw new Error("adapter unavailable");
      },
      save: () => undefined,
    };
    const { container } = render(
      <DecisionNoticeCard
        notice={notice}
        fixture={fixture}
        clock={clock}
        storage={storage}
        idSource={() => "fixture-action-1"}
        locale="en-US"
        animationPolicy="reduced"
      />,
    );

    expect(screen.getByRole("status", { name: "Decision status: pending" })).toBeVisible();
    expect(container.querySelector(".decision-notice__announcement")?.textContent).toContain(
      "saved state could not be read",
    );
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
    ["disabled", "Disabled"],
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
    // Decision 9-A: the injected adapter is the only persistence path, so every other one a browser
    // offers is named here rather than left to the two that happened to be listed first.
    expect(source).not.toMatch(
      /indexedDB|document\.cookie|openDatabase|navigator\.storage|caches\b|showSaveFilePicker/,
    );
  });
});

describe("non-actionable controls stay reachable", () => {
  /**
   * Decision 7-C ruled that controls are disabled rather than removed, because "removal also drops
   * focus: a person who activates Acknowledge is standing on a button that disappears underneath
   * them." It was implemented with the native disabled attribute, which is not focusable and is not
   * in the tab order — so for a keyboard user the control is still not there, and the ruling's own
   * rationale is unsatisfied. The walkthrough's C17-SR-03 and C17-SR-04 are both this one mechanism.
   *
   * The ruled behaviour: the control keeps its place in the tab order, announces that it is
   * unavailable through aria-disabled, and refuses activation. Reachable and inert, not absent.
   */
  it.each(["saving", "save-failed", "disabled"] as const)(
    "C-10, 7-C: Acknowledge and Defer are focusable and aria-disabled in %s",
    (status) => {
      const state: DecisionState = { notice, status, revision: 0, log: [], deferral: null };
      renderNotice(makeStorage(state));

      for (const name of ["Acknowledge", "Defer"]) {
        const control = screen.getByRole("button", { name });
        expect(control).toHaveAttribute("aria-disabled", "true");
        expect(control).not.toHaveAttribute("disabled");
        control.focus();
        expect(control).toHaveFocus();
      }
    },
  );

  it("C-10, 7-C: an unresolved evidence control is focusable, aria-disabled, and inert", async () => {
    const user = userEvent.setup();
    const storage = makeStorage();
    renderNotice(storage);

    const unresolved = screen
      .getAllByRole("button", { name: /^Evidence link:/ })
      .filter((button) => !(button.getAttribute("aria-label") ?? "").includes("resolved"));
    expect(unresolved.length).toBeGreaterThan(0);

    for (const control of unresolved) {
      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(control).not.toHaveAttribute("disabled");
      control.focus();
      expect(control).toHaveFocus();
      await user.click(control);
    }

    // Activation is refused rather than absent. The announcement channel is asserted separately.
    expect(storage.value).toBeNull();
  });
});

describe("the announcement channel", () => {
  /**
   * The surface has exactly one spoken channel: a single aria-live="polite" paragraph whose text is
   * replaced. Nothing in this repository asserts the SEQUENCE of values it publishes, only its final
   * text, which is why 67 component, 46 accessibility and 62 visual tests could not have caught
   * C17-SR-01 whatever its cause.
   *
   * WHAT THESE TESTS CANNOT ESTABLISH, and no suite here can: whether a screen reader announces any
   * of it. jsdom has no assistive technology and neither does Playwright. What is asserted is that
   * the DOM publishes a distinguishable mutation for each thing a person is meant to hear. Delivery
   * remains unverified and is the standing gap behind MDD section 19.
   */
  const recordPublications = () => {
    const region = screen.getByTestId("decision-announcement");
    const published: string[] = [];
    const observer = new MutationObserver(() => published.push(region.textContent ?? ""));
    observer.observe(region, { characterData: true, childList: true, subtree: true });
    return { published, stop: () => observer.disconnect() };
  };

  it("C-10: a transient announcement is always followed by a settled one", async () => {
    const user = userEvent.setup();
    renderNotice(makeStorage());
    const recorder = recordPublications();

    await user.click(screen.getByRole("button", { name: "Acknowledge" }));

    recorder.stop();
    expect(recorder.published.length).toBeGreaterThan(0);
    // Whatever is published last must be a settled state, never the in-flight one.
    expect(recorder.published.at(-1)).not.toContain("Saving");
  });

  it("C-10: the same refusal twice publishes twice, so it can be heard twice", async () => {
    const user = userEvent.setup();
    renderNotice(makeStorage());
    await user.click(screen.getByRole("button", { name: "Defer" }));
    const recorder = recordPublications();

    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    const afterFirst = recorder.published.length;
    await user.click(screen.getByRole("button", { name: "Submit deferral" }));
    const afterSecond = recorder.published.length;

    recorder.stop();
    expect(afterFirst).toBeGreaterThan(0);
    // An identical string written to the same node is not a mutation, so a person who repeats a
    // mistake hears nothing the second time. The region must republish rather than go silent.
    expect(afterSecond).toBeGreaterThan(afterFirst);
  });
});
