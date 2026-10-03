import type { OfficePersonView, OfficeWorkView } from "@cuckcode/application";
import { describe, expect, it } from "vitest";

import { needsYouPlain } from "./office-model.js";

/** DF-029 Task 5: "What needs you" for more than one held item (spec §10.1, owner ruling D-6). */
const condition = {
  reasonCode: "dependency_blocked" as const,
  summary: "Waiting on another agent.",
  waitingOn: { kind: "agent" as const, id: "agent_x" },
  eventId: "event_x",
  source: "adapter" as const,
  trust: "reported" as const,
};
const held = (workItemId: string, resolver: OfficeWorkView["resolver"], request?: string) =>
  ({
    workItemId,
    state: "blocked",
    condition: request
      ? { ...condition, requestedAction: { kind: "redirect", summary: request } }
      : condition,
    resolver,
  }) as unknown as OfficeWorkView;
const person = (work: OfficeWorkView[], attention: string[] = []) =>
  ({
    work,
    attention: attention.map((summary) => ({
      condition: { ...condition, requestedAction: { kind: "redirect", summary } },
    })),
  }) as unknown as OfficePersonView;

describe("needsYouPlain with several held items", () => {
  it("lists each resolver once after a single 'Nothing needs you.'", () => {
    expect(
      needsYouPlain(
        person([
          held("work_a", { status: "resolved", kind: "agent", text: "Delivery Lead" }),
          held("work_b", { status: "resolved", kind: "external", text: "an external dependency" }),
        ]),
      ),
    ).toBe("Nothing needs you. Delivery Lead can resolve it. Waiting on an external dependency.");
  });

  it("puts the manager's requests first and never says 'Nothing needs you' beside them", () => {
    const text = needsYouPlain(
      person(
        [
          held("work_a", { status: "resolved", kind: "manager", text: "the manager" }, "Decide."),
          held("work_b", { status: "not_recorded", kind: "agent", id: "agent_ghost" }),
        ],
        ["Decide."],
      ),
    );
    expect(text).toBe("Decide. Who can resolve it: not recorded.");
  });
});
