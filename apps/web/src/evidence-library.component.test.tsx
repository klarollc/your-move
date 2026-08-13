import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EvidenceLibrary } from "./evidence-library.js";

afterEach(cleanup);

const knowledgeStatuses = [
  "authoritative",
  "approved",
  "provisional",
  "contested",
  "stale",
  "superseded",
  "rejected",
] as const;

const projection = {
  knowledge: knowledgeStatuses.map((status, index) => ({
    knowledgeId: `knowledge_${status}`,
    status,
    title: `${status} project record`,
    snippet: `Safe ${status} context`,
    revision: index + 1,
    originatingEntityId: "zone_library",
  })),
  evidence: [
    {
      evidenceId: "evidence_test",
      kind: "test",
      status: "complete",
      summary: "Automated verification completed; approval remains separate.",
      revision: 42,
      originatingEntityId: "agent_test_engineer",
      approved: false,
    },
    {
      evidenceId: "evidence_visual",
      kind: "visual",
      status: "approved",
      summary: "Graybox composition approved for the interaction gate.",
      revision: 42,
      originatingEntityId: "zone_review",
      approved: true,
    },
    {
      evidenceId: "evidence_release",
      kind: "release",
      status: "pending",
      summary: "Release review has not started.",
      revision: 42,
      originatingEntityId: "zone_delivery",
      approved: false,
    },
  ],
} as const;

describe("EvidenceLibrary", () => {
  it("keeps seven knowledge lifecycles and three evidence kinds visibly distinct", () => {
    render(
      <EvidenceLibrary
        projection={projection}
        onClose={() => undefined}
        onLocateOrigin={() => undefined}
      />,
    );

    expect(screen.getAllByTestId("knowledge-status").map((node) => node.textContent)).toEqual([
      "authoritative",
      "approved",
      "provisional",
      "contested",
      "stale",
      "superseded",
      "rejected",
    ]);
    expect(screen.getByRole("region", { name: "Test evidence" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Visual evidence" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Release evidence" })).toBeVisible();
    expect(screen.getByText("Complete — not approved")).toBeVisible();
    expect(screen.getByText("Approved")).toBeVisible();
  });

  it("keeps the focused evidence origin identifiable, reachable, and focus-restorable", async () => {
    const user = userEvent.setup();
    const onLocateOrigin = vi.fn();
    render(
      <EvidenceLibrary
        projection={projection}
        onClose={() => undefined}
        onLocateOrigin={onLocateOrigin}
      />,
    );
    const trigger = screen.getByRole("button", { name: "View Automated verification" });

    await user.click(trigger);
    const focused = screen.getByRole("dialog", { name: "Evidence: Automated verification" });
    expect(focused).toHaveTextContent("Originating office entity");
    expect(focused).toHaveTextContent("agent_test_engineer");
    expect(focused).toHaveTextContent("revision 42");

    await user.click(screen.getByRole("button", { name: "Locate origin in office" }));
    expect(onLocateOrigin).toHaveBeenCalledWith("agent_test_engineer");

    await user.click(screen.getByRole("button", { name: "Close evidence" }));
    expect(focused).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
