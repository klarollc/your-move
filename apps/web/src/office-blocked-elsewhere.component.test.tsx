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
 * DF-029 Task 5 (spec §10.1, §10.2; owner ruling D-6). A blocker that asks nothing of the manager
 * reads "Nothing needs you." and names who can resolve it; it carries no "Needs you", is not
 * counted in the bar, and is not in the rail.
 *
 * The model is the default office with one event changed: the Test Engineer's blocker is
 * re-recorded at payload version 3 without a request, waiting on the given party.
 */
afterEach(cleanup);

const fixture = OFFICE_FIXTURES.default!;
const isTestBlocker = (event: (typeof fixture.events)[number]) =>
  event.kind === "work.transitioned" &&
  (event.payload as { workItemId?: string }).workItemId === "work_browser_evidence" &&
  (event.payload as { toState?: string }).toState === "blocked";

function blockedElsewhere(waitingOn: Record<string, unknown>) {
  const events = fixture.events.map((event) => {
    if (!isTestBlocker(event)) return event;
    const payload = event.payload as Record<string, unknown> & {
      condition: Record<string, unknown>;
    };
    const condition = Object.fromEntries(
      Object.entries(payload.condition).filter(([key]) => key !== "requestedAction"),
    );
    return {
      ...event,
      payload: { ...payload, payloadVersion: 3, condition: { ...condition, waitingOn } },
    };
  });
  expect(events.filter(isTestBlocker)).toHaveLength(1);
  return {
    model: projectOfficeReadModel({
      snapshot: replayProject(events),
      now: fixture.now,
      registry: OFFICE_REGISTRY,
    }),
    overlay: null,
  };
}

const render3 = async (waitingOn: Record<string, unknown>) => {
  const user = userEvent.setup();
  render(<OfficeShell state="ready" model={blockedElsewhere(waitingOn)} />);
  return user;
};
const inspectTest = async (waitingOn: Record<string, unknown>) => {
  const user = await render3(waitingOn);
  await openOfficeOutline(user);
  await user.click(screen.getByRole("button", { name: "Inspect Test Engineer" }));
  const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
  return within(inspector).getByText("What needs you", { selector: "dt" })
    .nextElementSibling as HTMLElement;
};

describe("a blocker that is not on the manager (DF-029)", () => {
  it.each([
    [
      "an agent",
      { kind: "agent", id: "agent_implementation_engineer" },
      "Nothing needs you. Implementation Engineer can resolve it.",
    ],
    [
      "evidence",
      { kind: "evidence", id: "evidence_browser" },
      "Nothing needs you. Waiting for Browser evidence, version 1.",
    ],
    [
      "an external party",
      { kind: "external" },
      "Nothing needs you. Waiting on an external dependency.",
    ],
    [
      "an agent nobody recorded",
      { kind: "agent", id: "agent_unrecorded" },
      "Nothing needs you. Who can resolve it: not recorded.",
    ],
  ])("says who can resolve it when it waits on %s", async (_case, waitingOn, sentence) => {
    const needs = await inspectTest(waitingOn);
    expect(needs.textContent).toBe(sentence);
  });

  it("labels the person without 'Needs you'", async () => {
    const user = await render3({ kind: "agent", id: "agent_implementation_engineer" });
    await openOfficeOutline(user);
    const people = screen.getByRole("list", { name: "Office people" });
    const card = within(people)
      .getByRole("heading", { name: "Test Engineer" })
      .closest("li") as HTMLElement;
    expect(card).toHaveTextContent("Blocked");
    expect(card).not.toHaveTextContent("Needs you");
  });

  it("leaves it out of the bar's count and the rail", async () => {
    const user = await render3({ kind: "agent", id: "agent_implementation_engineer" });
    const summary = screen.getByRole("button", { name: "1 review" });
    await user.click(summary);
    const rail = screen.getByRole("complementary", { name: "Manager attention" });
    expect(rail).not.toHaveTextContent("Provide current browser evidence");
  });

  it("keeps today's words when the blocker does ask the manager", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    await user.click(screen.getByRole("button", { name: "Inspect Test Engineer" }));
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    const needs = within(inspector).getByText("What needs you", { selector: "dt" })
      .nextElementSibling as HTMLElement;
    expect(needs.textContent).toBe("Redirect the evidence request or decline the blocker.");
  });
});
