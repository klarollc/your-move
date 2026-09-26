import { validateWorkTransitionPayload, type ProjectEvent } from "@cuckcode/contracts";
import {
  createPhase6ComparisonEvents,
  createSimulatorScenario,
  simulatorScenarioNames,
} from "@cuckcode/testing";
import { describe, expect, it } from "vitest";

import { GOLDEN_STATES } from "./phase6-golden-states.js";

/**
 * Phase 7-O Task 1: the version-2 transition contract must not change how any existing event log
 * reads. Every work.transitioned event in every fixture source in the repository is collected here
 * and must still validate as a version-1 payload.
 */
const sources: Array<[string, ProjectEvent[]]> = [
  ...simulatorScenarioNames.map((name): [string, ProjectEvent[]] => [
    `simulator:${name}`,
    createSimulatorScenario(name).events,
  ]),
  ["phase6:comparison", createPhase6ComparisonEvents()],
  ...GOLDEN_STATES.map((state): [string, ProjectEvent[]] => [`golden:${state.id}`, state.events]),
];

describe("existing work.transitioned fixtures under the version-2 contract", () => {
  it("collects transitions from every fixture source, so an empty sweep cannot pass", () => {
    const transitions = sources.flatMap(([, events]) =>
      events.filter((event) => event.kind === "work.transitioned"),
    );
    expect(sources.length).toBeGreaterThanOrEqual(16);
    expect(transitions.length).toBeGreaterThan(40);
  });

  it("validates every existing transition unchanged, as payload version 1", () => {
    const failures: string[] = [];
    for (const [source, events] of sources) {
      for (const event of events.filter((candidate) => candidate.kind === "work.transitioned")) {
        const result = validateWorkTransitionPayload(event.payload);
        if (!result.ok || result.value.payloadVersion !== 1) {
          failures.push(`${source} ${event.eventId}: ${JSON.stringify(result)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
