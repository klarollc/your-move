import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkSpeechActTruth } from "@cuckcode/domain";

import { WorkList, type WorkListItem, type WorkListLogEntry } from "./work-list.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const item: WorkListItem = {
  workItemId: "work_slugify",
  outcome: "Implement slugify",
  state: "assigned",
  group: "queued" as const,
  attentionReason: null,
  doneVerified: false,
  hasEvidenceFailure: false,
  condition: null,
  contract: {
    outcome: "Implement slugify",
    exclusions: ["Do not edit the test"],
    acceptanceCriteria: ["The test passes"],
    dependencies: [],
    evidenceObligations: [{ kind: "test-run", description: "Test output" }],
    permissionCeiling: {
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      networkAccess: false,
      windowsSandbox: "unelevated",
    },
    stopConditions: ["Stop if the granted posture differs"],
    definitionOfDone: "The manager reviews the evidence",
    contextRefs: [],
  },
  contractRevision: 1,
  contractHistory: [
    {
      revision: 1,
      eventId: "event_contract_1",
      contract: {
        outcome: "Implement slugify",
        exclusions: ["Do not edit the test"],
        acceptanceCriteria: ["The test passes"],
        dependencies: [],
        evidenceObligations: [{ kind: "test-run", description: "Test output" }],
        permissionCeiling: {
          sandboxMode: "workspace-write",
          approvalPolicy: "never",
          networkAccess: false,
          windowsSandbox: "unelevated",
        },
        stopConditions: ["Stop if the granted posture differs"],
        definitionOfDone: "The manager reviews the evidence",
        contextRefs: [],
      },
    },
  ],
  turnBudget: null,
  resurface: null,
  nudgeSuppression: null,
  nudgeSuppressed: false,
  nudges: [],
  currentRulingId: null,
  rulings: [],
  waitingMs: null,
  assignee: "Implementation Engineer",
  roleAssignmentId: "role-assignment_engineer",
  assignmentSourceRevision: 5,
  assignmentSource: "manager",
  assignmentTrust: "verified",
  partial: true,
  contractAcceptsEvidence: true,
  evidenceObligations: [{ kind: "test-run", description: "Test output" }],
  evidence: [],
  speechActs: [],
  postures: [],
  sourceRevision: 6,
  lastSignalRevision: 8,
  lastEvent: "10:10 AM",
};

const baseProps = {
  projectId: "project_slugify",
  projectName: "Slugify proof",
  revision: 8,
  currentRevision: 8,
  visitedRevision: null,
  onVisitRevision: vi.fn(),
  items: [item],
  assignments: [
    {
      roleAssignmentId: "role-assignment_engineer",
      label: "Implementation Engineer",
      sourceRevision: 2,
      source: "system",
      trust: "verified",
    },
  ],
  log: [],
  runner: { available: true, state: "idle" as const },
  health: {
    status: "current" as const,
    revision: 8,
    projectedRevision: 8,
    fetchedAt: "2026-10-04T10:00:00.000Z",
    ageMs: 0,
    issueCount: 0,
    issues: [],
  },
  onAssign: vi.fn(),
  onEvidence: vi.fn(),
  onReview: vi.fn(),
  onExecute: vi.fn(),
};

describe("Surface B work list", () => {
  it("cancels a confirmed-event journey when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const onCancelJourney = vi.fn();
    const { container } = render(
      <WorkList
        {...baseProps}
        journey={{
          id: 1,
          workItemId: item.workItemId,
          direction: "arrival",
          tint: "plain",
          title: item.outcome,
          from: { x: 0, y: 0, width: 100, height: 40 },
        }}
        onCancelJourney={onCancelJourney}
      />,
    );

    expect(onCancelJourney).toHaveBeenCalled();
    expect(container.querySelector(".workflow-journey-ghost")).not.toBeInTheDocument();
  });

  it("shows the canonical work row and labels an incomplete run as partial", async () => {
    const user = userEvent.setup();
    render(<WorkList {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Show all work" }));
    const row = screen.getByRole("article", { name: "Implement slugify" });
    expect(within(row).getByText("assigned")).toBeVisible();
    expect(within(row).getByText("Implementation Engineer")).toBeVisible();
    expect(within(row).getByText("Partial record")).toBeVisible();
  });

  it("starts execution and explains when agent drafting is unavailable", async () => {
    const user = userEvent.setup();
    render(<WorkList {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Run Implement slugify" }));
    expect(baseProps.onExecute).toHaveBeenCalledWith("work_slugify");

    await user.click(screen.getByRole("button", { name: "New work" }));
    expect(screen.getByRole("region", { name: "Describe the outcome" })).toHaveTextContent(
      "has not received separate owner authorization",
    );
  });

  it("projects the original candidate and manager-approved final terms as separate recorded data", async () => {
    const candidate = { ...item.contract!, outcome: "Agent candidate wording", maxTurns: 5 };
    const finalContract = { ...item.contract!, outcome: "Manager-approved wording", maxTurns: 5 };
    const withDraft: WorkListItem = {
      ...item,
      outcome: "Manager-approved wording",
      contract: finalContract,
      contractDraftSource: "agent",
      contractDraft: {
        candidate,
        provenance: {
          draftSource: "agent",
          draftId: "draft_surface_b_projection",
          procedureId: "contract-drafter-v1",
          procedureVersion: "1.0.0",
          procedureSha256: "a".repeat(64),
          runtime: "@openai/codex@0.157.1",
          model: "gpt-6.1-sol",
          providerSessionId: "provider-session-recorded",
          providerTurnId: "provider-turn-recorded",
          requestSha256: "b".repeat(64),
          candidateSha256: "c".repeat(64),
        },
      },
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[withDraft]} />);
    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Details for Manager-approved wording" }));

    const agreement = screen.getByRole("region", { name: "Work detail" });
    expect(agreement).toHaveTextContent("Agent candidate, before your edits");
    expect(agreement).toHaveTextContent("Manager-approved final contract");
    const editDiff = within(agreement).getByLabelText("Manager edit diff");
    expect(editDiff).toHaveTextContent("Agent candidate wording");
    expect(editDiff).toHaveTextContent("Manager-approved wording");
  });

  it("shows manager-authored source plainly without inventing an agent candidate", async () => {
    const user = userEvent.setup();
    const managerItem: WorkListItem = {
      ...item,
      contractDraftSource: "manager",
      contractDraft: { provenance: { draftSource: "manager" } },
    };
    render(<WorkList {...baseProps} items={[managerItem]} />);
    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));

    const agreement = screen.getByRole("region", { name: "Work detail" });
    expect(agreement).toHaveTextContent("Draft source: manager");
    expect(agreement).toHaveTextContent("Manager-authored contract");
    expect(agreement).not.toHaveTextContent("Agent candidate");
    expect(agreement).not.toHaveTextContent("source confirmed");
  });

  it("records the digest of the saved evidence artifact from Surface B", async () => {
    const user = userEvent.setup();
    render(<WorkList {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Record evidence" }));
    await user.type(screen.getByLabelText(/Saved output SHA-256/), "a".repeat(64));
    await user.click(screen.getByRole("button", { name: "Save evidence" }));
    expect(baseProps.onEvidence).toHaveBeenCalledWith("work_slugify", {
      kind: "test-run",
      result: "passed",
      outputSha256: "a".repeat(64),
    });
  });

  it("opens a focused detail in place, keeps the rail visible, and labels unsupported rulings", async () => {
    const reviewItem = {
      ...item,
      state: "review_requested",
      group: "your-move" as const,
      attentionReason: "review_requested",
      condition: {
        reasonCode: "review_requested",
        summary: "Evidence is ready for the manager.",
        waitingOn: { kind: "manager" },
        requestedAction: { kind: "approve", summary: "Accept or redirect this work." },
        source: "manager",
        trust: "verified",
        sourceRevision: 8,
      },
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[reviewItem]} />);

    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));

    expect(screen.getByRole("heading", { name: "What needs deciding" })).toBeVisible();
    expect(screen.getByText("Evidence is ready for the manager.")).toBeVisible();
    expect(screen.getByText("The test passes")).toBeVisible();
    expect(screen.getByText(/Risk is not recorded/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept as done" })).toBeDisabled();
    expect(screen.getByRole("complementary", { name: "Your move, unfiltered" })).toBeVisible();
  });

  it("shows attributed agent questions and proposal receipts without optimistic acceptance", async () => {
    const proposalContract = {
      ...item.contract!,
      outcome: "Preserve quoted values and whitespace",
    };
    const speechActItem = {
      ...item,
      speechActs: [
        {
          eventId: "event_question_9",
          workItemId: item.workItemId,
          occurredAt: "2026-10-04T10:00:09.000Z",
          sourceRevision: 9,
          source: "adapter",
          trust: "reported",
          actor: { actorType: "agent", actorId: "agent_engineer" },
          roleAssignmentId: "role-assignment_engineer",
          kind: "work.question_asked",
          question: "Which quote form should remain compatible?",
        },
        {
          eventId: "event_proposal_10",
          workItemId: item.workItemId,
          occurredAt: "2026-10-04T10:00:10.000Z",
          sourceRevision: 10,
          source: "adapter",
          trust: "reported",
          actor: { actorType: "agent", actorId: "agent_engineer" },
          roleAssignmentId: "role-assignment_engineer",
          kind: "work.rescope_proposed",
          proposalId: "rescope-proposal_quote",
          expectedContractRevision: 1,
          contract: proposalContract,
          status: "open",
        },
      ] satisfies WorkSpeechActTruth[],
    };
    const log: WorkListLogEntry[] = [
      {
        eventId: "event_question_9",
        kind: "work.question_asked",
        summary: "Question asked · Which quote form should remain compatible?",
        source: "adapter",
        trust: "reported",
        occurredAt: "2026-10-04T10:00:09.000Z",
        workItemId: item.workItemId,
        revision: 9,
        actor: { actorType: "agent", actorId: "agent_engineer" },
      },
      {
        eventId: "event_proposal_10",
        kind: "work.rescope_proposed",
        summary: "Agreement change proposed · Preserve quoted values and whitespace",
        source: "adapter",
        trust: "reported",
        occurredAt: "2026-10-04T10:00:10.000Z",
        workItemId: item.workItemId,
        revision: 10,
        actor: { actorType: "agent", actorId: "agent_engineer" },
      },
    ];
    const onRescope = vi.fn();
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[speechActItem]} log={log} onRescope={onRescope} />);

    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));

    expect(screen.getByText("Which quote form should remain compatible?")).toBeVisible();
    expect(screen.getByText(/agent_engineer · adapter · reported · r9/)).toBeVisible();
    expect(screen.getByRole("region", { name: "Contributions" })).toHaveTextContent(
      "Preserve quoted values and whitespace",
    );
    expect(screen.getByText(/agent_engineer · adapter · reported · r10/)).toBeVisible();
    expect(screen.getByText("Not recorded yet")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Approve proposed agreement" }));

    expect(onRescope).toHaveBeenCalledWith(
      "work_slugify",
      1,
      proposalContract,
      "rescope-proposal_quote",
    );
    expect(screen.getByRole("heading", { name: "Work: Implement slugify" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve proposed agreement" })).toBeEnabled();
    expect(screen.getByText("Not recorded yet")).toBeVisible();
  });

  it("refuses a stale proposal approval and disables proposal writes in a past projection", async () => {
    const staleProposal = {
      ...item,
      state: "review_requested",
      contractRevision: 2,
      speechActs: [
        {
          eventId: "event_stale_proposal",
          workItemId: item.workItemId,
          occurredAt: "2026-10-04T10:00:10.000Z",
          sourceRevision: 10,
          source: "adapter",
          trust: "reported",
          actor: { actorType: "agent", actorId: "agent_engineer" },
          roleAssignmentId: "role-assignment_engineer",
          kind: "work.rescope_proposed",
          proposalId: "rescope-proposal_stale",
          expectedContractRevision: 1,
          contract: item.contract!,
          status: "open",
        },
      ] satisfies WorkSpeechActTruth[],
    };
    const onRescope = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkList
        {...baseProps}
        items={[staleProposal]}
        visitedRevision={7}
        revision={7}
        actionsDisabled
        onRescope={onRescope}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));
    expect(screen.getByText(/based on agreement r1; current agreement r2/u)).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve proposed agreement" })).toBeDisabled();
    expect(screen.getByText("Viewing the past · r7. You cannot rule on the past.")).toBeVisible();
    expect(onRescope).not.toHaveBeenCalled();
  });

  it("requires a manager reason to decline and waits for the log before changing proposal status", async () => {
    const candidateContract = { ...item.contract!, maxTurns: 5 };
    const pendingProposal = {
      ...item,
      speechActs: [
        {
          eventId: "event_decline_proposal",
          workItemId: item.workItemId,
          occurredAt: "2026-10-04T10:00:10.000Z",
          sourceRevision: 10,
          source: "adapter",
          trust: "reported",
          actor: { actorType: "agent", actorId: "agent_engineer" },
          roleAssignmentId: "role-assignment_engineer",
          kind: "work.rescope_proposed",
          proposalId: "rescope-proposal_decline-ui",
          expectedContractRevision: 1,
          contract: candidateContract,
          status: "open",
        },
      ] satisfies WorkSpeechActTruth[],
    };
    const onDeclineRescope = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkList {...baseProps} items={[pendingProposal]} onDeclineRescope={onDeclineRescope} />,
    );

    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));
    const decline = screen.getByRole("button", { name: "Decline proposed agreement" });
    expect(decline).toBeDisabled();
    await user.type(screen.getByLabelText("Reason for declining"), "  Keep the agreed scope.  ");
    expect(decline).toBeEnabled();
    await user.click(decline);

    expect(onDeclineRescope).toHaveBeenCalledWith(
      "work_slugify",
      "rescope-proposal_decline-ui",
      "Keep the agreed scope.",
    );
    expect(screen.getByRole("region", { name: "Contributions" })).toHaveTextContent("open");
  });

  it("keeps the rail on the Log view and can group the same log projection by assignee", async () => {
    const user = userEvent.setup();
    render(
      <WorkList {...baseProps} items={[{ ...item, state: "active", group: "in-progress" }]} />,
    );

    await user.click(screen.getByRole("button", { name: "Log" }));
    expect(screen.getByRole("complementary", { name: "Your move, unfiltered" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Today" }));
    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "By assignee" }));

    expect(screen.getByRole("heading", { name: "Implementation Engineer" })).toBeVisible();
    expect(screen.getByText(/1 underway/)).toBeVisible();
  });

  it("starts a read-only ruling session and skips a matter without changing the log projection", async () => {
    const first = {
      ...item,
      workItemId: "work_first",
      outcome: "First review",
      state: "review_requested",
      group: "your-move" as const,
      attentionReason: "review_requested",
      waitingMs: 90_000,
    };
    const second = {
      ...item,
      workItemId: "work_second",
      outcome: "Second review",
      state: "blocked",
      group: "your-move" as const,
      attentionReason: "blocked",
      waitingMs: 30_000,
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[first, second]} />);

    await user.click(screen.getByRole("button", { name: "Start ruling session" }));
    expect(screen.getByRole("heading", { name: "First review" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("heading", { name: "Second review" })).toBeVisible();
    expect(
      screen.queryByRole("complementary", { name: "Your move, unfiltered" }),
    ).not.toBeInTheDocument();
    expect(baseProps.onReview).not.toHaveBeenCalled();
  });

  it("shows an away digest from log events instead of the all-clear screen", async () => {
    window.localStorage.setItem("your-move:last-seen-revision:project_slugify", "7");
    const user = userEvent.setup();
    render(
      <WorkList
        {...baseProps}
        log={[
          {
            eventId: "event_digest_8",
            kind: "work.transitioned",
            summary: "active",
            source: "adapter",
            trust: "reported",
            occurredAt: "2026-10-04T10:10:00.000Z",
            workItemId: "work_slugify",
            revision: 8,
          },
        ]}
      />,
    );

    expect(await screen.findByRole("heading", { name: "While you were away" })).toBeVisible();
    expect(screen.getByText("active")).toBeVisible();
    expect(screen.queryByRole("region", { name: "All clear" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close digest" }));
    expect(screen.getByRole("region", { name: "All clear" })).toBeVisible();
  });

  it("shows >3 day quiet suggestions as dashed, disabled proposals derived from last signals", async () => {
    const quietItem: WorkListItem = {
      ...item,
      state: "active",
      group: "in-progress",
      lastEvent: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      lastSignalRevision: 6,
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[quietItem]} />);
    await user.click(screen.getByRole("button", { name: "Show all work" }));

    const rail = screen.getByRole("complementary", { name: "Your move, unfiltered" });
    const suggestions = within(rail).getByRole("region", { name: "Quiet suggestions" });
    expect(suggestions).toHaveTextContent("More than 3 days without a recorded signal");
    expect(within(suggestions).getByRole("button", { name: "Send nudge" })).toBeDisabled();
    expect(within(suggestions).getByRole("button", { name: "Snooze 2 days" })).toBeDisabled();
  });

  it("keeps verified failures in terra and includes the failure in the focused decision", async () => {
    const failedItem: WorkListItem = {
      ...item,
      state: "active",
      group: "your-move",
      attentionReason: "verification_failed",
      hasEvidenceFailure: true,
      evidence: [
        {
          kind: "test-run",
          result: "failed",
          eventId: "event_failed_test",
          status: "checked",
          source: "manager",
          trust: "verified",
          sourceRevision: 8,
          occurredAt: "2026-10-04T10:00:00.000Z",
          providerRunId: null,
          worktreeSha256: null,
          outputSha256: "b".repeat(64),
        },
      ],
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[failedItem]} />);
    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));

    expect(
      screen.getByRole("heading", { name: "Verification failed: Implement slugify" }),
    ).toBeVisible();
    expect(screen.getByText("Checked · failed")).toHaveClass(
      "workflow-evidence-state",
      "is-failed",
    );
    expect(screen.getByRole("button", { name: "Accept with exception" })).toBeDisabled();
  });

  it("shows each obligation's evidence state in the ruling-session card", async () => {
    const sessionItem: WorkListItem = {
      ...item,
      state: "review_requested",
      group: "your-move",
      attentionReason: "review_requested",
      evidenceObligations: [
        { kind: "checked-line", description: "Checked deliverable" },
        { kind: "recorded-line", description: "Recorded deliverable" },
        { kind: "claim-line", description: "Claimed deliverable" },
        { kind: "missing-line", description: "Missing deliverable" },
      ],
      evidence: [
        { ...evidenceLine("checked-line", "checked", 1), result: "passed" },
        { ...evidenceLine("recorded-line", "recorded", 2), result: "passed" },
        { ...evidenceLine("claim-line", "claimed", 3), result: "passed" },
      ],
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[sessionItem]} />);

    await user.click(screen.getByRole("button", { name: "Start ruling session" }));
    const card = screen.getByRole("region", { name: "Ruling session" });
    expect(within(card).getByText("Checked · passed")).toBeVisible();
    expect(within(card).getByText("Recorded · not yet checked")).toBeVisible();
    expect(within(card).getByText("Claimed · says it is done")).toBeVisible();
    expect(within(card).getByText("Not recorded yet")).toBeVisible();
  });

  it("requires a reason for exception acceptance and leaves evidence states unchanged", async () => {
    const onRuling = vi.fn();
    const reviewItem: WorkListItem = {
      ...item,
      state: "review_requested",
      group: "your-move",
      attentionReason: "review_requested",
      evidence: [evidenceLine("test-run", "claimed", 8)],
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[reviewItem]} onRuling={onRuling} />);

    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));
    await user.click(screen.getByRole("button", { name: "Accept with exception" }));
    const confirm = screen.getByRole("button", { name: "Record exception ruling" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Override reason"), "The owner accepts this gap.");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onRuling).toHaveBeenCalledWith("work_slugify", {
      decision: "accept_with_exception",
      reason: "The owner accepts this gap.",
    });
    expect(screen.getByText("Claimed · says it is done")).toBeVisible();
    expect(screen.getByText(/worktree SHA-256 missing/u)).toBeVisible();
  });

  it("captures defer as a reason and an actual future UTC date-time", async () => {
    const onRuling = vi.fn();
    const reviewItem: WorkListItem = {
      ...item,
      state: "review_requested",
      group: "your-move",
      attentionReason: "review_requested",
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[reviewItem]} onRuling={onRuling} />);

    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));
    await user.click(screen.getByRole("button", { name: "Defer" }));
    const confirm = screen.getByRole("button", { name: "Record defer" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Defer reason"), "Waiting for the maintainer.");
    const dateTime = screen.getByLabelText(/Resurface at/u);
    expect(dateTime).toHaveAttribute("type", "datetime-local");
    fireEvent.change(dateTime, { target: { value: "2030-01-02T12:30" } });
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onRuling).toHaveBeenCalledWith("work_slugify", {
      decision: "defer",
      reason: "Waiting for the maintainer.",
      resurfaceAt: new Date("2030-01-02T12:30").toISOString(),
    });
  });

  it("states what the ruling event records and does not claim notification", async () => {
    const reviewItem: WorkListItem = {
      ...item,
      state: "verified_with_exception",
      group: "other",
      attentionReason: null,
    };
    const user = userEvent.setup();
    render(
      <WorkList
        {...baseProps}
        items={[reviewItem]}
        log={[
          {
            eventId: "event_ruling_9",
            kind: "work.ruling_recorded",
            summary: "Accepted with exception · The owner accepts this gap.",
            source: "manager",
            trust: "verified",
            occurredAt: "2026-10-04T10:01:00.000Z",
            workItemId: "work_slugify",
            revision: 9,
          },
        ]}
        currentRevision={9}
        revision={9}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));
    const receipt = screen.getByRole("region", { name: "Ruling receipt" });
    expect(receipt).toHaveTextContent("Recorded at r9");
    expect(receipt).toHaveTextContent("visible on next check-in");
    expect(receipt).not.toHaveTextContent(/sent|notified/i);
  });

  it("reports the count of away events omitted from the digest", async () => {
    window.localStorage.setItem("your-move:last-seen-revision:project_slugify", "0");
    const log = Array.from({ length: 10 }, (_, index) => ({
      eventId: `event_digest_${index + 1}`,
      kind: "work.transitioned",
      summary: `signal ${index + 1}`,
      source: "adapter",
      trust: "reported",
      occurredAt: new Date(Date.UTC(2026, 9, 4, 10, 0, index + 1)).toISOString(),
      workItemId: "work_slugify",
      revision: index + 1,
    }));
    render(<WorkList {...baseProps} revision={10} currentRevision={10} log={log} />);

    expect(await screen.findByText("2 events not shown in this digest.")).toBeVisible();
  });

  it("refuses all ruling writes while the visible projection is in the past", async () => {
    const onRuling = vi.fn();
    const reviewItem: WorkListItem = {
      ...item,
      state: "review_requested",
      group: "your-move",
      attentionReason: "review_requested",
    };
    const user = userEvent.setup();
    render(
      <WorkList
        {...baseProps}
        items={[reviewItem]}
        revision={7}
        visitedRevision={7}
        actionsDisabled
        onRuling={onRuling}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));
    expect(screen.getByRole("button", { name: "Accept with exception" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Defer" })).toBeDisabled();
    expect(onRuling).not.toHaveBeenCalled();
  });

  it("does not suggest a quiet task while its log-derived suppression window is active", async () => {
    const quietItem: WorkListItem = {
      ...item,
      state: "active",
      group: "in-progress",
      nudgeSuppressed: true,
      nudgeSuppression: {
        disposition: "snooze",
        until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        eventId: "event_suppression_9",
        sourceRevision: 9,
      },
      lastEvent: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[quietItem]} />);
    await user.click(screen.getByRole("button", { name: "Show all work" }));

    expect(screen.queryByRole("region", { name: "Quiet suggestions" })).not.toBeInTheDocument();
  });

  it("shows manager queue age in plain words from the projected wait duration", async () => {
    const waiting: WorkListItem = {
      ...item,
      state: "review_requested",
      group: "your-move",
      attentionReason: "review_requested",
      waitingMs: 6 * 24 * 60 * 60 * 1000,
    };
    render(<WorkList {...baseProps} items={[waiting]} />);

    expect(screen.getByRole("complementary", { name: "Your move, unfiltered" })).toHaveTextContent(
      "your move for 6 days",
    );
  });

  it("does not present an unrecorded turn budget as zero turns used", async () => {
    const noBudget: WorkListItem = {
      ...item,
      turnBudget: {
        budgetRecorded: false,
        budgetRevision: 1,
        baseMaxTurns: null,
        grantedTurns: 0,
        effectiveMaxTurns: null,
        usedTurns: 0,
        remainingTurns: 0,
        exhausted: false,
        countComplete: true,
      },
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[noBudget]} />);
    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));

    const budget = screen.getByRole("region", { name: "Turn budget" });
    expect(budget).toHaveTextContent("No turn budget is recorded. Turn use is unavailable.");
    expect(budget).not.toHaveTextContent("0 turns used");
    expect(within(budget).queryByLabelText("Grant more turns")).not.toBeInTheDocument();
  });

  it("grants the entered positive turn count instead of a fixed amount", async () => {
    const onGrantTurns = vi.fn();
    const budgeted: WorkListItem = {
      ...item,
      state: "paused",
      group: "your-move",
      attentionReason: "turns_exhausted",
      turnBudget: {
        budgetRecorded: true,
        budgetRevision: 2,
        baseMaxTurns: 4,
        grantedTurns: 0,
        effectiveMaxTurns: 4,
        usedTurns: 4,
        remainingTurns: 0,
        exhausted: true,
        countComplete: true,
      },
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[budgeted]} onGrantTurns={onGrantTurns} />);
    await user.click(screen.getByRole("button", { name: "Details for Implement slugify" }));
    await user.type(screen.getByLabelText("Grant more turns"), "7");
    await user.click(screen.getByRole("button", { name: "Grant turns" }));

    expect(onGrantTurns).toHaveBeenCalledWith("work_slugify", 7, 2);
    expect(screen.getByRole("region", { name: "Turn budget" })).toHaveTextContent("4 turns used");
  });

  it("shows a full old-to-new agreement diff and submits the replacement contract", async () => {
    const onRescope = vi.fn();
    const previous = item.contract!;
    const current = { ...previous, outcome: "Implement slugify with Unicode normalization" };
    const changed: WorkListItem = {
      ...item,
      contract: current,
      contractRevision: 2,
      contractHistory: [
        { revision: 1, eventId: "event_contract_1", contract: previous },
        { revision: 2, eventId: "event_contract_9", contract: current },
      ],
      state: "blocked",
      group: "your-move",
      attentionReason: "blocked",
    };
    const user = userEvent.setup();
    render(<WorkList {...baseProps} items={[changed]} onRescope={onRescope} />);
    await user.click(screen.getByRole("button", { name: "By assignee" }));
    await user.click(screen.getByRole("button", { name: "Implement slugify" }));
    const detail = screen.getByRole("region", { name: "Work detail" });
    expect(
      within(detail).getByText(/Implement slugify → Implement slugify with Unicode normalization/u),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Re-scope agreement" }));
    await user.clear(screen.getByLabelText("Outcome"));
    await user.type(screen.getByLabelText("Outcome"), "Unicode-safe slugify");
    await user.type(screen.getByLabelText("Turn cap"), "4");
    await user.click(screen.getByRole("button", { name: "Record replacement agreement" }));

    expect(onRescope).toHaveBeenCalledWith(
      "work_slugify",
      2,
      expect.objectContaining({
        outcome: "Unicode-safe slugify",
        maxTurns: 4,
        evidenceObligations: [{ kind: "test-run", description: "Test output" }],
        permissionCeiling: previous.permissionCeiling,
        contextRefs: [],
      }),
    );
  });
});

function evidenceLine(
  kind: string,
  status: WorkListItem["evidence"][number]["status"],
  sourceRevision: number,
) {
  return {
    kind,
    result: "passed",
    eventId: `event_${kind}`,
    status,
    source: status === "claimed" ? "adapter" : "manager",
    trust: status === "checked" ? "verified" : "reported",
    sourceRevision,
    occurredAt: "2026-10-04T10:00:00.000Z",
    providerRunId: null,
    worktreeSha256: null,
    outputSha256: null,
  } as const;
}
