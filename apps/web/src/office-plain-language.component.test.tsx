import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OFFICE_FIXTURES } from "./office-fixtures/index.js";
import { officeModelFor } from "./office-model.js";
import { OfficeShell } from "./office-shell.js";
import { openOfficeOutline } from "./test-support/open-office-outline.js";

/**
 * Phase 7-O Task 9d (F-9-4, V1; spec §6). The inspector's first screen answers what is happening,
 * why, what needs the manager and what evidence supports it, in plain words. Technical
 * identifiers are on demand, under "Technical detail" (owner rulings 9d-1, 9d-2).
 */
afterEach(cleanup);

const events = OFFICE_FIXTURES.default!.events;
// The independent record: the event that blocked the browser evidence.
const blocked = events.find(
  (event) =>
    event.kind === "work.transitioned" &&
    (event.payload as { workItemId?: string; toState?: string }).workItemId ===
      "work_browser_evidence" &&
    (event.payload as { toState?: string }).toState === "blocked",
)!;

const inspect = async (label: string, state: "ready" | "stale" = "ready") => {
  const user = userEvent.setup();
  render(<OfficeShell state={state} />);
  await openOfficeOutline(user);
  await user.click(screen.getByRole("button", { name: `Inspect ${label}` }));
  return { user, inspector: screen.getByRole("complementary", { name: "Entity inspector" }) };
};
const field = (container: HTMLElement, term: string) =>
  within(container).getByText(term, { selector: "dt" }).nextElementSibling as HTMLElement;
/** The inspector's text with the Technical detail disclosure removed: the first screen. */
const firstScreen = (inspector: HTMLElement) => {
  const copy = inspector.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details").forEach((details) => details.remove());
  return copy.textContent ?? "";
};

describe("the inspector answers in plain words first", () => {
  it("says what is happening, why, what needs you and what evidence supports it", async () => {
    const { inspector } = await inspect("Test Engineer");
    expect(field(inspector, "What's happening")).toHaveTextContent(
      "Blocked on Provide current browser evidence",
    );
    const why = field(inspector, "Why");
    expect(why).toHaveTextContent("The Test Engineer needs current browser evidence");
    expect(why).toHaveTextContent("Reported by the system (verified)");
    expect(why).toHaveTextContent(`Recorded ${blocked.occurredAt.slice(11, 19)} UTC`);
    expect(field(inspector, "What needs you")).toHaveTextContent(
      "Redirect the evidence request or decline the blocker.",
    );
    expect(field(inspector, "Evidence")).toHaveTextContent("Browser evidence, version 1: failed");
    expect(field(inspector, "Approval")).toHaveTextContent(
      "Not approved: browser evidence missing",
    );
  });

  it("keeps event IDs, reason codes and entity IDs off the first screen", async () => {
    const { inspector } = await inspect("Test Engineer");
    const text = firstScreen(inspector);
    expect(text).not.toContain("event_office_");
    expect(text).not.toContain("awaiting_evidence");
    expect(text).not.toContain("agent_test_engineer");
    expect(text).not.toContain("health connected");
  });

  it("puts the technical identifiers under a closed Technical detail disclosure", async () => {
    const { user, inspector } = await inspect("Test Engineer");
    const details = inspector.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
    const summary = within(details!).getByText("Technical detail");
    expect(details).toHaveTextContent(blocked.eventId);
    expect(details).toHaveTextContent("awaiting_evidence");
    expect(details).toHaveTextContent("agent_test_engineer");
    await user.click(summary);
    expect(details!.open).toBe(true);
  });

  it("says plainly when a person holds nothing and nothing needs the manager", async () => {
    const { inspector } = await inspect("Delivery Lead");
    expect(field(inspector, "What's happening")).toHaveTextContent("Idle");
    expect(field(inspector, "Why")).toHaveTextContent("Work is not assigned");
    expect(field(inspector, "What needs you")).toHaveTextContent("Nothing needs you");
    expect(field(inspector, "Evidence")).toHaveTextContent("Work is not assigned");
  });

  it("warns on the first screen only when the record is not current", async () => {
    const current = await inspect("Test Engineer");
    expect(firstScreen(current.inspector)).not.toMatch(/out of date/u);
    cleanup();
    const stale = await inspect("Test Engineer", "stale");
    expect(firstScreen(stale.inspector)).toMatch(/may be out of date \(delayed\)/u);
  });
});

describe("the outline reads at a glance", () => {
  const card = (name: string) =>
    screen.getByRole("button", { name: `Inspect ${name}` }).closest("li") as HTMLElement;

  it("gives each person one state word, and says when they need you", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    const test = card("Test Engineer");
    expect(test).toHaveTextContent("Blocked");
    expect(test).toHaveTextContent("Needs you");
    expect(test).not.toHaveTextContent("health");
    expect(test).toHaveTextContent("Reports to Delivery Lead");
    const lead = card("Delivery Lead");
    expect(lead).toHaveTextContent("Idle");
    expect(lead).not.toHaveTextContent("Needs you");
  });

  it("shows unassigned work in its own group, only when there is some (F-9-1)", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" model={officeModelFor("ready", "unassigned")} />);
    await openOfficeOutline(user);
    const group = screen.getByRole("list", { name: "Unassigned work" });
    expect(group).toHaveTextContent("Write the release notes");
    expect(group).toHaveTextContent("Ready");
    cleanup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    expect(screen.queryByRole("list", { name: "Unassigned work" })).toBeNull();
  });
});
