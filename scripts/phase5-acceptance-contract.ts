/**
 * The Phase 5 acceptance contract, as machine-checkable criteria.
 *
 * Every criterion carries the evidence class that can satisfy it, because the whole point of MDD §18
 * is that the four classes are never conflated — and the specific way they get conflated is a
 * criterion that sounds like behaviour and is actually about taste, quietly satisfied by a passing
 * test.
 *
 * Criteria come from two places and say which: the bullets of the MDD Decision Notice
 * acceptance contract, and the owner's rulings on the charter's evidence gaps. A criterion with no
 * source is a criterion someone invented.
 *
 * Three gaps were dispositioned as *work to produce an answer*, not as answers. Criteria depending on
 * those are `blocked-on-gap` and cannot be satisfied until the gap closes. That is the charter's
 * binding condition expressed as data rather than as a promise.
 */

/** MDD §18. Only `human-visual-acceptance` approves art direction. */
export type EvidenceClass = "static" | "behavioral" | "rendered" | "human-visual-acceptance";

export type Criterion = {
  id: string;
  statement: string;
  source: string;
  evidenceClasses: EvidenceClass[];
  testableAssertion: string;
  dependsOnGap: number | null;
  status: "ready" | "blocked-on-gap";
  /** True when what is being judged is fidelity to the art direction, not behaviour. */
  approvesArtDirection?: boolean;
};

/**
 * Gaps dispositioned as work to produce an answer rather than as answers.
 *
 * Gap 7 closed on 2026-09-14 when the Product Designer delivered the surface contract in Task 3 —
 * art direction, responsive and content-length rules, reduced motion, and a twenty-state inventory.
 * Gaps 3 and 8 remain open, and the criteria depending on them stay blocked.
 */
export const BLOCKED_GAPS = [3, 8];

const MDD = "MDD §6 Decision Notice acceptance contract";
const CHARTER = "approved-charter-v1, owner ruling 2026-09-14";

export const CRITERIA: Criterion[] = [
  {
    id: "C-01",
    statement:
      "Renders a stable decision ID, concise title, plain-language summary, severity, due date, evidence-link list, and current status.",
    source: MDD,
    evidenceClasses: ["behavioral", "rendered"],
    testableAssertion:
      "For the canonical fixture, every one of the seven fields is present in the accessible tree with its fixture value, and the decision ID is unchanged across re-render.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-02",
    statement:
      "Exposes evidence links with meaningful accessible names and preserves source order.",
    source: MDD,
    evidenceClasses: ["behavioral"],
    testableAssertion:
      "Each link's accessible name is non-empty and not the bare URL, and the rendered order equals the fixture order.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-03",
    statement:
      "Supports keyboard and pointer operation for acknowledge and defer without action-on-focus.",
    source: MDD,
    evidenceClasses: ["behavioral", "rendered"],
    testableAssertion:
      "Both actions complete by keyboard and by pointer; focusing either control without activating it produces no state change and no event.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-04",
    statement:
      "Requires a bounded deferral reason and a valid future review time before deferring.",
    source: `${MDD}; refined by ${CHARTER} gap 4`,
    evidenceClasses: ["behavioral"],
    testableAssertion:
      "Defer is refused with a named validation state when the reason is empty, over its bound, or the date is absent, malformed, or not in the future; it succeeds when both are valid.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-05",
    statement:
      "Persists state through a deterministic injected storage adapter and recovers predictably after reload.",
    source: MDD,
    evidenceClasses: ["behavioral"],
    testableAssertion:
      "After each action, a reload through the injected adapter restores the same state; the adapter is injected, never ambient.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-06",
    statement:
      "Rejects duplicate, stale, malformed, or out-of-order action events without inventing state.",
    source: MDD,
    evidenceClasses: ["behavioral"],
    testableAssertion:
      "Each of the four event classes is rejected with its own named reason, and the resulting state equals the state before the event exactly.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-07",
    statement:
      "Distinguishes pending, acknowledged, deferred, overdue, saving, save-failed, and disabled states through text and structure rather than color alone.",
    source: MDD,
    evidenceClasses: ["behavioral", "rendered"],
    testableAssertion:
      "All seven states are distinguishable with colour removed: each carries a distinct accessible name or structural cue, and no two share an identical non-colour signature.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-08",
    statement: "Uses a deterministic injected clock, IDs, fixtures, and animation policy.",
    source: MDD,
    evidenceClasses: ["static", "behavioral"],
    testableAssertion:
      "Two runs with the same injected clock, ID source and fixture produce byte-identical output; no ambient Date, Math.random or timer is reachable from component code.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-09",
    statement:
      "Preserves all meaning with reduced motion and at 200% zoom within the approved desktop boundary.",
    source: MDD,
    evidenceClasses: ["behavioral", "rendered"],
    testableAssertion:
      "At both D-07 viewports, reduced motion and 200% zoom each preserve every state's accessible name and structure, with no horizontal overflow and no content lost.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-10",
    statement:
      "Restores focus appropriately after validation, save success, save failure, and reload.",
    source: MDD,
    evidenceClasses: ["behavioral"],
    testableAssertion:
      "After each of the four transitions, focus lands on a named element stated in advance, never on the document body.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-11",
    statement: "Contains no network, credential, deployment, destructive, or paid side effects.",
    source: MDD,
    evidenceClasses: ["static", "behavioral", "rendered"],
    testableAssertion:
      "No network request is issued during any journey; the network panel is empty; no credential-shaped string appears in output; the isolation scan finds no write outside the fixture.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-12",
    statement: "Acknowledge and defer are mutually exclusive; a decision is never both.",
    source: `${CHARTER} gap 4`,
    evidenceClasses: ["behavioral"],
    testableAssertion:
      "Applying the second action to an already-actioned decision is refused with a named reason; no state exists in which both are set.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-13",
    statement:
      "Either action can be undone, and the undo is recorded as its own event rather than erasing what happened.",
    source: `${CHARTER} gap 4`,
    evidenceClasses: ["behavioral"],
    testableAssertion:
      "After undo, the state returns to pending and the event log contains the original action and the undo as separate entries; nothing is removed from the log.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-14",
    statement:
      "Severity is routine, significant, or critical; an unknown severity renders as a named explicit state.",
    source: `${CHARTER} gap 5`,
    evidenceClasses: ["behavioral", "rendered"],
    testableAssertion:
      "Each of the three levels renders distinctly; a fixture with an unrecognised severity renders a named unknown state rather than blank, a default, or a guess.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-15",
    statement:
      "Dates are stored ISO-8601 UTC and rendered in the viewer's locale; a malformed date renders as a named explicit state.",
    source: `${CHARTER} gap 5`,
    evidenceClasses: ["behavioral"],
    testableAssertion:
      "Stored values are ISO-8601 UTC; rendering under two locales differs; a malformed date renders a named state and never throws, blanks, or silently substitutes.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-16",
    statement:
      "Evidence links resolve from local fixture artifacts; missing, invalid and unavailable each render a named state, and nothing external is fetched.",
    source: `${CHARTER} gap 6`,
    evidenceClasses: ["behavioral", "rendered"],
    testableAssertion:
      "A present artifact resolves; missing, invalid and unavailable each render their own named state; no request leaves the fixture under any of the four.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-17",
    statement:
      "One screen-reader walkthrough is genuinely performed and recorded, closing the Phase 4 waiver.",
    source: `${CHARTER} gap 2, decision 5-D`,
    evidenceClasses: ["rendered", "human-visual-acceptance"],
    testableAssertion:
      "A walkthrough record exists naming the screen reader, the build, what was exercised, and what was not. Automated axe results do not satisfy this criterion.",
    dependsOnGap: null,
    status: "ready",
  },
  {
    id: "C-18",
    statement: "Artifact provenance and supersession are tracked for every evidence artifact.",
    source: `charter goal; ${CHARTER} gap 3`,
    evidenceClasses: ["static", "behavioral"],
    testableAssertion:
      "Pending the gap-3 schema. Each artifact carries its origin and, when replaced, a link to what superseded it; a superseded artifact can never be cited as current.",
    dependsOnGap: 3,
    status: "blocked-on-gap",
  },
  {
    id: "C-19",
    statement:
      "The rendered component matches the art-direction contract for every state in the inventory.",
    source: `charter goal; ${CHARTER} gap 7, closed by the Task 3 surface contract`,
    evidenceClasses: ["rendered", "human-visual-acceptance"],
    testableAssertion:
      "Every one of the twenty states in the Task 3 inventory has a named current-build capture at both D-07 viewports, each matching its declared visual treatment and non-colour cue, and the owner accepts fidelity. Captures and diffs cannot satisfy the acceptance half.",
    dependsOnGap: 7,
    status: "ready",
    approvesArtDirection: true,
  },
  {
    id: "C-20",
    statement:
      "Isolation is verified by a defined procedure, with deterministic failure evidence and console and network capture.",
    source: `charter goal; ${CHARTER} gap 8`,
    evidenceClasses: ["behavioral", "rendered"],
    testableAssertion:
      "Pending the gap-8 procedure. The named procedure runs, console and network capture are clean, and a deliberately failing case produces the recorded failure evidence.",
    dependsOnGap: 8,
    status: "blocked-on-gap",
  },
  {
    id: "C-21",
    statement:
      "An independent release review concludes only needs-work or eligible-for-owner-approval.",
    source: `charter goal; ${CHARTER} decision 5-A`,
    evidenceClasses: ["static", "behavioral", "rendered"],
    testableAssertion:
      "The verdict is one of the two permitted values, is authored by the promoted release-reviewer, and cites artifact and evidence versions. The reviewer is not the implementer.",
    dependsOnGap: null,
    status: "ready",
  },
];

/**
 * Which criteria cover each bullet of the MDD contract.
 *
 * Keyed by an exact fragment of the bullet rather than by index, so reordering the document cannot
 * silently re-point a mapping at the wrong requirement.
 */
export const BULLET_COVERAGE: Array<{ match: string; criterionIds: string[] }> = [
  { match: "render a stable decision ID", criterionIds: ["C-01"] },
  {
    match: "expose evidence links with meaningful accessible names",
    criterionIds: ["C-02", "C-16"],
  },
  { match: "support keyboard and pointer operation", criterionIds: ["C-03"] },
  { match: "require a bounded deferral reason", criterionIds: ["C-04", "C-12"] },
  {
    match: "persist state through a deterministic injected storage adapter",
    criterionIds: ["C-05"],
  },
  { match: "reject duplicate, stale, malformed, or out-of-order", criterionIds: ["C-06", "C-13"] },
  { match: "distinguish pending, acknowledged, deferred", criterionIds: ["C-07", "C-14", "C-15"] },
  { match: "use a deterministic injected clock", criterionIds: ["C-08"] },
  { match: "preserve all meaning with reduced motion", criterionIds: ["C-09", "C-17"] },
  { match: "restore focus appropriately", criterionIds: ["C-10"] },
  { match: "contain no network, credential, deployment", criterionIds: ["C-11", "C-20"] },
];
