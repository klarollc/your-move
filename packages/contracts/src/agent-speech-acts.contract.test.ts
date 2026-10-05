import { describe, expect, it } from "vitest";

import { eventKinds, parseProjectEvent } from "./events.js";
import { boundedWorkContractSchema } from "./work-contract.js";
import { validateWorkspaceCommand } from "./workspace.js";

const contract = boundedWorkContractSchema.parse({
  outcome: "Replace the parser",
  exclusions: [],
  acceptanceCriteria: ["the parser handles quoted values"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "Parser contract tests" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["the agreed turn cap is reached"],
  definitionOfDone: "the manager reviews the recorded test evidence",
  contextRefs: [],
  maxTurns: 4,
});

type SpeechActKind =
  | "work.question_asked"
  | "work.rescope_proposed"
  | "work.rescope_declined"
  | "work.send_back_disputed";

const agentActor = { actorType: "agent", actorId: "agent_engineer" } as const;
const managerActor = { actorType: "manager", actorId: "manager_nate" } as const;

const event = (
  kind: string,
  payload: Record<string, unknown>,
  over: Record<string, unknown> = {},
) => ({
  schemaVersion: 1,
  eventId: `event_${kind.replaceAll(".", "_")}`,
  projectId: "project_alpha",
  workItemId: "work_parser",
  ...(kind === "work.question_asked" ||
  kind === "work.rescope_proposed" ||
  kind === "work.send_back_disputed"
    ? { roleAssignmentId: "role-assignment_engineer" }
    : {}),
  kind,
  occurredAt: "2026-10-05T12:00:00.000Z",
  receivedAt: "2026-10-05T12:00:00.000Z",
  source:
    kind === "work.question_asked" ||
    kind === "work.rescope_proposed" ||
    kind === "work.send_back_disputed"
      ? "adapter"
      : "manager",
  trust:
    kind === "work.question_asked" ||
    kind === "work.rescope_proposed" ||
    kind === "work.send_back_disputed"
      ? "reported"
      : "verified",
  actor:
    kind === "work.question_asked" ||
    kind === "work.rescope_proposed" ||
    kind === "work.send_back_disputed"
      ? agentActor
      : managerActor,
  payload,
  ...over,
});

const validSpeechActs: Array<[SpeechActKind, Record<string, unknown>]> = [
  ["work.question_asked", { workItemId: "work_parser", question: "Which parser should I update?" }],
  [
    "work.rescope_proposed",
    {
      workItemId: "work_parser",
      proposalId: "rescope-proposal_parser-v2",
      expectedContractRevision: 1,
      contract,
    },
  ],
  [
    "work.rescope_declined",
    {
      workItemId: "work_parser",
      proposalId: "rescope-proposal_parser-v2",
      reason: "The replacement removes a required compatibility check.",
    },
  ],
  [
    "work.send_back_disputed",
    {
      workItemId: "work_parser",
      rulingId: "ruling_parser",
      statement: "The requested evidence is already attached to this review.",
    },
  ],
];

describe("agent speech-act event contracts", () => {
  it("adds the four reconciled events and no question-answer event", () => {
    for (const kind of validSpeechActs.map(([kind]) => kind)) expect(eventKinds).toContain(kind);
    expect(eventKinds).not.toContain("work.question_answered");
  });

  it.each(validSpeechActs)(
    "parses an attributed %s without upgrading reported content",
    (kind, payload) => {
      const parsed = parseProjectEvent(event(kind, payload));
      const isManagerDecision = kind === "work.rescope_declined";
      expect(parsed).toMatchObject({
        ok: true,
        value: isManagerDecision
          ? { actor: managerActor, source: "manager", trust: "verified" }
          : {
              actor: agentActor,
              source: "adapter",
              trust: "reported",
              roleAssignmentId: "role-assignment_engineer",
            },
      });
    },
  );

  it("requires the producer identity, authenticated actor and assigned role on agent events", () => {
    const [kind, payload] = validSpeechActs[0]!;
    const valid = event(kind, payload);
    const invalidCases = [
      { ...valid, actor: undefined },
      { ...valid, actor: { actorType: "manager", actorId: "manager_nate" } },
      { ...valid, actor: { actorType: "agent", actorId: "not-an-agent-id" } },
      { ...valid, source: "manager" },
      { ...valid, trust: "verified" },
      { ...valid, roleAssignmentId: undefined },
    ];

    for (const candidate of invalidCases) expect(parseProjectEvent(candidate).ok).toBe(false);
  });

  it("requires a manager attribution for proposal decline and linked approval", () => {
    const decline = event("work.rescope_declined", validSpeechActs[2]![1]);
    expect(parseProjectEvent(decline).ok).toBe(true);
    expect(parseProjectEvent({ ...decline, actor: undefined }).ok).toBe(false);
    expect(parseProjectEvent({ ...decline, source: "adapter" }).ok).toBe(false);
    expect(
      parseProjectEvent(
        event(
          "work.rescoped",
          {
            workItemId: "work_parser",
            expectedContractRevision: 1,
            contractRevision: 2,
            contract,
            proposalId: "rescope-proposal_parser-v2",
          },
          { actor: managerActor },
        ),
      ).ok,
    ).toBe(true);
  });

  it("rejects malformed texts, revisions, stable IDs and replacement contracts", () => {
    const cases = [
      ["work.question_asked", { workItemId: "work_parser", question: "  " }],
      ["work.question_asked", { workItemId: "work_parser", question: "q".repeat(2001) }],
      [
        "work.rescope_proposed",
        {
          workItemId: "work_parser",
          proposalId: "bad id",
          expectedContractRevision: 1,
          contract,
        },
      ],
      [
        "work.rescope_proposed",
        {
          workItemId: "work_parser",
          proposalId: "rescope-proposal_parser-v2",
          expectedContractRevision: 0,
          contract,
        },
      ],
      [
        "work.rescope_proposed",
        {
          workItemId: "work_parser",
          proposalId: "rescope-proposal_parser-v2",
          expectedContractRevision: 1,
          contract: { ...contract, acceptanceCriteria: [] },
        },
      ],
      [
        "work.rescope_declined",
        { workItemId: "work_parser", proposalId: "rescope-proposal_parser-v2", reason: " " },
      ],
      [
        "work.rescope_declined",
        {
          workItemId: "work_parser",
          proposalId: "rescope-proposal_parser-v2",
          reason: "r".repeat(2001),
        },
      ],
      [
        "work.send_back_disputed",
        { workItemId: "work_parser", rulingId: "not-a-ruling", statement: "I disagree." },
      ],
      [
        "work.send_back_disputed",
        { workItemId: "work_parser", rulingId: "ruling_parser", statement: " " },
      ],
      [
        "work.send_back_disputed",
        {
          workItemId: "work_parser",
          rulingId: "ruling_parser",
          statement: "s".repeat(2001),
        },
      ],
    ] as const;

    for (const [kind, payload] of cases) {
      expect(parseProjectEvent(event(kind, payload)).ok).toBe(false);
    }
  });

  it("keeps the pre-speech-acts log format and manager rescope payload valid", () => {
    expect(
      parseProjectEvent(
        event(
          "work.rescoped",
          {
            workItemId: "work_parser",
            expectedContractRevision: 1,
            contractRevision: 2,
            contract,
          },
          { actor: undefined },
        ),
      ).ok,
    ).toBe(true);
    expect(
      parseProjectEvent({
        schemaVersion: 1,
        eventId: "event_legacy_transition",
        projectId: "project_alpha",
        workItemId: "work_parser",
        kind: "work.transitioned",
        occurredAt: "2026-10-04T12:00:00.000Z",
        receivedAt: "2026-10-04T12:00:00.000Z",
        source: "system",
        trust: "verified",
        payload: { workItemId: "work_parser", to: "active" },
      }).ok,
    ).toBe(true);
  });
});

describe("agent workspace command contract", () => {
  const base = {
    schemaVersion: 1,
    commandId: "command_speech_1",
    projectId: "project_alpha",
    expectedRevision: 9,
    actor: agentActor,
    intent: "work.ask_question",
    targetEntityId: "work_parser",
    payload: { question: "Which parser should I update?" },
  };

  it("accepts only the three proposal-authorized agent speech intents", () => {
    expect(validateWorkspaceCommand(base, { projectId: "project_alpha", revision: 9 }).ok).toBe(
      true,
    );
    for (const intent of [
      "work.propose_rescope",
      "work.dispute_send_back",
      "work.create",
      "work.assign",
      "work.record_evidence",
      "work.record_ruling",
      "work.decline_rescope",
    ]) {
      const result = validateWorkspaceCommand(
        { ...base, intent },
        { projectId: "project_alpha", revision: 9 },
      );
      if (intent === "work.propose_rescope" || intent === "work.dispute_send_back") {
        expect(result.ok).toBe(true);
      } else {
        expect(result).toEqual({ ok: false, code: "WORKSPACE_AUTHORITY_INVALID" });
      }
    }
  });

  it("applies the current project revision to agent commands", () => {
    expect(validateWorkspaceCommand(base, { projectId: "project_alpha", revision: 10 })).toEqual({
      ok: false,
      code: "WORKSPACE_COMMAND_STALE",
    });
  });

  it("does not let a manager impersonate an agent speech act", () => {
    expect(
      validateWorkspaceCommand(
        { ...base, actor: managerActor },
        { projectId: "project_alpha", revision: 9 },
      ),
    ).toEqual({ ok: false, code: "WORKSPACE_AUTHORITY_INVALID" });
  });
});
