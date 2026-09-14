import { describe, expect, it } from "vitest";

import {
  applyAction,
  createDecisionState,
  deriveStatus,
  presentDueDate,
  presentSeverity,
  resolveEvidenceLink,
  statusSignature,
  type Clock,
  type DecisionNotice,
  type DecisionStatus,
} from "./decision-notice.js";

/**
 * Phase 5 RED. Every test is named for the acceptance-contract criterion it proves, so the
 * traceability guard can join the two and a criterion without a test is visible rather than assumed.
 *
 * At RED every one of these fails with `NOT_IMPLEMENTED`, which is the reason declared in advance in
 * `docs/evidence/phase-5/red-evidence.json`. A test that failed for any other reason is not evidence
 * for its criterion — it is evidence that the harness is wrong.
 */

const clock: Clock = { now: () => "2026-09-14T12:00:00.000Z" };
const lateClock: Clock = { now: () => "2027-01-01T00:00:00.000Z" };
const deferredLateClock: Clock = { now: () => "2026-09-25T00:00:00.000Z" };

const notice: DecisionNotice = {
  decisionId: "decision_fixture_001",
  title: "Adopt the bounded kickoff turn budget",
  summary: "A plain-language summary of one decision awaiting acknowledgement.",
  severity: "significant",
  dueAt: "2026-10-01T00:00:00.000Z",
  evidenceLinks: [
    { linkId: "link_a", label: "Preflight packet", artifactPath: "fixture/preflight.md" },
    { linkId: "link_b", label: "Round transcript", artifactPath: "fixture/transcript.json" },
  ],
};

/** The local artifact set. C-16 and C-11: resolution never leaves this map. */
const fixture: ReadonlyMap<string, string> = new Map([
  ["fixture/preflight.md", "# packet"],
  ["fixture/transcript.json", "{}"],
]);

describe("Decision Notice — Phase 5 acceptance criteria", () => {
  it("C-01: renders the seven required fields with a stable decision ID", () => {
    const state = createDecisionState(notice);
    expect(state.notice.decisionId).toBe("decision_fixture_001");
    expect(state.notice.title.length).toBeGreaterThan(0);
    expect(state.notice.summary.length).toBeGreaterThan(0);
    expect(state.notice.evidenceLinks).toHaveLength(2);
    expect(state.status).toBe("pending");
  });

  it("C-02: preserves evidence-link source order and gives each a meaningful accessible name", () => {
    const first = resolveEvidenceLink(notice.evidenceLinks[0]!, fixture);
    const second = resolveEvidenceLink(notice.evidenceLinks[1]!, fixture);
    expect(first.accessibleName).toContain("Preflight packet");
    expect(first.accessibleName).not.toBe(notice.evidenceLinks[0]!.artifactPath);
    expect(second.accessibleName).toContain("Round transcript");
  });

  it("C-03: focusing a control never changes state", () => {
    // The pure core cannot be focused; what it must guarantee is that no state transition exists
    // that a focus event could trigger. Only an explicit action mutates.
    const state = createDecisionState(notice);
    expect(state.revision).toBe(0);
    expect(state.log).toEqual([]);
  });

  it("C-04: defer is refused for an empty reason, an over-long reason, and a non-future date", () => {
    const state = createDecisionState(notice);
    const empty = applyAction(
      state,
      {
        kind: "defer",
        actionId: "a1",
        at: clock.now(),
        reason: "",
        reviewAt: "2026-12-01T00:00:00.000Z",
      },
      clock,
    );
    expect(empty).toEqual({ ok: false, code: "reason-empty", detail: expect.any(String) });

    const tooLong = applyAction(
      state,
      {
        kind: "defer",
        actionId: "a2",
        at: clock.now(),
        reason: "x".repeat(5000),
        reviewAt: "2026-12-01T00:00:00.000Z",
      },
      clock,
      280,
    );
    expect(tooLong).toEqual({ ok: false, code: "reason-too-long", detail: expect.any(String) });

    const past = applyAction(
      state,
      {
        kind: "defer",
        actionId: "a3",
        at: clock.now(),
        reason: "needs review",
        reviewAt: "2020-01-01T00:00:00.000Z",
      },
      clock,
    );
    expect(past).toEqual({ ok: false, code: "date-invalid", detail: expect.any(String) });
  });

  it("C-05: state after an action is reproducible from the log", () => {
    const state = createDecisionState(notice);
    const applied = applyAction(
      state,
      { kind: "acknowledge", actionId: "a1", at: clock.now() },
      clock,
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const replayed = applied.state.log.reduce<number>((revision) => revision + 1, 0);
    expect(replayed).toBe(applied.state.revision);
  });

  it("C-06: duplicate, stale, malformed and out-of-order events are each refused by their own code", () => {
    const state = createDecisionState(notice);
    const first = applyAction(
      state,
      { kind: "acknowledge", actionId: "a1", at: clock.now() },
      clock,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const duplicate = applyAction(
      first.state,
      { kind: "acknowledge", actionId: "a1", at: clock.now() },
      clock,
    );
    expect(duplicate).toMatchObject({ ok: false, code: "duplicate-event" });

    const malformed = applyAction(
      first.state,
      { kind: "defer", actionId: "a4", at: "not-a-date", reason: "r", reviewAt: "also-not-a-date" },
      clock,
    );
    expect(malformed).toMatchObject({ ok: false, code: "malformed-event" });

    // A refused event leaves the state exactly as it was, never partly applied.
    expect(
      applyAction(first.state, { kind: "acknowledge", actionId: "a1", at: clock.now() }, clock),
    ).toMatchObject({
      ok: false,
    });
  });

  it("C-06: preserves the exact pre-event state for every rejection class", () => {
    const acknowledged = applyAction(
      createDecisionState(notice),
      { kind: "acknowledge", actionId: "a1", at: "2026-09-14T12:01:00.000Z" },
      clock,
    );
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok) return;

    const cases = [
      {
        code: "duplicate-event" as const,
        action: { kind: "acknowledge" as const, actionId: "a1", at: "2026-09-14T12:02:00.000Z" },
      },
      {
        code: "stale-event" as const,
        state: createDecisionState(notice),
        action: { kind: "undo" as const, actionId: "a-stale", at: "2026-09-14T12:02:00.000Z" },
      },
      {
        code: "malformed-event" as const,
        action: {
          kind: "defer" as const,
          actionId: "a-malformed",
          at: "not-a-date",
          reason: "r",
          reviewAt: "also-not-a-date",
        },
      },
      {
        code: "out-of-order-event" as const,
        action: { kind: "undo" as const, actionId: "a-old", at: "2026-09-14T12:00:30.000Z" },
      },
    ];

    for (const testCase of cases) {
      const before = testCase.state ?? acknowledged.state;
      const beforeJson = JSON.stringify(before);
      const result = applyAction(before, testCase.action, clock);
      expect(result).toMatchObject({ ok: false, code: testCase.code });
      expect(JSON.stringify(before)).toBe(beforeJson);
    }
  });

  it("C-04: accepts a valid deferral and records its reason and review time", () => {
    const state = createDecisionState(notice);
    const result = applyAction(
      state,
      {
        kind: "defer",
        actionId: "a-defer",
        at: clock.now(),
        reason: "Wait for the owner decision record.",
        reviewAt: "2026-12-01T00:00:00.000Z",
      },
      clock,
    );

    expect(result).toMatchObject({
      ok: true,
      state: {
        status: "deferred",
        deferral: {
          reason: "Wait for the owner decision record.",
          reviewAt: "2026-12-01T00:00:00.000Z",
        },
      },
    });
    if (result.ok) expect(result.state.log[0]?.kind).toBe("defer");
  });

  it("C-06: refuses stale undo without inventing a revision", () => {
    const state = createDecisionState(notice);
    const result = applyAction(
      state,
      { kind: "undo", actionId: "a-stale", at: clock.now() },
      clock,
    );

    expect(result).toMatchObject({ ok: false, code: "stale-event" });
    expect(state).toEqual(createDecisionState(notice));
  });

  it("C-07: all seven statuses are distinguishable without colour", () => {
    const statuses: DecisionStatus[] = [
      "pending",
      "acknowledged",
      "deferred",
      "overdue",
      "saving",
      "save-failed",
      "disabled",
    ];
    const signatures = statuses.map((status) => statusSignature(status));
    for (const signature of signatures) {
      expect(signature.label.length).toBeGreaterThan(0);
      expect(signature.icon.length).toBeGreaterThan(0);
    }
    // Distinguishable, not merely annotated: identical signatures would be one state twice.
    const keys = signatures.map((signature) => `${signature.label}|${signature.icon}`);
    expect(new Set(keys).size).toBe(statuses.length);
  });

  it("C-08: the same inputs and the same injected clock produce the same result", () => {
    const one = applyAction(
      createDecisionState(notice),
      { kind: "acknowledge", actionId: "a1", at: clock.now() },
      clock,
    );
    const two = applyAction(
      createDecisionState(notice),
      { kind: "acknowledge", actionId: "a1", at: clock.now() },
      clock,
    );
    expect(one).toEqual(two);
  });

  it("C-09: status derivation depends on the injected clock, not on ambient time", () => {
    const state = createDecisionState(notice);
    expect(deriveStatus(state, clock)).toBe("pending");
    expect(deriveStatus(state, lateClock)).toBe("overdue");
  });

  it("C-09: derives overdue from a deferred review time", () => {
    const deferred = applyAction(
      createDecisionState(notice),
      {
        kind: "defer",
        actionId: "a-defer-overdue",
        at: clock.now(),
        reason: "Review after the acceptance gate.",
        reviewAt: "2026-09-20T00:00:00.000Z",
      },
      clock,
    );
    expect(deferred.ok).toBe(true);
    if (!deferred.ok) return;

    expect(deriveStatus(deferred.state, deferredLateClock)).toBe("overdue");
    expect(deriveStatus(deferred.state, clock)).toBe("deferred");
  });

  it("C-10: a refused action reports which field to return focus to", () => {
    const state = createDecisionState(notice);
    const refused = applyAction(
      state,
      {
        kind: "defer",
        actionId: "a1",
        at: clock.now(),
        reason: "",
        reviewAt: "2026-12-01T00:00:00.000Z",
      },
      clock,
    );
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.detail.length).toBeGreaterThan(0);
  });

  it("C-11: resolving an evidence link never reaches outside the supplied fixture", () => {
    const external = resolveEvidenceLink(
      { linkId: "link_x", label: "External", artifactPath: "https://example.invalid/doc" },
      fixture,
    );
    expect(external.state).toBe("unavailable");
  });

  it("C-12: acknowledge and defer are mutually exclusive", () => {
    const state = createDecisionState(notice);
    const acknowledged = applyAction(
      state,
      { kind: "acknowledge", actionId: "a1", at: clock.now() },
      clock,
    );
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok) return;
    const then = applyAction(
      acknowledged.state,
      {
        kind: "defer",
        actionId: "a2",
        at: clock.now(),
        reason: "r",
        reviewAt: "2026-12-01T00:00:00.000Z",
      },
      clock,
    );
    expect(then).toMatchObject({ ok: false, code: "already-actioned" });
  });

  it("C-13: undo returns to pending and is recorded as its own event", () => {
    const state = createDecisionState(notice);
    const acknowledged = applyAction(
      state,
      { kind: "acknowledge", actionId: "a1", at: clock.now() },
      clock,
    );
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok) return;
    const undone = applyAction(
      acknowledged.state,
      { kind: "undo", actionId: "a2", at: clock.now() },
      clock,
    );
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.state.status).toBe("pending");
    // Append-only: the original action survives the undo.
    expect(undone.state.log).toHaveLength(2);
    expect(undone.state.log[0]?.kind).toBe("acknowledge");
  });

  it("C-06: rejects an event older than the newest event after a multi-event history", () => {
    const initial = createDecisionState(notice);
    const acknowledged = applyAction(
      initial,
      { kind: "acknowledge", actionId: "a-first", at: "2026-09-14T12:01:00.000Z" },
      clock,
    );
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok) return;
    const undone = applyAction(
      acknowledged.state,
      { kind: "undo", actionId: "a-second", at: "2026-09-14T12:02:00.000Z" },
      clock,
    );
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;

    const before = JSON.stringify(undone.state);
    const result = applyAction(
      undone.state,
      { kind: "acknowledge", actionId: "a-old", at: "2026-09-14T12:01:30.000Z" },
      clock,
    );
    expect(result).toMatchObject({ ok: false, code: "out-of-order-event" });
    expect(JSON.stringify(undone.state)).toBe(before);
  });

  it("C-14: the three severities render distinctly and an unknown one is named", () => {
    expect(presentSeverity("routine").kind).toBe("known");
    expect(presentSeverity("critical").label).not.toBe(presentSeverity("routine").label);
    const unknown = presentSeverity({ unknown: "catastrophic" });
    expect(unknown.kind).toBe("unknown");
    // Discloses the source value rather than blanking or guessing.
    expect(unknown.sourceValue).toBe("catastrophic");
  });

  it("C-15: dates render by locale and a malformed date is named with its raw value", () => {
    const valid = presentDueDate("2026-10-01T00:00:00.000Z", "en-GB");
    expect(valid.kind).toBe("valid");
    expect(presentDueDate("2026-10-01T00:00:00.000Z", "en-US").label).not.toBe(valid.label);

    const malformed = presentDueDate("the first of never", "en-GB");
    expect(malformed.kind).toBe("malformed");
    expect(malformed.rawValue).toBe("the first of never");
  });

  it("C-16: each evidence-link outcome is its own named state", () => {
    expect(resolveEvidenceLink(notice.evidenceLinks[0]!, fixture).state).toBe("resolved");
    expect(
      resolveEvidenceLink(
        { linkId: "l", label: "Gone", artifactPath: "fixture/missing.md" },
        fixture,
      ).state,
    ).toBe("missing");
    expect(
      resolveEvidenceLink({ linkId: "l", label: "Bad", artifactPath: "" }, fixture).state,
    ).toBe("invalid");
  });

  /**
   * Added after the second verification pass, which downgraded C-12 from full to partial.
   *
   * The original test covered acknowledge-then-defer and nothing else. Three of the four
   * already-actioned transitions were unexercised, so a refusal that fired only on that one pairing
   * would have looked fully covered. The criterion is about the pair being mutually exclusive in
   * both directions and each action being unrepeatable, which is four cases, not one.
   */
  it("C-12: every second action on an actioned decision is refused, in both directions", () => {
    const deferral = {
      reason: "Wait for the owner decision record.",
      reviewAt: "2026-12-01T00:00:00.000Z",
    };
    const acknowledged = applyAction(
      createDecisionState(notice),
      { kind: "acknowledge", actionId: "first-ack", at: clock.now() },
      clock,
    );
    const deferred = applyAction(
      createDecisionState(notice),
      { kind: "defer", actionId: "first-defer", at: clock.now(), ...deferral },
      clock,
    );
    expect(acknowledged.ok && deferred.ok).toBe(true);
    if (!acknowledged.ok || !deferred.ok) return;

    const transitions = [
      { from: "acknowledged", state: acknowledged.state, kind: "acknowledge" as const },
      { from: "acknowledged", state: acknowledged.state, kind: "defer" as const },
      { from: "deferred", state: deferred.state, kind: "acknowledge" as const },
      { from: "deferred", state: deferred.state, kind: "defer" as const },
    ];

    for (const transition of transitions) {
      const before = JSON.stringify(transition.state);
      const action =
        transition.kind === "defer"
          ? {
              kind: "defer" as const,
              actionId: `second-${transition.from}`,
              at: clock.now(),
              ...deferral,
            }
          : {
              kind: "acknowledge" as const,
              actionId: `second-${transition.from}`,
              at: clock.now(),
            };
      const result = applyAction(transition.state, action, clock);

      expect(result).toMatchObject({ ok: false, code: "already-actioned" });
      if (!result.ok) expect(result.detail).toContain(transition.from);
      // No state exists in which both are set, so the refusal must leave the first one alone.
      expect(JSON.stringify(transition.state)).toBe(before);
    }
  });

  /**
   * C-04 names three date faults: absent, malformed, and not in the future. Only the third had a
   * test. The first two are refused earlier and by a different code than the third, which is exactly
   * the kind of boundary a single test for "a bad date" would have hidden.
   */
  it("C-04: an absent and a malformed review date are each refused by name", () => {
    const cases = [
      { label: "absent", reviewAt: "" },
      { label: "malformed", reviewAt: "2026-13-45" },
      { label: "not a date at all", reviewAt: "next Tuesday" },
    ];

    for (const testCase of cases) {
      const state = createDecisionState(notice);
      const before = JSON.stringify(state);
      const result = applyAction(
        state,
        {
          kind: "defer",
          actionId: `a-${testCase.label}`,
          at: clock.now(),
          reason: "Wait for the owner decision record.",
          reviewAt: testCase.reviewAt,
        },
        clock,
      );

      expect(result).toMatchObject({ ok: false, code: "malformed-event" });
      // The refusal discloses the value it could not read rather than reporting a generic fault.
      if (!result.ok) expect(result.detail).toContain(testCase.reviewAt);
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  /**
   * C-13 held for undo-after-acknowledge only. Undo after a deferral has a second obligation the
   * acknowledge path does not: the deferral itself must be cleared, while the event that created it
   * stays in the log. Erasing the event would be the easy way to clear the deferral.
   */
  it("C-13: undo after a deferral clears the deferral and keeps both events", () => {
    const deferred = applyAction(
      createDecisionState(notice),
      {
        kind: "defer",
        actionId: "a-defer",
        at: clock.now(),
        reason: "Wait for the owner decision record.",
        reviewAt: "2026-12-01T00:00:00.000Z",
      },
      clock,
    );
    expect(deferred.ok).toBe(true);
    if (!deferred.ok) return;

    const undone = applyAction(
      deferred.state,
      { kind: "undo", actionId: "a-undo", at: clock.now() },
      clock,
    );
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;

    expect(undone.state.status).toBe("pending");
    expect(undone.state.deferral).toBeNull();
    expect(undone.state.log.map((event) => event.kind)).toStrictEqual(["defer", "undo"]);
    expect(undone.state.log.map((event) => event.revision)).toStrictEqual([1, 2]);
    // The deferral is gone from the state and still recoverable from the log.
    expect(undone.state.log[0]).toMatchObject({
      kind: "defer",
      reviewAt: "2026-12-01T00:00:00.000Z",
    });
  });

  it("C-21: a refusal never invents state", () => {
    // The release reviewer's standing objection, expressed as a property: whatever is refused, the
    // state the caller holds afterwards is the state it held before.
    const state = createDecisionState(notice);
    const before = JSON.stringify(state);
    applyAction(
      state,
      {
        kind: "defer",
        actionId: "a1",
        at: clock.now(),
        reason: "",
        reviewAt: "2026-12-01T00:00:00.000Z",
      },
      clock,
    );
    expect(JSON.stringify(state)).toBe(before);
  });
});
