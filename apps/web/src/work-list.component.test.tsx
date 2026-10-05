import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkList } from "./work-list.js";

afterEach(cleanup);

const item = {
  workItemId: "work_slugify",
  outcome: "Implement slugify",
  state: "assigned",
  assignee: "Implementation Engineer",
  partial: true,
  contractAcceptsEvidence: true,
  evidenceObligations: [{ kind: "test-run", description: "Test output" }],
  evidence: [],
  postures: [],
  lastEvent: "10:10 AM",
  approval: {
    status: "unresolved",
    approvalId: null,
    requiredEvidenceKinds: [],
    missingEvidenceKinds: [],
  },
};

const baseProps = {
  projectName: "Slugify proof",
  revision: 8,
  items: [item],
  assignments: [{ roleAssignmentId: "role-assignment_engineer", label: "Implementation Engineer" }],
  runner: { available: true, state: "idle" as const },
  onCreate: vi.fn(),
  onAssign: vi.fn(),
  onEvidence: vi.fn(),
  onReview: vi.fn(),
  onExecute: vi.fn(),
};

describe("Surface B work list", () => {
  it("shows the canonical work row and labels an incomplete run as partial", () => {
    render(<WorkList {...baseProps} />);
    const row = screen.getByRole("article", { name: "Implement slugify" });
    expect(within(row).getByText("assigned")).toBeVisible();
    expect(within(row).getByText("Implementation Engineer")).toBeVisible();
    expect(within(row).getByText("Partial record")).toBeVisible();
  });

  it("starts execution from the assigned row and creates work from the list", async () => {
    const user = userEvent.setup();
    render(<WorkList {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Run Implement slugify" }));
    expect(baseProps.onExecute).toHaveBeenCalledWith("work_slugify");

    await user.click(screen.getByRole("button", { name: "New work" }));
    const dialog = screen.getByRole("region", { name: "Create work" });
    await user.type(within(dialog).getByLabelText("Outcome"), "Prepare a summary");
    await user.type(within(dialog).getByLabelText(/Acceptance criteria/), "Summary is reviewed");
    await user.click(within(dialog).getByRole("button", { name: "Create work" }));
    expect(baseProps.onCreate).toHaveBeenCalledWith({
      outcome: "Prepare a summary",
      acceptanceCriteria: ["Summary is reviewed"],
    });
  });

  it("records the digest of the saved evidence artifact from Surface B", async () => {
    const user = userEvent.setup();
    render(<WorkList {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Record evidence" }));
    await user.type(screen.getByLabelText(/Saved output SHA-256/), "a".repeat(64));
    await user.click(screen.getByRole("button", { name: "Save evidence" }));
    expect(baseProps.onEvidence).toHaveBeenCalledWith("work_slugify", {
      kind: "test-run",
      result: "passed",
      outputSha256: "a".repeat(64),
    });
  });
});
