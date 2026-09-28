import "@testing-library/jest-dom/vitest";
import { projectOfficeReadModel } from "@cuckcode/application";
import { replayProject } from "@cuckcode/domain";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OFFICE_FIXTURES } from "./office-fixtures/index.js";
import { OFFICE_REGISTRY } from "./office-fixtures/registry.js";
import { OfficeShell } from "./office-shell.js";
import { openOfficeOutline } from "./test-support/open-office-outline.js";

/**
 * Phase 7-O Task 6: the rail, outline and inspector render from the office read model. The named
 * RED is the Phase 7-O finding itself: the rail said the Test Engineer was blocked while the
 * inspector said "Blocker: None recorded".
 */
afterEach(cleanup);

const inspect = async (label: string) => {
  const user = userEvent.setup();
  render(<OfficeShell state="ready" />);
  await openOfficeOutline(user);
  await user.click(screen.getByRole("button", { name: `Inspect ${label}` }));
  return screen.getByRole("complementary", { name: "Entity inspector" });
};
const field = (inspector: HTMLElement, term: string) => {
  const dt = within(inspector).getByText(term, { selector: "dt" });
  return dt.nextElementSibling as HTMLElement;
};

describe("the inspector and the rail read one record", () => {
  it("shows the Test Engineer's recorded blocker, never 'None recorded'", async () => {
    const inspector = await inspect("Test Engineer");
    expect(field(inspector, "State")).toHaveTextContent("blocked");
    const blocker = field(inspector, "Blocker");
    expect(blocker).not.toHaveTextContent("None recorded");
    expect(blocker).toHaveTextContent("The Test Engineer needs current browser evidence");
    expect(blocker).toHaveTextContent("reported by system, verified");
    expect(field(inspector, "Requested action")).toHaveTextContent(
      "Redirect the evidence request or decline the blocker.",
    );
    expect(field(inspector, "Evidence records")).toHaveTextContent("evidence_browser");
  });

  it("gives the rail the same reason and action the inspector shows", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await user.click(screen.getByRole("button", { name: "1 blocked · 1 review" }));
    const rail = screen.getByRole("complementary", { name: "Manager attention" });
    expect(rail).toHaveTextContent("The Test Engineer needs current browser evidence");
    expect(rail).toHaveTextContent("Redirect the evidence request or decline the blocker.");
  });

  it("gives each person their own cause, not shared boilerplate", async () => {
    const test = await inspect("Test Engineer");
    const testCause = field(test, "Cause").textContent;
    cleanup();
    const implementation = await inspect("Implementation Engineer");
    expect(field(implementation, "Cause").textContent).not.toBe(testCause);
    expect(implementation).not.toHaveTextContent("revision 42 fixture");
    expect(implementation).not.toHaveTextContent("Deterministic graybox fixture");
  });

  it("says plainly when a person holds no work and when runtime detail is not recorded", async () => {
    const inspector = await inspect("Delivery Lead");
    expect(field(inspector, "Current work")).toHaveTextContent("Work is not assigned");
    expect(field(inspector, "Blocker")).toHaveTextContent("Work is not assigned");
    expect(field(inspector, "Runtime binding")).toHaveTextContent("Unavailable in this fixture");
    expect(field(inspector, "Permissions")).toHaveTextContent("Unavailable in this fixture");
  });

  it("shows zones as layout only, with no invented state", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    const outline = screen.getByRole("region", { name: "Office outline" });
    expect(outline).not.toHaveTextContent("Candidate intake");
    expect(outline).not.toHaveTextContent("Reviewing deterministic tests");
    // Task 9f-4 (P-4): "Layout only" leaves the first screen and stays under Technical detail.
    expect(outline).not.toHaveTextContent("Layout only");
    await user.click(screen.getByRole("button", { name: "Locate Review station" }));
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    expect(inspector.querySelector("details")).toHaveTextContent(
      "Layout only — no canonical state record",
    );
  });

  it("states the canonical revision the log actually reached", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    // Task 9e (A-4): when current, the revision is stated in the outline's header.
    await openOfficeOutline(user);
    const revision = OFFICE_FIXTURES.default!.events.length;
    expect(screen.getByTestId("workspace-cause")).toHaveTextContent(
      `Canonical workspace revision ${revision} is current.`,
    );
  });

  it("shows the rail item's own cause event in the inspector, read from the log", async () => {
    // The independent record: the event that moved the browser evidence to blocked.
    const blockedEvent = OFFICE_FIXTURES.default!.events.find(
      (event) =>
        event.kind === "work.transitioned" &&
        (event.payload as { workItemId?: string; toState?: string }).workItemId ===
          "work_browser_evidence" &&
        (event.payload as { toState?: string }).toState === "blocked",
    );
    expect(blockedEvent).toBeDefined();
    const inspector = await inspect("Test Engineer");
    const needs = field(inspector, "Needs you");
    expect(needs).toHaveTextContent("blocked");
    expect(needs).toHaveTextContent(blockedEvent!.eventId);
  });

  it("never states a revision as current when the read model is not current", async () => {
    // A duplicate event id carrying a different payload is a replay conflict (DUPLICATE_EVENT_CONFLICT).
    const events = OFFICE_FIXTURES.default!.events;
    const last = events.at(-1)!;
    const conflicted = [...events, { ...last, payload: { ...last.payload, value: "contradicts" } }];
    const model = projectOfficeReadModel({
      snapshot: replayProject(conflicted),
      now: OFFICE_FIXTURES.default!.now,
      registry: OFFICE_REGISTRY,
    });
    expect(model.current).toBe(false);
    const user = userEvent.setup();
    render(<OfficeShell state="ready" model={{ model, overlay: null }} />);
    await openOfficeOutline(user);
    const cause = screen.getByTestId("workspace-cause");
    expect(cause).not.toHaveTextContent("is current");
    expect(cause).toHaveTextContent("is not current");
    expect(cause).toHaveTextContent("REPLAY_ISSUE");
  });
});
