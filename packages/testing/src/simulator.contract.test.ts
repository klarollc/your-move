import { describe, expect, it } from "vitest";

import { parseProjectEvent } from "@cuckcode/contracts";
import {
  projectManagerAttention,
  projectOfficeScene,
  replayProject,
  stableStringify,
} from "@cuckcode/domain";

import { createSimulatorScenario, simulatorScenarioNames } from "./simulator.js";

describe("deterministic runtime simulator", () => {
  it("provides the ten approved success and failure scenarios", () => {
    expect(simulatorScenarioNames).toEqual([
      "normal-completion",
      "manager-question-response",
      "permission-denial",
      "dependency-wait",
      "test-failure-revision",
      "agent-disconnect",
      "agent-disconnect-recovery",
      "stale-out-of-order",
      "cancellation",
      "reviewer-disagreement",
    ]);
  });

  it.each(simulatorScenarioNames)("emits schema-valid deterministic events for %s", (name) => {
    const first = createSimulatorScenario(name);
    const second = createSimulatorScenario(name);

    expect(stableStringify(first)).toBe(stableStringify(second));
    expect(first.events.every((event) => parseProjectEvent(event).ok)).toBe(true);
  });

  it("drives normal completion through the public replay and scene contracts", () => {
    const snapshot = replayProject(createSimulatorScenario("normal-completion").events);
    const scene = projectOfficeScene(snapshot, "2026-08-14T00:05:00.000Z");

    expect(snapshot.work.workItems.work_fixture?.state).toBe("completed");
    expect(scene).toContainEqual(
      expect.objectContaining({ subjectId: "work_fixture", behavior: "delivery_area" }),
    );
  });

  it("drives permission denial into blocked manager attention", () => {
    const snapshot = replayProject(createSimulatorScenario("permission-denial").events);

    expect(projectManagerAttention(snapshot)[0]).toMatchObject({
      subjectId: "work_fixture",
      reason: "blocked",
    });
  });

  it("drives disconnect truth to unavailable office state", () => {
    const snapshot = replayProject(createSimulatorScenario("agent-disconnect").events);

    expect(projectOfficeScene(snapshot, "2026-08-14T00:05:00.000Z")).toContainEqual(
      expect.objectContaining({ subjectId: "agent_fixture", behavior: "offline" }),
    );
  });
});
