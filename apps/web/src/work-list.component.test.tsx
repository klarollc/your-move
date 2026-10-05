import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkList, type WorkListItem } from "./work-list.js";

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
  waitingMs: null,
  assignee: "Implementation Engineer",
  assignmentSourceRevision: 5,
  assignmentSource: "manager",
  assignmentTrust: "verified",
  partial: true,
  contractAcceptsEvidence: true,
  evidenceObligations: [{ kind: "test-run", description: "Test output" }],
  evidence: [],
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

  it("starts execution and refuses creation while the real contract-draft service is absent", async () => {
    const user = userEvent.setup();
    render(<WorkList {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Show all work" }));
    await user.click(screen.getByRole("button", { name: "Run Implement slugify" }));
    expect(baseProps.onExecute).toHaveBeenCalledWith("work_slugify");

    await user.click(screen.getByRole("button", { name: "New work" }));
    expect(screen.getByRole("region", { name: "Describe the outcome" })).toHaveTextContent(
      "The current workflow core has no draft service, so this view will not create work.",
    );
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
    expect(within(suggestions).getByRole("button", { name: "Snooze 2d" })).toBeDisabled();
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
    expect(screen.getByRole("button", { name: "Accept anyway" })).toBeDisabled();
  });
});
