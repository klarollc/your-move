import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { AttentionDisposition, OfficeAttentionItem } from "./attention-rail.js";
import { OfficeShell, officeShellEntities, type OfficeShellState } from "./office-shell.js";

const zones = [
  "Reception",
  "Team work area",
  "Project Library",
  "Collaboration table",
  "Review station",
  "Manager desk",
  "Delivery area",
];

afterEach(cleanup);

const people = [
  "Delivery Lead",
  "Product Designer",
  "Implementation Engineer",
  "Test Engineer",
  "Visual QA Reviewer",
  "Release Reviewer",
];

describe("OfficeShell", () => {
  it("keeps the office primary while exposing an equivalent keyboard-first outline", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);

    expect(screen.getAllByTestId("persistent-structure")).toHaveLength(3);
    expect(screen.getByRole("banner", { name: "Project bar" })).toHaveTextContent("CuckCode");
    expect(screen.getByRole("region", { name: "Office scene" })).toHaveAttribute(
      "data-scene-entity-ids",
      officeShellEntities.map(({ entityId }) => entityId).join(","),
    );

    const outline = screen.getByRole("region", { name: "Office outline" });
    for (const zone of zones) expect(outline).toHaveTextContent(zone);
    for (const person of people) {
      expect(screen.getByRole("button", { name: `Inspect ${person}` })).toBeVisible();
    }
    expect(outline.querySelectorAll("[data-canvas-twin-id]")).toHaveLength(13);
    expect(outline).toHaveTextContent("Reports to Delivery Lead");

    await user.click(screen.getByRole("link", { name: "Skip to Office outline" }));
    expect(outline).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Workspace current");
  });

  it("shares stable selection with a complete inspector and restores trigger focus", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    const trigger = screen.getByRole("button", { name: "Inspect Implementation Engineer" });

    expect(
      screen.queryByRole("complementary", { name: "Entity inspector" }),
    ).not.toBeInTheDocument();
    await user.click(trigger);

    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    expect(inspector).toHaveAttribute("data-selected-entity-id", "agent_implementation_engineer");
    for (const label of [
      "State",
      "Cause",
      "Updated",
      "Freshness",
      "Current work",
      "Blocker",
      "Evidence",
      "Runtime binding",
      "Permissions",
      "Technical trail",
    ]) {
      expect(inspector).toHaveTextContent(label);
    }
    expect(screen.getByRole("region", { name: "Office scene" })).toHaveAttribute(
      "data-selected-entity-id",
      "agent_implementation_engineer",
    );

    await user.keyboard("{Escape}");
    expect(inspector).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it.each<{
    state: Exclude<OfficeShellState, "ready">;
    cause: RegExp;
    recovery: string;
  }>([
    { state: "loading", cause: /persisted workspace snapshot/i, recovery: "Cancel loading" },
    { state: "empty", cause: /no project has been selected/i, recovery: "Choose project" },
    {
      state: "partial",
      cause: /two agent records are unavailable/i,
      recovery: "Retry missing records",
    },
    { state: "error", cause: /workspace stream was rejected/i, recovery: "Retry workspace" },
    { state: "stale", cause: /freshness window/i, recovery: "Refresh workspace" },
    { state: "offline", cause: /loopback runtime is unavailable/i, recovery: "Reconnect runtime" },
    { state: "canvas-loss", cause: /webgl context is unavailable/i, recovery: "Retry canvas" },
  ])("preserves cause, outline, and manager actions in $state", ({ state, cause, recovery }) => {
    render(<OfficeShell state={state} />);

    expect(screen.getByRole("region", { name: "Office outline" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset view" })).toBeEnabled();
    expect(screen.getByTestId("workspace-cause")).toHaveTextContent(cause);
    expect(screen.getByRole("button", { name: recovery })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(state);
  });
});

describe("OfficeShell manager attention", () => {
  const attentionItems = [
    {
      attentionId: "attention_blocked_test",
      entityId: "agent_test_engineer",
      label: "Test evidence is blocked",
      reason: "blocked",
      priority: 10,
      causeEventId: "event_test_blocked",
      plainLanguage: "The Test Engineer needs the current browser evidence.",
      requiredAction: "Redirect the evidence request or decline the blocker.",
    },
    {
      attentionId: "attention_graybox_review",
      entityId: "agent_implementation_engineer",
      label: "Graybox review requested",
      reason: "review_requested",
      priority: 40,
      causeEventId: "event_review_requested",
      plainLanguage: "The Implementation Engineer is waiting for a manager disposition.",
      requiredAction: "Approve, decline, defer, cancel, or redirect the request.",
    },
  ] as const;

  const fixtureDisposition = (item: OfficeAttentionItem, intent: AttentionDisposition) => ({
    ok: true as const,
    receipt: {
      receiptId: `receipt_command_${item.attentionId}_${intent}`,
      acceptedRevision: 42,
      resultingRevision: 43,
      targetEntityId: item.entityId,
      disposition: intent,
      correlationId: `command_${item.attentionId}_${intent}`,
      agentVisible: true as const,
    },
  });

  it("uses canonical order, locates the office target, and restores rail focus", async () => {
    const user = userEvent.setup();
    render(
      <OfficeShell state="ready" attention={attentionItems} onDisposition={fixtureDisposition} />,
    );
    const trigger = screen.getByRole("button", { name: "Manager attention (2)" });

    expect(screen.queryByRole("complementary", { name: "Manager attention" })).toBeNull();
    await user.click(trigger);
    const rail = screen.getByRole("complementary", { name: "Manager attention" });
    expect(rail.querySelectorAll("[data-attention-id]")[0]).toHaveAttribute(
      "data-attention-id",
      "attention_blocked_test",
    );

    await user.click(screen.getByRole("button", { name: "Locate Test evidence is blocked" }));
    expect(screen.getByRole("region", { name: "Office scene" })).toHaveAttribute(
      "data-selected-entity-id",
      "agent_test_engineer",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "Entity inspector" })).toBeNull();
    expect(rail).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Close attention" }));
    expect(rail).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps dismissal separate from approval and exposes exact attributable receipts", async () => {
    const user = userEvent.setup();
    render(
      <OfficeShell state="ready" attention={attentionItems} onDisposition={fixtureDisposition} />,
    );
    await user.click(screen.getByRole("button", { name: "Manager attention (2)" }));

    await user.click(screen.getByRole("button", { name: "Dismiss Test evidence is blocked" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Test evidence is blocked dismissed from this view; no disposition was recorded",
    );
    expect(screen.queryByText(/receipt_command_attention/i)).toBeNull();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Disposition for Graybox review requested" }),
      "approve",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Reason for Graybox review requested" }),
      "Reviewed against the bounded graybox gate.",
    );
    await user.click(screen.getByRole("button", { name: "Submit Graybox review requested" }));

    const receipt = screen.getByRole("status", { name: "Disposition receipt" });
    expect(receipt).toHaveTextContent("receipt_command_attention_graybox_review_approve");
    expect(receipt).toHaveTextContent("revision 42 → 43");
    expect(receipt).toHaveTextContent("agent_implementation_engineer");
    expect(receipt).toHaveTextContent("Agent-visible disposition: approve");
  });

  it.each(["stale", "offline"] as const)("denies manager dispositions while %s", async (state) => {
    const user = userEvent.setup();
    render(
      <OfficeShell state={state} attention={attentionItems} onDisposition={fixtureDisposition} />,
    );
    await user.click(screen.getByRole("button", { name: "Manager attention (2)" }));
    expect(screen.getAllByRole("button", { name: /^Submit / })).toSatisfy(
      (buttons: HTMLElement[]) => buttons.every((button) => button.hasAttribute("disabled")),
    );
    expect(screen.getByRole("complementary", { name: "Manager attention" })).toHaveTextContent(
      "Refresh the current workspace before recording a disposition.",
    );
  });

  it("collapses an empty attention projection", () => {
    render(<OfficeShell state="ready" attention={[]} />);
    expect(screen.queryByRole("button", { name: /Manager attention/ })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Manager attention" })).toBeNull();
  });
});
