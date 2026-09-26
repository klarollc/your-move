import assert from "node:assert/strict";
import test from "node:test";

import { analyzeOfficeLiterals } from "./office-literal-guard.mjs";

/**
 * Phase 7-O Task 7 (R-3, spec §5). Outside test files, `apps/web` may import the office projectors
 * and their types, but may not write the records they produce as literals. That is how the office
 * came to show a blocker in the rail and "None recorded" in the inspector: two hand-written copies
 * of one fact. The guarded names are not listed here; they are read from the exported projectors.
 */
const violation = `
import type { ManagerAttentionItem } from "@cuckcode/domain";
import type { OfficePersonView } from "@cuckcode/application";
import type { OfficeAttentionItem } from "./attention-rail.js";

export const typedRail: readonly OfficeAttentionItem[] = [
  {
    attentionId: "attention_blocked_test",
    entityId: "agent_test_engineer",
    label: "Test evidence is blocked",
    reason: "blocked",
    priority: 10,
    causeEventId: "event_test_blocked",
    plainLanguage: "The Test Engineer needs the current browser evidence.",
    requiredAction: "Redirect the evidence request or decline the blocker.",
  },
];

export const untypedRail = {
  attentionId: "attention_graybox_review",
  entityId: "agent_implementation_engineer",
  label: "Graybox review requested",
  reason: "review_requested",
  priority: 40,
  causeEventId: "event_review_requested",
  plainLanguage: "Waiting for a manager disposition.",
  requiredAction: "Approve, decline, defer, cancel, or redirect the request.",
};

export const domainItem = {
  subjectId: "work_x",
  reason: "blocked",
  priority: 10,
  causeEventId: "event_x",
  updatedAt: "2026-09-26T09:00:00.000Z",
  condition: null,
  assignment: null,
} satisfies ManagerAttentionItem;

export function inspectorRecord(): OfficePersonView {
  return {
    entityId: "agent_test_engineer",
    kind: "person",
    label: "Test Engineer",
    relationship: null,
    agent: { status: "unresolved", reason: "agent_not_recorded", agentId: "agent_test_engineer" },
    workRelation: "none_assigned",
    work: [],
    attention: [],
    runtime: { status: "unavailable", reason: "not_recorded" },
  };
}
`;

const allowed = `
import type { OfficeReadModel } from "@cuckcode/application";
import type { OfficeAttentionItem } from "./attention-rail.js";
import type { OfficeRegistryEntry } from "@cuckcode/application";

export const registry: readonly OfficeRegistryEntry[] = [
  { entityId: "zone_reception", kind: "zone", label: "Reception" },
];

export function derived(model: OfficeReadModel): readonly OfficeAttentionItem[] {
  return model.attention.map((item) => ({
    attentionId: \`attention_\${item.workItemId}\`,
    entityId: item.relatedEntityId ?? item.workItemId,
    label: item.workItemId,
    reason: item.reason,
    priority: item.priority,
    causeEventId: item.causeEventId,
    plainLanguage: item.condition?.summary ?? "No reason recorded",
    requiredAction: item.condition?.requestedAction.summary ?? "No requested action recorded",
  }));
}
`;

const VIOLATION = "apps/web/src/__guard_violation__.ts";
const ALLOWED = "apps/web/src/__guard_allowed__.ts";
const result = analyzeOfficeLiterals({
  extraFiles: { [VIOLATION]: violation, [ALLOWED]: allowed },
});

test("the guarded record types are read from the exported office projectors", () => {
  for (const name of [
    "ManagerAttentionItem",
    "OfficeReadModel",
    "OfficePersonView",
    "OfficeAttentionView",
    "OfficeWorkView",
    "OfficeAttentionItem",
    "LibraryEvidenceRecord",
  ]) {
    assert.ok(result.guardedNames.includes(name), `${name} is not guarded`);
  }
  assert.ok(!result.guardedNames.includes("OfficeRegistryEntry"), "layout input is not a record");
});

test("a deliberate violation of each kind is caught", () => {
  const caught = result.offenders.filter((offender) => offender.file === VIOLATION);
  const lines = caught.map(({ type, line }) => `${type}@${line}`).sort();
  assert.deepEqual(
    caught.map(({ type }) => type).sort(),
    ["ManagerAttentionItem", "OfficeAttentionItem", "OfficeAttentionItem", "OfficePersonView"],
    `caught: ${lines.join(", ")}`,
  );
});

test("records derived from the model, and layout-only registry entries, are allowed", () => {
  assert.deepEqual(
    result.offenders.filter((offender) => offender.file === ALLOWED),
    [],
  );
});

test("no non-test apps/web source writes an office record as a literal", () => {
  const offenders = result.offenders.filter(
    (offender) => offender.file !== VIOLATION && offender.file !== ALLOWED,
  );
  assert.deepEqual(
    offenders,
    [],
    offenders.map(({ file, line, type }) => `${file}:${line} ${type}`).join("\n"),
  );
});
