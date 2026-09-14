import {
  applyAction,
  createDecisionState,
  type Clock,
  type DecisionNotice,
  type DecisionState,
  type EvidenceLink,
} from "@cuckcode/domain";

import { DecisionNoticeCard, type DecisionNoticeStorage } from "./decision-notice.js";
import "./decision-notice-fixture.css";

/**
 * The Phase 5 Task 7 capture surface — one URL per state in the Product Designer's inventory.
 *
 * Every state is reached by *injection into the fixture*, never by a capability added to the
 * component for the benefit of the camera. A state that cannot be produced from injected clock,
 * storage, notice and fixture data is recorded as unreachable rather than staged, because a capture
 * of a state the product cannot enter is a picture of the harness.
 *
 * The three validation states are the exception, and deliberately so: they are reached by driving
 * the real form from the capture spec, which is the only honest way to show a validation message.
 */

const BASE_LINKS: EvidenceLink[] = [
  { linkId: "link_a", label: "Preflight packet", artifactPath: "fixture/preflight.md" },
  { linkId: "link_b", label: "Round transcript", artifactPath: "fixture/transcript.json" },
  { linkId: "link_c", label: "Missing report", artifactPath: "fixture/missing.md" },
  { linkId: "link_d", label: "Unfiled reference", artifactPath: "   " },
  { linkId: "link_e", label: "External report", artifactPath: "https://example.invalid/doc" },
];

const BASE_NOTICE: DecisionNotice = {
  decisionId: "decision_fixture_001",
  title: "Adopt the bounded kickoff turn budget",
  summary: "A plain-language summary of one decision awaiting acknowledgement.",
  severity: "significant",
  dueAt: "2026-10-01T00:00:00.000Z",
  evidenceLinks: BASE_LINKS,
};

const FIXTURE: ReadonlyMap<string, string> = new Map([
  ["fixture/preflight.md", "# packet"],
  ["fixture/transcript.json", "{}"],
]);

const NOW: Clock = { now: () => "2026-09-14T12:00:00.000Z" };
/** Past the notice's due date, so `deriveStatus` returns overdue from the clock alone. */
const LATE: Clock = { now: () => "2026-11-01T00:00:00.000Z" };

const DEFERRAL = {
  reason: "Wait for the owner decision record before committing the team.",
  reviewAt: "2026-12-01T00:00:00.000Z",
};

const actioned = (kind: "acknowledge" | "defer"): DecisionState => {
  const result = applyAction(
    createDecisionState(BASE_NOTICE),
    kind === "acknowledge"
      ? { kind, actionId: "capture-action-1", at: NOW.now() }
      : { kind, actionId: "capture-action-1", at: NOW.now(), ...DEFERRAL },
    NOW,
  );
  if (!result.ok) throw new Error(`CAPTURE_FIXTURE_UNREACHABLE:${kind}:${result.code}`);
  return result.state;
};

/** A workspace that holds the decision but permits no change. Persisted, not simulated. */
const unavailable = (): DecisionState => ({
  ...createDecisionState(BASE_NOTICE),
  status: "disabled",
});

type CaptureState = Readonly<{
  notice?: DecisionNotice;
  clock?: Clock;
  persisted?: DecisionState;
  save?: "accept" | "hang" | "reject";
}>;

export const CAPTURE_STATES: Readonly<Record<string, CaptureState>> = {
  pending: {},
  acknowledged: { persisted: actioned("acknowledge") },
  deferred: { persisted: actioned("defer") },
  overdue: { clock: LATE },
  saving: { save: "hang" },
  "save-failed": { save: "reject" },
  disabled: { persisted: unavailable() },
  "severity-routine": { notice: { ...BASE_NOTICE, severity: "routine" } },
  "severity-significant": {},
  "severity-critical": { notice: { ...BASE_NOTICE, severity: "critical" } },
  "severity-unknown": { notice: { ...BASE_NOTICE, severity: { unknown: "blocker" } } },
  "date-malformed": { notice: { ...BASE_NOTICE, dueAt: "2026-13-45T99:99:99Z" } },
  "link-resolved": {},
  "link-missing": {},
  "link-invalid": {},
  "link-unavailable": {},
  "validation-reason-empty": {},
  "validation-reason-too-long": {},
  "validation-date-invalid": {},
  "undo-available": { persisted: actioned("acknowledge") },
};

export function DecisionNoticeCapture({ stateId }: { readonly stateId: string }) {
  const capture = CAPTURE_STATES[stateId];
  if (!capture) {
    return (
      <main className="decision-notice-fixture">
        <p data-testid="capture-state-unknown">Unknown capture state: {stateId}</p>
      </main>
    );
  }

  let persisted = capture.persisted ?? null;
  const storage: DecisionNoticeStorage = {
    load: () => persisted,
    save: (next) => {
      if (capture.save === "reject")
        throw new Error("The fixture storage adapter rejected the save.");
      // A save that never settles is what the saving state actually is. Holding the promise open is
      // the honest way to photograph it; freezing a label would photograph nothing.
      if (capture.save === "hang") return new Promise<void>(() => {});
      persisted = next;
      return undefined;
    },
  };

  let nextAction = 2;
  return (
    <main className="decision-notice-fixture" data-capture-state={stateId}>
      <DecisionNoticeCard
        notice={capture.notice ?? BASE_NOTICE}
        fixture={FIXTURE}
        clock={capture.clock ?? NOW}
        storage={storage}
        idSource={() => `capture-action-${nextAction++}`}
        locale="en-US"
        animationPolicy="reduced"
      />
    </main>
  );
}
