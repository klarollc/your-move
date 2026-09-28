import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OfficeShell } from "./office-shell.js";
import { openOfficeOutline } from "./test-support/open-office-outline.js";

/**
 * Phase 7-O Task 9f-4, plain wording on first screens. Governing plates: AR-03 ("Information
 * unavailable": "Updates unavailable", "Status unknown", "Last confirmed: …") and AR-04 (no badges
 * and technical noise). Constitution rules 6 and 10: unknown stays unknown, and the technical
 * words stay reachable under Technical detail rather than disappearing.
 */
afterEach(cleanup);

const outline = () => screen.getByRole("region", { name: "Office outline" });
const notice = () => screen.getByTestId("workspace-notice");

describe("first screens use plain words", () => {
  it("shows no canonical jargon in the ready outline, and keeps it under Technical detail", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    expect(outline()).not.toHaveTextContent("Layout only");
    expect(screen.getByText(/Canonical workspace revision 35 is current/u)).not.toBeVisible();
    await user.click(within(outline()).getByText("Technical detail", { selector: "summary" }));
    expect(screen.getByText(/Canonical workspace revision 35 is current/u)).toBeVisible();
  });

  it("says plainly that a place has no recorded activity", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    await user.click(screen.getByRole("button", { name: "Locate Review station" }));
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    expect(within(inspector).getByText("What's happening").nextElementSibling).toHaveTextContent(
      "No activity is recorded here.",
    );
  });

  it("says updates are unavailable, when they were last confirmed, and that activity is unknown", () => {
    render(<OfficeShell state="stale" />);
    expect(notice()).toHaveTextContent(/^Updates unavailable\. /u);
    expect(notice()).toHaveTextContent(/as last confirmed at \d\d:\d\d UTC/u);
    expect(notice()).toHaveTextContent("current activity is unknown");
    expect(notice()).not.toHaveTextContent("freshness window");
    expect(notice()).not.toHaveTextContent("Cause:");
    expect(within(notice()).getByRole("button", { name: "Refresh workspace" })).toBeVisible();
  });

  it("says the runtime is offline and that activity is unknown", () => {
    render(<OfficeShell state="offline" />);
    expect(notice()).toHaveTextContent(/^The runtime is offline\. /u);
    expect(notice()).toHaveTextContent("current activity is unknown");
    expect(within(notice()).getByRole("button", { name: "Reconnect runtime" })).toBeVisible();
  });

  it("marks each person's status unknown, with what was last confirmed, while stale", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="stale" />);
    await openOfficeOutline(user);
    expect(outline().querySelector("header")).not.toHaveTextContent(/\bstale\b/u);
    expect(within(outline()).getByText("Updates unavailable")).toBeVisible();
    const card = within(outline()).getByRole("heading", { name: "Test Engineer" }).parentElement!;
    expect(card).toHaveTextContent(/Status unknown · last confirmed: Blocked/u);
    expect(card).toHaveTextContent("Needs you");
  });

  it("drops the Cause: prefix from every notice", () => {
    render(<OfficeShell state="error" />);
    expect(notice()).not.toHaveTextContent("Cause:");
  });
});
