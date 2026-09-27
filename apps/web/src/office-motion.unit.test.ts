import { describe, expect, it } from "vitest";

import { OFFICE_FIXTURES } from "./office-fixtures/index.js";
import { motionFrom, officeModelFor } from "./office-model.js";

/**
 * Phase 7-O Task 9, owner ruling (a). The office's motion cue comes only from a handoff the log
 * records. The Phase 4 cue claimed revision 44 and two transitions no log contained.
 */
const events = OFFICE_FIXTURES.default!.events;
const handoffEvent = events.find((event) => event.kind === "handoff.recorded");
const handoffRevision = events.findIndex((event) => event.kind === "handoff.recorded") + 1;
const settled = { checkpoint: "settled" };

describe("the office motion cue", () => {
  it("comes from the default log's recorded handoff, at the log's revision", () => {
    expect(handoffEvent, "the default log records the graybox handoff").toBeDefined();
    const cue = motionFrom(officeModelFor("ready").model, { ...settled, reducedMotion: false });
    expect(cue).toMatchObject({
      canonicalRevision: events.length,
      presentation: "travel",
      label: "Handoff moving to Visual QA Reviewer",
      announcement: "Handoff to Visual QA Reviewer recorded",
      queuedCount: 0,
      loop: false,
    });
  });

  it("keeps its meaning as a persistent label under reduced motion", () => {
    const cue = motionFrom(officeModelFor("ready").model, { ...settled, reducedMotion: true });
    expect(cue).toMatchObject({
      presentation: "immediate-placement",
      label: `Handoff to Visual QA Reviewer recorded · revision ${handoffRevision}`,
    });
  });

  it("shows no cue for a log that records no handoff", () => {
    const empty = officeModelFor("empty").model;
    expect(empty.handoffs).toEqual([]);
    expect(motionFrom(empty, { ...settled, reducedMotion: false })).toBeUndefined();
  });

  // Task 9f-4, constitution rule 6 (AR-03 "Information unavailable"): while updates are
  // unavailable, no work is shown moving. The handoff stays as a recorded fact, not as travel.
  it.each([false, true])(
    "suspends travel while updates are unavailable (reduced motion %s)",
    (reducedMotion) => {
      const cue = motionFrom(officeModelFor("ready").model, {
        ...settled,
        reducedMotion,
        updatesUnavailable: true,
      });
      expect(cue).toMatchObject({
        presentation: "persistent-label",
        label: `Handoff to Visual QA Reviewer recorded · revision ${handoffRevision}`,
      });
    },
  );
});
