import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

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
