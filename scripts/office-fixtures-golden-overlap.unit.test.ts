import { createPhase6ComparisonEvents } from "@cuckcode/testing";
import { describe, expect, it } from "vitest";

import { OFFICE_FIXTURES } from "../apps/web/src/office-fixtures/index.js";

/**
 * Phase 7-O plan P-3: the office's fixture logs and the Phase 6 golden states describe the same six
 * people. The staffing records they share must stay identical, so the office the owner operates and
 * the frame Phase 7 implements against cannot silently drift apart.
 *
 * Narrower than P-3 first proposed, and stated rather than hidden: no office state reproduces a
 * golden state's work sequence, because the office's default carries two items for the manager and
 * the golden states carry one. The overlap asserted is the staffing both are built on.
 */
const staffing = (events: readonly { kind: string; payload: Record<string, unknown> }[]) =>
  events
    .filter((event) => event.kind === "agent.registered" || event.kind === "role.assigned")
    .map((event) => ({ kind: event.kind, payload: event.payload }));

describe("office fixture logs and the Phase 6 comparison frame", () => {
  const golden = staffing(createPhase6ComparisonEvents());

  it("share six agents and six role assignments", () => {
    expect(golden).toHaveLength(12);
  });

  it("record them identically in every office state that has people", () => {
    for (const fixture of Object.values(OFFICE_FIXTURES)) {
      if (fixture.events.length === 0) continue;
      expect(staffing(fixture.events), fixture.id).toEqual(golden);
    }
  });
});
