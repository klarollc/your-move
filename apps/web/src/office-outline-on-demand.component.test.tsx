import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { officeModelFor } from "./office-model.js";
import { OfficeShell } from "./office-shell.js";

/**
 * Phase 7-O Task 9e (owner rulings A-1 to A-4, 2026-09-27; AR-01, AR-04). The office is the
 * default working surface. The Office outline stays an equivalent primary interface, one action
 * away from any state and shown automatically when the scene is unavailable, but it is no longer a
 * persistent card grid beneath the office.
 */
afterEach(cleanup);

const outline = () => screen.queryByRole("region", { name: "Office outline" });
const bar = () => screen.getByRole("banner", { name: "Project bar" });

describe("the office is the default surface", () => {
  it("shows no outline until asked, and offers it from the project bar", () => {
    render(<OfficeShell state="ready" />);
    expect(outline()).toBeNull();
    expect(screen.getAllByTestId("persistent-structure")).toHaveLength(2);
    const open = within(bar()).getByRole("button", { name: "Office outline" });
    expect(open).toHaveAttribute("aria-expanded", "false");
  });

  it("opens from the bar with focus inside, and closes on Escape with focus back", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    const open = within(bar()).getByRole("button", { name: "Office outline" });
    await user.click(open);
    expect(outline()).toBeVisible();
    expect(outline()).toHaveFocus();
    expect(open).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(outline()).toBeNull();
    expect(open).toHaveFocus();
  });

  it("opens from the first-Tab skip link", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await user.click(screen.getByRole("link", { name: "Open the Office outline" }));
    expect(outline()).toHaveFocus();
  });

  it("shares the left side with the attention rail: opening one closes the other", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await user.click(within(bar()).getByRole("button", { name: "Office outline" }));
    await user.click(screen.getByRole("button", { name: "1 blocked · 1 review" }));
    expect(screen.getByRole("complementary", { name: "Manager attention" })).toBeVisible();
    expect(outline()).toBeNull();
    await user.click(within(bar()).getByRole("button", { name: "Office outline" }));
    expect(outline()).toBeVisible();
    expect(screen.queryByRole("complementary", { name: "Manager attention" })).toBeNull();
  });

  // Task 9f-2, owner ruling P-2 reverses A-2: the inspector replaces the outline, and Escape
  // returns to it with focus on the Inspect button used.
  it("replaces the outline with the inspector, and Escape returns focus to the Inspect button", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await user.click(within(bar()).getByRole("button", { name: "Office outline" }));
    await user.click(screen.getByRole("button", { name: "Inspect Test Engineer" }));
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toBeVisible();
    expect(outline()).toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "Entity inspector" })).toBeNull();
    expect(screen.getByRole("button", { name: "Inspect Test Engineer" })).toHaveFocus();
    expect(outline()).toBeVisible();
  });

  it.each(["loading", "empty", "error", "canvas-loss"] as const)(
    "shows the outline without being asked when the scene is unavailable (%s)",
    (state) => {
      render(<OfficeShell state={state} />);
      expect(outline()).toBeVisible();
    },
  );

  it("keeps unassigned work reachable in the outline", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" model={officeModelFor("ready", "unassigned")} />);
    await user.click(within(bar()).getByRole("button", { name: "Office outline" }));
    expect(screen.getByRole("list", { name: "Unassigned work" })).toBeVisible();
  });
});

describe("the workspace status (A-4)", () => {
  it("shows a notice with the cause and its recovery when the workspace is not current", () => {
    render(<OfficeShell state="stale" />);
    expect(outline()).toBeNull();
    const notice = screen.getByTestId("workspace-notice");
    expect(within(notice).getByTestId("workspace-cause")).toHaveTextContent("freshness window");
    expect(within(notice).getByRole("button", { name: "Refresh workspace" })).toBeVisible();
  });

  it("shows nothing extra when current, and states the revision in the outline", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    expect(screen.queryByTestId("workspace-notice")).toBeNull();
    expect(screen.queryByTestId("workspace-cause")).toBeNull();
    await user.click(within(bar()).getByRole("button", { name: "Office outline" }));
    expect(within(outline()!).getByTestId("workspace-cause")).toHaveTextContent("is current");
  });
});
