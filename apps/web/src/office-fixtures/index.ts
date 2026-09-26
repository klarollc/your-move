/**
 * The office's deterministic states as canonical event logs (Phase 7-O spec §5, plan P-3, P-5).
 *
 * Every state the office can show about work and people is a log replayed through `replayProject`
 * and projected by `projectOfficeReadModel`. Nothing here is projection output. States that describe
 * the runtime or the renderer rather than the project (loading, error, offline, canvas loss, rate and
 * budget limits, restart) have no canonical expression: they are shell overlays drawn over the
 * default log, which supplies the entity facts underneath them.
 *
 * Each log is written, reviewed and versioned like evidence, and says which comprehension tasks it
 * serves (MDD §20). The six agents and their role assignments are the same records the Phase 6
 * comparison frame uses; `scripts/office-fixtures-golden-overlap.unit.test.ts` asserts it.
 */
import type { ProjectEvent } from "@cuckcode/contracts";

export const OFFICE_SHELL_STATES = [
  "ready",
  "loading",
  "empty",
  "partial",
  "error",
  "stale",
  "offline",
  "canvas-loss",
  "rate-limit",
  "budget-limit",
  "permission-denied",
  "missing-artifact",
  "test-failure",
  "reviewer-disagreement",
  "conflict",
  "restart",
  "cancelled",
] as const;
export type OfficeFixtureState = (typeof OFFICE_SHELL_STATES)[number];

export type OfficeFixture = Readonly<{
  id: string;
  purpose: string;
  comprehension: readonly string[];
  now: string;
  events: readonly ProjectEvent[];
  expectedIssueCodes: readonly string[];
}>;

const ROLES = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
] as const;
const BASE_TIME = Date.parse("2026-09-26T09:00:00.000Z");
const underscored = (roleId: string) => roleId.replace(/-/gu, "_");

function createLog(prefix: string) {
  let sequence = 0;
  const events: ProjectEvent[] = [];
  const emit = (
    kind: ProjectEvent["kind"],
    payload: Record<string, unknown>,
    source: ProjectEvent["source"] = "system",
  ) => {
    sequence += 1;
    const at = new Date(BASE_TIME + sequence * 1000).toISOString();
    events.push({
      schemaVersion: 1,
      eventId: `event_office_${prefix}_${String(sequence).padStart(3, "0")}`,
      projectId: "project_office",
      kind,
      occurredAt: at,
      receivedAt: at,
      source,
      trust: "verified",
      payload,
    });
  };
  const at = () => new Date(BASE_TIME + (sequence + 30) * 1000).toISOString();
  return { events, emit, at };
}

type Log = ReturnType<typeof createLog>;

const CONDITIONS = {
  review: {
    reasonCode: "review_requested",
    summary: "The graybox slice is ready for the manager's disposition.",
    waitingOn: { kind: "manager" },
    requestedAction: {
      kind: "approve",
      summary: "Approve, decline, defer, cancel, or redirect the request.",
    },
  },
  evidence: {
    reasonCode: "awaiting_evidence",
    summary:
      "The Test Engineer needs current browser evidence; the recorded capture failed on an earlier build.",
    waitingOn: { kind: "evidence", id: "evidence_browser" },
    requestedAction: {
      kind: "redirect",
      summary: "Redirect the evidence request or decline the blocker.",
    },
  },
  permission: {
    reasonCode: "awaiting_permission",
    summary: "The permission to run the browser capture was denied; the Test Engineer stopped.",
    waitingOn: { kind: "manager" },
    requestedAction: {
      kind: "redirect",
      summary: "Review the permission boundary, then redirect or cancel the work.",
    },
  },
  missingArtifact: {
    reasonCode: "dependency_blocked",
    summary: "A required artifact is missing; review and delivery cannot proceed.",
    waitingOn: { kind: "agent", id: "agent_implementation_engineer" },
    requestedAction: {
      kind: "provide_evidence",
      summary: "Locate the missing artifact or cancel the review.",
    },
  },
  disagreement: {
    reasonCode: "review_requested",
    summary: "The Visual QA and Release reviewers disagree; no conclusion was drawn.",
    waitingOn: { kind: "manager" },
    requestedAction: {
      kind: "redirect",
      summary: "Resolve the disagreement or redirect the review.",
    },
  },
} as const;

/** Six agents, six role assignments: the same records as the Phase 6 comparison frame. */
function staffed(prefix: string): Log {
  const log = createLog(prefix);
  const { emit } = log;
  emit("project.created", { name: "CuckCode graybox office" }, "manager");
  for (const roleId of ROLES) {
    emit("agent.registered", {
      agentId: `agent_${underscored(roleId)}`,
      capabilities: [roleId],
      health: "connected",
    });
  }
  for (const roleId of ROLES) {
    emit("role.assigned", {
      roleAssignmentId: `role-assignment_${underscored(roleId)}`,
      roleId,
      agentId: `agent_${underscored(roleId)}`,
      requiredCapabilities: [roleId],
    });
  }
  return log;
}

function activeWork(
  log: Log,
  workItemId: string,
  outcome: string,
  kinds: string[],
  roleId: string,
) {
  log.emit("work.created", { workItemId, outcome, requiredEvidenceKinds: kinds });
  log.emit("work.assigned", {
    workItemId,
    roleAssignmentId: `role-assignment_${underscored(roleId)}`,
  });
  (["ready", "assigned", "active"] as const).forEach((toState, index) =>
    log.emit("work.transitioned", { workItemId, fromRevision: index, toState }),
  );
}

const evidence = (
  log: Log,
  evidenceId: string,
  workItemId: string,
  kind: string,
  result: "passed" | "failed",
  version = 1,
) => log.emit("evidence.recorded", { evidenceId, workItemId, kind, version, result });

const raise = (
  log: Log,
  workItemId: string,
  fromRevision: number,
  toState: string,
  condition: object,
) =>
  log.emit("work.transitioned", {
    workItemId,
    fromRevision,
    toState,
    payloadVersion: 2,
    condition,
  });

const presence = (log: Log, roleId: string, value: string, health = "connected") =>
  log.emit(
    "agent.presence_changed",
    { agentId: `agent_${underscored(roleId)}`, presence: value, health },
    "adapter",
  );

type Variant = {
  graybox?: "review" | "missing-artifact" | "test-failure" | "disagreement" | "cancelled";
  evidence?: "evidence" | "permission";
};

/**
 * The default office: the graybox slice is waiting on the manager's review, and the browser
 * evidence is blocked. Variants change one of the two items and nothing else.
 */
function officeLog(prefix: string, variant: Variant = {}): Log {
  const log = staffed(prefix);
  activeWork(
    log,
    "work_graybox_slice",
    "Deliver the approved graybox slice",
    ["unit", "visual"],
    "implementation-engineer",
  );
  evidence(log, "evidence_graybox_unit", "work_graybox_slice", "unit", "passed");
  evidence(log, "evidence_graybox_visual", "work_graybox_slice", "visual", "passed");
  activeWork(
    log,
    "work_browser_evidence",
    "Provide current browser evidence",
    ["browser"],
    "test-engineer",
  );
  evidence(log, "evidence_browser", "work_browser_evidence", "browser", "failed");

  switch (variant.graybox ?? "review") {
    case "review":
      raise(log, "work_graybox_slice", 3, "review_requested", CONDITIONS.review);
      presence(log, "implementation-engineer", "waiting");
      break;
    case "missing-artifact":
      raise(log, "work_graybox_slice", 3, "blocked", CONDITIONS.missingArtifact);
      presence(log, "implementation-engineer", "blocked");
      break;
    case "test-failure":
      raise(log, "work_graybox_slice", 3, "review_requested", CONDITIONS.review);
      evidence(log, "evidence_graybox_unit", "work_graybox_slice", "unit", "failed", 2);
      log.emit("work.transitioned", {
        workItemId: "work_graybox_slice",
        fromRevision: 4,
        toState: "active",
      });
      presence(log, "implementation-engineer", "active");
      break;
    case "disagreement":
      evidence(log, "evidence_graybox_release", "work_graybox_slice", "release", "failed");
      raise(log, "work_graybox_slice", 3, "review_requested", CONDITIONS.disagreement);
      presence(log, "implementation-engineer", "waiting");
      break;
    case "cancelled":
      raise(log, "work_graybox_slice", 3, "review_requested", CONDITIONS.review);
      log.emit(
        "work.transitioned",
        { workItemId: "work_graybox_slice", fromRevision: 4, toState: "cancelled" },
        "manager",
      );
      presence(log, "implementation-engineer", "idle");
      break;
  }
  raise(
    log,
    "work_browser_evidence",
    3,
    "blocked",
    variant.evidence === "permission" ? CONDITIONS.permission : CONDITIONS.evidence,
  );
  presence(log, "test-engineer", "blocked");
  presence(log, "visual-qa-reviewer", "waiting");
  for (const roleId of ["delivery-lead", "product-designer", "release-reviewer"]) {
    presence(log, roleId, "idle");
  }
  return log;
}

function fixture(
  id: string,
  purpose: string,
  comprehension: readonly string[],
  build: () => { events: ProjectEvent[]; at: () => string },
  expectedIssueCodes: readonly string[] = [],
  clockOffsetMs = 0,
): OfficeFixture {
  const log = build();
  return Object.freeze({
    id,
    purpose,
    comprehension,
    // Each state is read 30 s after its last event unless it declares an offset (stale does).
    now: new Date(Date.parse(log.at()) + clockOffsetMs).toISOString(),
    events: Object.freeze([...log.events]),
    expectedIssueCodes,
  });
}

const HOUR = 60 * 60 * 1000;

export const OFFICE_FIXTURES: Readonly<Record<string, OfficeFixture>> = Object.freeze({
  default: fixture(
    "default",
    "Two items need the manager: blocked browser evidence and a requested graybox review.",
    ["T1", "T2", "T4", "T6"],
    () => officeLog("default"),
  ),
  empty: fixture("empty", "No project has been recorded: the office has nothing to show.", [], () =>
    createLog("empty"),
  ),
  partial: fixture(
    "partial",
    "Two agents are disconnected; the other four records remain current.",
    ["T3"],
    () => {
      const log = officeLog("partial");
      presence(log, "visual-qa-reviewer", "idle", "disconnected");
      presence(log, "release-reviewer", "idle", "disconnected");
      return log;
    },
  ),
  stale: fixture(
    "stale",
    "The last canonical update is an hour old; nothing reads as current.",
    ["T3"],
    () => officeLog("stale"),
    [],
    HOUR,
  ),
  "permission-denied": fixture(
    "permission-denied",
    "The browser capture was stopped by a denied permission; the manager decides the boundary.",
    ["T3"],
    () => officeLog("permission", { evidence: "permission" }),
  ),
  "missing-artifact": fixture(
    "missing-artifact",
    "The graybox slice is blocked on a missing artifact rather than waiting on review.",
    [],
    () => officeLog("missing", { graybox: "missing-artifact" }),
  ),
  "test-failure": fixture(
    "test-failure",
    "A newer unit run failed after review was requested; the slice went back to active.",
    [],
    () => officeLog("failure", { graybox: "test-failure" }),
  ),
  "reviewer-disagreement": fixture(
    "reviewer-disagreement",
    "Visual evidence passed and release evidence failed; the review records the disagreement.",
    [],
    () => officeLog("disagreement", { graybox: "disagreement" }),
  ),
  conflict: fixture(
    "conflict",
    "An out-of-order transition is refused and recorded; canonical state did not advance.",
    [],
    () => {
      const log = officeLog("conflict");
      log.emit("work.transitioned", {
        workItemId: "work_graybox_slice",
        fromRevision: 1,
        toState: "completed",
      });
      return log;
    },
    ["INVALID_WORK_TRANSITION"],
  ),
  cancelled: fixture(
    "cancelled",
    "The manager cancelled the graybox review; nothing is inferred as completed.",
    [],
    () => officeLog("cancelled", { graybox: "cancelled" }),
  ),
});

const CANONICAL: Partial<Record<OfficeFixtureState, OfficeFixture>> = {
  ready: OFFICE_FIXTURES.default!,
  empty: OFFICE_FIXTURES.empty!,
  partial: OFFICE_FIXTURES.partial!,
  stale: OFFICE_FIXTURES.stale!,
  "permission-denied": OFFICE_FIXTURES["permission-denied"]!,
  "missing-artifact": OFFICE_FIXTURES["missing-artifact"]!,
  "test-failure": OFFICE_FIXTURES["test-failure"]!,
  "reviewer-disagreement": OFFICE_FIXTURES["reviewer-disagreement"]!,
  conflict: OFFICE_FIXTURES.conflict!,
  cancelled: OFFICE_FIXTURES.cancelled!,
};

/** Which canonical log a shell state renders, and the shell overlay when the state is not canonical. */
export function officeFixtureFor(state: OfficeFixtureState): Readonly<{
  fixture: OfficeFixture;
  overlay: OfficeFixtureState | null;
}> {
  const canonical = CANONICAL[state];
  return canonical
    ? { fixture: canonical, overlay: null }
    : { fixture: OFFICE_FIXTURES.default!, overlay: state };
}
