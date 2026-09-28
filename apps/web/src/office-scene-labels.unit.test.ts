import { describe, expect, it } from "vitest";

import { officeModelFor, sceneLabelsFrom } from "./office-model.js";
import { OFFICE_REGISTRY } from "./office-fixtures/registry.js";

/**
 * Phase 7-O Task 9f-3, owner ruling P-3. Governing plate: AR-01, where the office itself carries
 * the cues ("Ari · Drafting", "Sam · Needs your choice"); constitution rules 2 and 9. Each person
 * is labelled with their name and the same plain state the outline shows; amber is reserved for
 * what needs the manager, and the words say so too. Zones carry their names only.
 */
const { model } = officeModelFor("ready");
const labels = sceneLabelsFrom(model);
const labelFor = (entityId: string) => labels.find((label) => label.entityId === entityId);

describe("sceneLabelsFrom", () => {
  it("labels every person and zone in the registry, once", () => {
    expect(labels.map(({ entityId }) => entityId).sort()).toStrictEqual(
      OFFICE_REGISTRY.map(({ entityId }) => entityId).sort(),
    );
  });

  it("gives a person their name and plain state, and marks what needs the manager", () => {
    expect(labelFor("agent_test_engineer")).toStrictEqual({
      entityId: "agent_test_engineer",
      kind: "person",
      name: "Test Engineer",
      state: "Blocked · Needs you",
      needsYou: true,
    });
    expect(labelFor("agent_delivery_lead")).toMatchObject({
      name: "Delivery Lead",
      state: "Idle",
      needsYou: false,
    });
  });

  it("gives a zone its name only", () => {
    expect(labelFor("zone_review")).toStrictEqual({
      entityId: "zone_review",
      kind: "zone",
      name: "Review station",
      state: undefined,
      needsYou: false,
    });
  });

  it("never marks a person as needing the manager without saying so in words", () => {
    for (const label of labels.filter(({ needsYou }) => needsYou)) {
      expect(label.state).toContain("Needs you");
    }
  });

  // Task 9f-4 (AR-03 "Ren · Status unknown"; rule 6): while updates are unavailable the office
  // does not claim anyone's current state.
  it("says status unknown while updates are unavailable, keeping what needs the manager", () => {
    const stale = sceneLabelsFrom(officeModelFor("stale").model, { updatesUnavailable: true });
    const tester = stale.find(({ entityId }) => entityId === "agent_test_engineer");
    expect(tester?.state).toBe("Status unknown · Needs you");
    const lead = stale.find(({ entityId }) => entityId === "agent_delivery_lead");
    expect(lead?.state).toBe("Status unknown");
  });
});
