import {
  projectOfficeLibraryEvidence,
  projectOfficeReadModel,
  type BrowserLibraryProjection,
  type OfficeAttentionView,
  type OfficePersonView,
  type OfficeReadModel,
  type OfficeWorkView,
  type OfficeZoneView,
} from "@cuckcode/application";
import { replayProject } from "@cuckcode/domain";

import type { OfficeAttentionItem } from "./attention-rail.js";
import { officeFixtureFor, type OfficeFixtureState } from "./office-fixtures/index.js";
import { PHASE_4_KNOWLEDGE } from "./office-fixtures/knowledge.js";
import { OFFICE_REGISTRY } from "./office-fixtures/registry.js";

/**
 * The one office read model the shell renders (Phase 7-O spec §4, Task 6). The rail, the outline,
 * the scene cue and the inspector all read this value; none of them holds a literal of its own.
 */
export type OfficeModel = Readonly<{
  model: OfficeReadModel;
  /** A runtime or renderer condition drawn over the log, or null when the log is the state. */
  overlay: OfficeFixtureState | null;
}>;

export function officeModelFor(state: OfficeFixtureState): OfficeModel {
  const { fixture, overlay } = officeFixtureFor(state);
  return {
    model: projectOfficeReadModel({
      snapshot: replayProject(fixture.events),
      now: fixture.now,
      registry: OFFICE_REGISTRY,
    }),
    overlay,
  };
}

/** The revision the canonical log reached: its event count. */
export const revisionOf = (model: OfficeReadModel) => model.source.eventCount;

const reasonText: Readonly<Record<OfficeAttentionView["reason"], string>> = {
  blocked: "blocked",
  failed: "failed",
  waiting_input: "waiting for input",
  review_requested: "review requested",
  approval_required: "approval required",
  question_open: "question open",
};

export const NO_REASON = "No reason recorded";
export const NO_ACTION = "No requested action recorded";
export const NOT_ASSIGNED = "Work is not assigned";
export const NOT_IN_FIXTURE = "Unavailable in this fixture";

export function personOf(model: OfficeReadModel, entityId: string): OfficePersonView | undefined {
  const entity = model.entities.find((candidate) => candidate.entityId === entityId);
  return entity?.kind === "person" ? entity : undefined;
}

export function entityOf(
  model: OfficeReadModel,
  entityId: string,
): OfficePersonView | OfficeZoneView | undefined {
  return model.entities.find((candidate) => candidate.entityId === entityId);
}

/** Rail items, derived from the model's attention and the held work's recorded condition. */
export function attentionItemsFrom(model: OfficeReadModel): readonly OfficeAttentionItem[] {
  return model.attention.map((item) => {
    const holder = item.relatedEntityId ? personOf(model, item.relatedEntityId) : undefined;
    const work = holder?.work.find((view) => view.workItemId === item.workItemId);
    const outcome = work?.outcome ?? item.workItemId;
    return {
      attentionId: `attention_${item.workItemId}`,
      entityId: item.relatedEntityId ?? item.workItemId,
      label: `${outcome}: ${reasonText[item.reason]}`,
      reason: item.reason,
      priority: item.priority,
      causeEventId: item.causeEventId,
      plainLanguage: item.condition?.summary ?? NO_REASON,
      requiredAction: item.condition?.requestedAction.summary ?? NO_ACTION,
    };
  });
}

/** One line for a person's state in the outline and the inspector. */
export function personStateText(person: OfficePersonView): string {
  if (person.agent.status !== "recorded") return "Agent not recorded";
  return `${person.agent.presence} · health ${person.agent.health}`;
}

const attentionStates = new Set(["blocked", "waiting_input", "review_requested", "failed"]);

export function blockerText(person: OfficePersonView): string {
  if (person.work.length === 0) return NOT_ASSIGNED;
  const held = person.work.filter((work) => attentionStates.has(work.state));
  if (held.length === 0) return "None recorded: no held work is blocked or waiting";
  return held.map(conditionText).join(" / ");
}

export function conditionText(work: OfficeWorkView): string {
  const condition = work.condition;
  if (!condition) return `${work.outcome}: ${NO_REASON}`;
  const waiting = condition.waitingOn.id
    ? `${condition.waitingOn.kind} ${condition.waitingOn.id}`
    : condition.waitingOn.kind;
  return `${condition.summary} (${condition.reasonCode}; waiting on ${waiting}) — reported by ${condition.source}, ${condition.trust}`;
}

export function requestedActionText(person: OfficePersonView): string {
  if (person.work.length === 0) return NOT_ASSIGNED;
  const actions = person.work
    .filter((work) => work.condition)
    .map(
      (work) =>
        `${work.condition!.requestedAction.summary} (${work.condition!.requestedAction.kind})`,
    );
  return actions.length > 0 ? actions.join(" / ") : NO_ACTION;
}

export function evidenceText(person: OfficePersonView): string {
  if (person.work.length === 0) return NOT_ASSIGNED;
  const evidence = person.work.flatMap((work) => work.evidence);
  if (evidence.length === 0) return "No linked evidence recorded";
  return evidence
    .map((item) => `${item.evidenceId} v${item.version} · ${item.kind} · ${item.result}`)
    .join("; ");
}

export function approvalText(person: OfficePersonView): string {
  if (person.work.length === 0) return NOT_ASSIGNED;
  return person.work
    .map((work) => {
      const { approval } = work;
      if (approval.status === "approved") return `${work.outcome}: approved`;
      const missing =
        approval.missingEvidenceKinds.length > 0
          ? `; missing ${approval.missingEvidenceKinds.join(", ")} evidence`
          : "";
      return `${work.outcome}: ${approval.status.replace("_", " ")}${missing}`;
    })
    .join(" / ");
}

export function currentWorkText(person: OfficePersonView): string {
  if (person.work.length === 0) return NOT_ASSIGNED;
  return person.work.map((work) => `${work.outcome} (${work.state})`).join(" / ");
}

/** The open attention items this person holds: reason and the event that raised each one. */
export function needsYouText(person: OfficePersonView): string {
  if (person.attention.length === 0) return "No open attention item recorded";
  return person.attention
    .map((item) => `${reasonText[item.reason]} · cause ${item.causeEventId}`)
    .join(" / ");
}

/** Why the model is not current, by issue code, so the office never claims a current revision. */
export function notCurrentReasons(model: OfficeReadModel): string {
  const codes = [...new Set(model.issues.map((issue) => issue.code))];
  return codes.length > 0 ? codes.join(", ") : "no issue recorded";
}

/**
 * The Project Library for a shell state (Phase 7-O Task 8b): the evidence is the state's canonical
 * log, projected; the knowledge records are still the Phase 4 data (`office-fixtures/knowledge.ts`).
 */
export function officeLibraryFor(state: OfficeFixtureState): BrowserLibraryProjection {
  const { fixture } = officeFixtureFor(state);
  const snapshot = replayProject(fixture.events);
  const model = projectOfficeReadModel({ snapshot, now: fixture.now, registry: OFFICE_REGISTRY });
  return {
    knowledge: PHASE_4_KNOWLEDGE,
    evidence: projectOfficeLibraryEvidence({ snapshot, model }),
  };
}
