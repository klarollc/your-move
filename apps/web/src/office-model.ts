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
import { planSemanticMotion } from "@cuckcode/ui-system";

import type { OfficeAttentionItem } from "./attention-rail.js";
import type { OfficeMotionCue } from "./office-shell.js";
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

export function officeModelFor(state: OfficeFixtureState, fixtureId?: string): OfficeModel {
  const { fixture, overlay } = officeFixtureFor(state, fixtureId);
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

/**
 * The bar's attention count by kind (Task 9f-1, owner ruling P-4; AR-01, constitution rule 5): a
 * blocker, a question and a review are different obligations, not one alert total. Only non-zero
 * groups are shown, and a reason outside these groups is counted as "other" rather than dropped.
 */
const summaryGroups: readonly Readonly<{
  reasons: readonly string[];
  one: string;
  many: string;
}>[] = [
  { reasons: ["blocked", "failed"], one: "blocked", many: "blocked" },
  { reasons: ["question_open", "waiting_input"], one: "question", many: "questions" },
  { reasons: ["review_requested", "approval_required"], one: "review", many: "reviews" },
];

export function attentionSummary(items: readonly Readonly<{ reason: string }>[]): string {
  const parts = summaryGroups.flatMap(({ reasons, one, many }) => {
    const count = items.filter((item) => reasons.includes(item.reason)).length;
    return count > 0 ? [`${count} ${count === 1 ? one : many}`] : [];
  });
  const known = new Set(summaryGroups.flatMap(({ reasons }) => reasons));
  const other = items.filter((item) => !known.has(item.reason)).length;
  if (other > 0) parts.push(`${other} other`);
  return parts.join(" · ");
}

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
export function officeLibraryFor(
  state: OfficeFixtureState,
  fixtureId?: string,
): BrowserLibraryProjection {
  const { fixture } = officeFixtureFor(state, fixtureId);
  const snapshot = replayProject(fixture.events);
  const model = projectOfficeReadModel({ snapshot, now: fixture.now, registry: OFFICE_REGISTRY });
  return {
    knowledge: PHASE_4_KNOWLEDGE,
    evidence: projectOfficeLibraryEvidence({ snapshot, model }),
  };
}

/**
 * The office's motion cue (Phase 7-O Task 9, owner ruling (a)): one transition per handoff the log
 * records, at the revision it was recorded. With none recorded, there is no cue. Presentation,
 * checkpoints and reduced-motion placement come from `planSemanticMotion`; the wording uses the
 * office's own labels for the people involved.
 */
export function motionFrom(
  model: OfficeReadModel,
  options: Readonly<{
    reducedMotion: boolean;
    checkpoint: string;
    /**
     * Task 9f-4, constitution rule 6: while updates are unavailable, no work is shown moving; the
     * handoff stays a recorded fact.
     */
    updatesUnavailable?: boolean;
  }>,
): OfficeMotionCue | undefined {
  const plan = planSemanticMotion({
    canonicalRevision: revisionOf(model),
    transitions: model.handoffs.map((handoff) => ({
      transitionId: handoff.handoffId,
      semantic: "handoff",
      entityId: handoff.fromEntityId,
      fromEntityId: handoff.fromEntityId,
      toEntityId: handoff.toEntityId,
      canonicalRevision: handoff.revision,
    })),
    reducedMotion: options.reducedMotion,
    motionPaused: options.updatesUnavailable ?? false,
    clock: () => 0,
  });
  const lead = plan.lead;
  if (!lead) return undefined;
  const to = entityOf(model, lead.toEntityId)?.label ?? lead.toEntityId;
  return {
    canonicalRevision: plan.canonicalState.revision,
    presentation: lead.presentation,
    checkpoint: options.checkpoint,
    label:
      lead.presentation === "travel"
        ? `Handoff moving to ${to}`
        : `Handoff to ${to} recorded · revision ${lead.canonicalRevision}`,
    announcement: `Handoff to ${to} recorded`,
    queuedCount: plan.queued.length,
    loop: lead.loop,
    runtimePaused: plan.runtimePaused,
  };
}

// ---- Plain language (Phase 7-O Task 9d, spec §6): the inspector's and outline's first screen. ----

const capitalise = (value: string) =>
  value.length === 0 ? value : `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;

/** A recorded state in words: `waiting_input` → "Waiting input". */
export const stateWord = (value: string) => capitalise(value.replace(/_/gu, " "));

const heldPhrase: Readonly<Record<string, string>> = {
  blocked: "Blocked on",
  waiting_input: "Waiting for input on",
  review_requested: "Waiting for your review of",
  failed: "Failed on",
};

/** One word for a person in the outline: their presence, or why it cannot be trusted. */
export function personStateWord(person: OfficePersonView): string {
  if (person.agent.status !== "recorded") return "Not recorded";
  if (person.agent.health === "disconnected") return "Unavailable";
  const word = stateWord(person.agent.presence);
  return person.agent.health === "stale" ? `${word} (delayed)` : word;
}

export const needsManager = (person: OfficePersonView) => person.attention.length > 0;

/** Shell states in which current activity is unknown (constitution rule 6; AR-03). */
export const UPDATES_UNAVAILABLE_STATES: ReadonlySet<string> = new Set(["stale", "offline"]);

type Currency = Readonly<{ updatesUnavailable?: boolean }>;

/**
 * One state word, and "Needs you" when a held item needs the manager (Task 9d, F-9-3). While
 * updates are unavailable the state is unknown, and the word is what was last confirmed (Task
 * 9f-4; AR-03, constitution rule 6).
 */
export function personStateLine(
  model: OfficeReadModel,
  entityId: string,
  options: Currency = {},
): string {
  const entity = entityOf(model, entityId);
  if (entity?.kind !== "person") return "Not in the office read model";
  const word = options.updatesUnavailable
    ? `Status unknown · last confirmed: ${personStateWord(entity)}`
    : personStateWord(entity);
  return `${word}${needsManager(entity) ? " · Needs you" : ""}`;
}

/** The latest time any person's state was recorded, as "HH:MM UTC", or nothing when none was. */
export function lastConfirmedAt(model: OfficeReadModel): string | undefined {
  const times = model.entities.flatMap((entity) =>
    entity.kind === "person" && entity.agent.status === "recorded" ? [entity.agent.updatedAt] : [],
  );
  const latest = times.sort().at(-1);
  return latest ? `${latest.slice(11, 16)} UTC` : undefined;
}

export type SceneLabel = Readonly<{
  entityId: string;
  kind: "person" | "zone";
  name: string;
  /** A person's plain state, the same words the outline shows; zones carry their name only. */
  state: string | undefined;
  needsYou: boolean;
}>;

/**
 * The office's own cues (Task 9f-3, owner ruling P-3; AR-01, constitution rules 2 and 9): each
 * person's name and plain state, and each zone's name. `needsYou` selects the amber treatment,
 * and is never set without "Needs you" in the words.
 */
export function sceneLabelsFrom(
  model: OfficeReadModel,
  options: Currency = {},
): readonly SceneLabel[] {
  return OFFICE_REGISTRY.map((entry) => {
    if (entry.kind !== "person") {
      return {
        entityId: entry.entityId,
        kind: "zone",
        name: entry.label,
        state: undefined,
        needsYou: false,
      };
    }
    const person = personOf(model, entry.entityId);
    const needsYou = person ? needsManager(person) : false;
    return {
      entityId: entry.entityId,
      kind: "person",
      name: entry.label,
      // AR-03, "Ren · Status unknown": in the scene, unknown is said without the history.
      state: options.updatesUnavailable
        ? `Status unknown${needsYou ? " · Needs you" : ""}`
        : personStateLine(model, entry.entityId),
      needsYou,
    };
  });
}

export function happeningText(person: OfficePersonView): string {
  const held = person.work.find((work) => heldPhrase[work.state]);
  if (held) return `${heldPhrase[held.state]} ${held.outcome}`;
  const active = person.work[0];
  if (active) return `${personStateWord(person)}: ${active.outcome} (${stateWord(active.state)})`;
  return personStateWord(person);
}

const sourceWords: Readonly<Record<string, string>> = {
  system: "the system",
  adapter: "the agent's runtime",
  manager: "you",
  reviewer: "a reviewer",
};

export function whyText(person: OfficePersonView): string {
  if (person.work.length === 0) return NOT_ASSIGNED;
  const held = person.work.filter((work) => attentionStates.has(work.state));
  if (held.length === 0) return "No held work is blocked or waiting.";
  return held
    .map((work) => {
      const condition = work.condition;
      if (!condition) return `${work.outcome}: ${NO_REASON}.`;
      const recorded =
        work.causeEventId === condition.eventId
          ? ` Recorded ${work.updatedAt.slice(11, 19)} UTC.`
          : "";
      const who = sourceWords[condition.source] ?? condition.source;
      return `${condition.summary} Reported by ${who} (${condition.trust}).${recorded}`;
    })
    .join(" ");
}

export function needsYouPlain(person: OfficePersonView): string {
  if (person.attention.length === 0) return "Nothing needs you";
  return person.attention
    .map((item) => item.condition?.requestedAction.summary ?? NO_ACTION)
    .join(" ");
}

export function evidencePlain(person: OfficePersonView): string {
  if (person.work.length === 0) return NOT_ASSIGNED;
  const evidence = person.work.flatMap((work) => work.evidence);
  if (evidence.length === 0) return "No linked evidence recorded";
  return evidence
    .map((item) => `${capitalise(item.kind)} evidence, version ${item.version}: ${item.result}`)
    .join("; ");
}

export function approvalPlain(person: OfficePersonView): string {
  if (person.work.length === 0) return NOT_ASSIGNED;
  const several = person.work.length > 1;
  return person.work
    .map((work) => {
      const { approval } = work;
      const text =
        approval.status === "approved"
          ? "Approved"
          : approval.status === "unresolved"
            ? "Approval unresolved: it cites evidence the log does not hold"
            : approval.missingEvidenceKinds.length > 0
              ? `Not approved: ${approval.missingEvidenceKinds.join(", ")} evidence missing`
              : "Not approved";
      return several ? `${work.outcome}: ${text}` : text;
    })
    .join(" / ");
}

/** The first-screen freshness warning, or null when the record is current. */
export function freshnessWarning(
  person: OfficePersonView,
  model: OfficeReadModel,
  overlay: string | null,
): string | null {
  const freshness = person.agent.status === "recorded" ? person.agent.freshness : "unavailable";
  const parts: string[] = [];
  if (freshness !== "current") parts.push(`This record may be out of date (${freshness}).`);
  if (overlay) parts.push(`The workspace is ${overlay}.`);
  if (!model.current) parts.push("The office read model is not current.");
  return parts.length > 0 ? parts.join(" ") : null;
}
