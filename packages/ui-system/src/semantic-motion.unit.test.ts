import { describe, expect, it } from "vitest";

import { planSemanticMotion } from "./semantic-motion.js";

const transitions = [
  {
    transitionId: "transition_handoff",
    semantic: "handoff" as const,
    entityId: "agent_implementation_engineer",
    fromEntityId: "zone_team",
    toEntityId: "zone_review",
    canonicalRevision: 43,
  },
  {
    transitionId: "transition_delivery",
    semantic: "delivery" as const,
    entityId: "artifact_graybox",
    fromEntityId: "zone_review",
    toEntityId: "zone_delivery",
    canonicalRevision: 44,
  },
];

describe("planSemanticMotion", () => {
  it("applies canonical state first and permits one named-checkpoint transition at a time", () => {
    const plan = planSemanticMotion({
      canonicalRevision: 44,
      transitions,
      reducedMotion: false,
      motionPaused: false,
      clock: () => 1_723_680_000_000,
    });

    expect(plan.canonicalState).toEqual({ revision: 44, appliedAt: 1_723_680_000_000 });
    expect(plan.lead).toMatchObject({
      transitionId: "transition_handoff",
      presentation: "travel",
      properties: ["transform", "opacity"],
      loop: false,
      checkpoints: ["start", "responsibility-transferred", "settled"],
    });
    expect(plan.queued.map(({ transitionId }) => transitionId)).toEqual(["transition_delivery"]);
    expect(plan.runtimePaused).toBe(false);
  });

  it("translates reduced motion to immediate placement with the same state and meaning", () => {
    const standard = planSemanticMotion({
      canonicalRevision: 44,
      transitions,
      reducedMotion: false,
      motionPaused: false,
      clock: () => 100,
    });
    const reduced = planSemanticMotion({
      canonicalRevision: 44,
      transitions,
      reducedMotion: true,
      motionPaused: false,
      clock: () => 100,
    });

    expect(reduced.canonicalState).toEqual(standard.canonicalState);
    expect(reduced.lead).toMatchObject({
      transitionId: standard.lead?.transitionId,
      semantic: standard.lead?.semantic,
      presentation: "immediate-placement",
      durationMs: 0,
      persistentLabel: "Handoff recorded at Review station · revision 43",
      announcement: "Handoff moved to Review station",
      loop: false,
    });
  });

  it("never turns forbidden or paused motion into work/runtime state", () => {
    const plan = planSemanticMotion({
      canonicalRevision: 45,
      transitions: [
        {
          transitionId: "transition_ambient",
          semantic: "ambient" as const,
          entityId: "agent_test_engineer",
          fromEntityId: "zone_team",
          toEntityId: "zone_team",
          canonicalRevision: 45,
        },
      ],
      reducedMotion: false,
      motionPaused: true,
      clock: () => 200,
    });

    expect(plan.lead).toMatchObject({
      presentation: "persistent-label",
      durationMs: 0,
      loop: false,
    });
    expect(plan.motionPaused).toBe(true);
    expect(plan.runtimePaused).toBe(false);
  });
});
