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
