import type { KickoffBriefing } from "@cuckcode/contracts";

/**
 * The shared D-25 briefing. Every role receives this identically — that is the "equal briefing"
 * requirement, and it is why the briefing lives here rather than being assembled per role.
 *
 * The goal is the MDD D-23 seed candidate, stated as a seed rather than a decision. D-23 is explicit
 * that Decision Notice "is the approved seed candidate, not an irrevocable goal selected before the
 * agents participate", and that the six may retain, revise or replace it. A briefing that presented
 * it as settled would make the round theatre.
 */
export const KICKOFF_ROLE_IDS = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
] as const;

/** D-25 names the Delivery Lead as the role that synthesises. */
export const SYNTHESIS_ROLE_ID = "delivery-lead";

export const KICKOFF_BRIEFING: KickoffBriefing = {
  schemaVersion: 1,
  kickoffId: "kickoff_phase4_task17",
  projectId: "project_cuckcode_fixture",
  briefingVersion: 1,
  goal: "Seed candidate, open to revision or replacement: build the Decision Notice — an isolated, accessible browser component presenting one project decision with evidence links, severity, due date, and explicit acknowledge or defer actions; proven through deterministic tests and current-build visual evidence.",
  constraints: [
    "The work must stay isolated from CuckCode's unfinished production UI and bounded to a controlled session.",
    "No external side effect of any kind: no network, no deployment, no publishing, no financial action.",
    "It must be objectively testable, accessible, and visually reviewable.",
    "It must exercise all six roles and every required evidence class.",
    "Replacing the seed requires a recorded rationale and an acceptance contract at least as rigorous as the Decision Notice contract.",
  ],
  permissions: [
    "Propose, question, critique and refine the initial goal.",
    "Decline to contribute, with a stated reason.",
    "Nothing else. No role may approve the charter, assign work, or begin implementation.",
  ],
  evidenceFloor: [
    "RED then GREEN evidence for every behavioural change",
    "deterministic browser and failure evidence",
    "current-build visual evidence at the approved viewports",
    "an independent release review returning needs-work or eligible-for-owner-approval",
  ],
  knowledgeSnapshotId: "knowledge_phase4_task17_seed",
  managerNonNegotiables: [
    "No implementation begins before the manager approves a versioned charter.",
    "Completion is never approval, and a green suite is never sufficient evidence.",
    "Silence is not agreement: an unanswered question stays open.",
    "No role may grant itself authority the briefing did not give it.",
  ],
  activeRoleIds: [...KICKOFF_ROLE_IDS],
};

/** The task contract each role runs under, attached at thread start. Identical for all six. */
export const KICKOFF_TASK_CONTRACT = `You are one of six roles in a bounded CuckCode D-25 initial-goal kickoff.

You have a role brief. It is the only thing that makes you different from the other five. Answer as
that role, from its mandate, standards and refusals. Do not imitate another role.

The round has three phases. You will be asked for exactly one thing at a time:

  CONTRIBUTION — your own position on the initial goal.
  SYNTHESIS    — only the Delivery Lead is asked for this, over everyone's contributions.
  REVISION     — your explicit response to the synthesis: affirm, amend, or challenge.

Reply with a single JSON object and nothing else. No prose before or after, no code fence.

CONTRIBUTION schema:
{"kind":"proposal"|"critique"|"question"|"decline","goal":"...","value":"...","risk":"...",
 "dependencies":["..."],"acceptanceCriteria":["..."],"evidenceNeeds":["..."],
 "uncertainties":["..."],"disagreements":["..."]}

SYNTHESIS schema:
{"proposedGoal":"...","disagreementRegister":[{"roleId":"...","statement":"..."}],
 "unresolvedEvidenceGaps":["..."]}

In disagreementRegister, roleId is a ROLE identifier and must be exactly one of:
delivery-lead, product-designer, implementation-engineer, test-engineer, visual-qa-reviewer,
release-reviewer. It is never a contribution identifier. A disagreement is attributed to the role
that holds it, not to the document it appeared in.

REVISION schema:
{"response":"affirm"|"amend"|"challenge","statement":"..."}

Rules that override any instinct to be agreeable:
- Disagreement is expected and is recorded, not smoothed away. If you disagree, say so and why.
- An uncertainty you hold is more useful than a confident guess. List it.
- You may decline. A decline with a stated reason is a valid contribution.
- Never claim evidence that does not exist, and never treat a passing check as approval.
- You cannot approve the charter. Only the manager can.

No tools, no commands, no file access, no network, no external effect of any kind.`;
