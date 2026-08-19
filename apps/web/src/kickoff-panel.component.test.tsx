import "@testing-library/jest-dom/vitest";
import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";
import { projectKickoffReadModel } from "@cuckcode/application";
import { createKickoff, recordKickoffContribution, recordKickoffSynthesis } from "@cuckcode/domain";
import type { KickoffState } from "@cuckcode/domain";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KickoffPanel } from "./kickoff-panel.js";

afterEach(cleanup);

const roleIds = ["delivery", "design", "implementation", "test", "visual", "release"];
const roleLabels: Record<string, string> = {
  delivery: "Delivery Lead",
  design: "Product Designer",
  implementation: "Implementation Engineer",
  test: "Test Engineer",
  visual: "Visual QA Reviewer",
  release: "Release Reviewer",
};

const briefing: KickoffBriefing = {
  schemaVersion: 1,
  kickoffId: "kickoff_1",
  projectId: "project_graybox",
  briefingVersion: 3,
  goal: "Choose the first project goal collaboratively.",
  constraints: ["No pre-charter implementation"],
  permissions: ["project.read"],
  evidenceFloor: ["test", "visual", "release"],
  knowledgeSnapshotId: "snapshot_42",
  managerNonNegotiables: ["Six attributable roles"],
  activeRoleIds: roleIds,
};

function contribution(roleId: string, overrides: Partial<KickoffContribution> = {}) {
  return {
    schemaVersion: 1,
    contributionId: `contribution_${roleId}`,
    kickoffId: "kickoff_1",
    briefingVersion: 3,
    roleId,
    agentId: `agent_${roleId}`,
    kind: "proposal",
    goal: `${roleId} goal`,
    value: `${roleId} value`,
    risk: `${roleId} risk`,
    dependencies: [],
    acceptanceCriteria: [`${roleId} criterion`],
    evidenceNeeds: [`${roleId} evidence`],
    uncertainties: [],
    disagreements: [],
    ...overrides,
  } as KickoffContribution;
}

function stateWithSixEntries(): KickoffState {
  let state = createKickoff(briefing);
  for (const roleId of roleIds) {
    const next = recordKickoffContribution(
      state,
      contribution(
        roleId,
        roleId === "release"
          ? { disagreements: ["Independent review must stay separate from delivery"] }
          : {},
      ),
    );
    if (!next.ok) throw new Error(next.code);
    state = next.state;
  }
  return state;
}

function stateInRevision(): KickoffState {
  const synthesised = recordKickoffSynthesis(stateWithSixEntries(), {
    synthesisId: "synthesis_1",
    authorRoleId: "delivery",
    proposedGoal: "Build the Decision Notice as the first isolated slice.",
    includedContributionIds: roleIds.map((roleId) => `contribution_${roleId}`),
    disagreementRegister: [
      { roleId: "release", statement: "Independent review must stay separate from delivery" },
    ],
    unresolvedEvidenceGaps: ["No rendered evidence exists yet"],
  });
  if (!synthesised.ok) throw new Error(synthesised.code);
  return synthesised.state;
}

const render_ = (state: KickoffState) =>
  render(<KickoffPanel model={projectKickoffReadModel(state)} roleLabels={roleLabels} />);

describe("KickoffPanel", () => {
  it("shows the shared briefing version so a mismatch cannot hide", () => {
    render_(stateWithSixEntries());
    const panel = screen.getByRole("region", { name: "Collaborative kickoff" });
    expect(panel).toHaveTextContent("Briefing version 3");
  });

  it("names all six roles and attributes every entry to a role and an agent", () => {
    render_(stateWithSixEntries());
    const entries = screen.getByRole("list", { name: "Role contributions" });
    for (const roleId of roleIds) {
      const item = within(entries).getByTestId(`kickoff-entry-${roleId}`);
      expect(item).toHaveTextContent(roleLabels[roleId] as string);
      expect(item).toHaveTextContent(`agent_${roleId}`);
      expect(item).toHaveTextContent(`${roleId} value`);
      expect(item).toHaveTextContent(`${roleId} risk`);
    }
  });

  it("preserves an attributed disagreement rather than merging it away", () => {
    render_(stateInRevision());
    const register = screen.getByRole("list", { name: "Disagreement register" });
    expect(register).toHaveTextContent("Release Reviewer");
    expect(register).toHaveTextContent("Independent review must stay separate from delivery");
  });

  it("shows an unanswered role as no response recorded, never as agreement", () => {
    render_(stateInRevision());
    const revisions = screen.getByRole("list", { name: "Revision responses" });
    const item = within(revisions).getByTestId("kickoff-revision-design");
    expect(item).toHaveTextContent("No response recorded");
    expect(item).not.toHaveTextContent(/agreed|affirmed/iu);
  });

  it("states plainly that no work is authorised before a charter exists", () => {
    render_(stateInRevision());
    const impact = screen.getByTestId("kickoff-decision-impact");
    expect(impact).toHaveTextContent("No work is authorised yet");
  });

  it("names the missing contributions instead of inferring consensus", () => {
    let state = createKickoff(briefing);
    const partial = recordKickoffContribution(state, contribution("delivery"));
    if (!partial.ok) throw new Error(partial.code);
    state = partial.state;
    render_(state);
    const blocked = screen.getByTestId("kickoff-synthesis-blocked");
    expect(blocked).toHaveTextContent("Product Designer");
    expect(blocked).toHaveTextContent("Release Reviewer");
    expect(blocked).not.toHaveTextContent("Delivery Lead");
  });

  it("renders an explicit manager edit diff rather than a silent replacement", () => {
    render(
      <KickoffPanel
        model={projectKickoffReadModel(stateInRevision(), {
          managerDraft: { goal: "Original goal", scope: ["a"] },
          managerEdit: { goal: "Edited goal", scope: ["a", "b"] },
        })}
        roleLabels={roleLabels}
      />,
    );
    const diff = screen.getByRole("list", { name: "Manager edits" });
    expect(diff).toHaveTextContent("Original goal");
    expect(diff).toHaveTextContent("Edited goal");
  });

  it("exposes no transcript surface", () => {
    render_(stateInRevision());
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.queryByText(/transcript/iu)).not.toBeInTheDocument();
  });
});
