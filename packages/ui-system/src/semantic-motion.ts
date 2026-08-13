const travelSemantics = new Set([
  "assignment",
  "handoff",
  "collaboration-entry",
  "collaboration-exit",
  "escalation",
  "review",
  "delivery",
]);

export type SemanticTransition = Readonly<{
  transitionId: string;
  semantic: string;
  entityId: string;
  fromEntityId: string;
  toEntityId: string;
  canonicalRevision: number;
}>;

type MotionPresentation = SemanticTransition &
  Readonly<{
    presentation: "travel" | "immediate-placement" | "persistent-label";
    durationMs: number;
    properties: readonly ("transform" | "opacity")[];
    checkpoints: readonly string[];
    persistentLabel: string;
    announcement: string;
    loop: false;
  }>;

export function planSemanticMotion(
  input: Readonly<{
    canonicalRevision: number;
    transitions: readonly SemanticTransition[];
    reducedMotion: boolean;
    motionPaused: boolean;
    clock: () => number;
  }>,
): Readonly<{
  canonicalState: Readonly<{ revision: number; appliedAt: number }>;
  lead: MotionPresentation | undefined;
  queued: readonly MotionPresentation[];
  motionPaused: boolean;
  runtimePaused: false;
}> {
  const canonicalState = {
    revision: input.canonicalRevision,
    appliedAt: input.clock(),
  };
  const presentations = input.transitions
    .filter(({ canonicalRevision }) => canonicalRevision <= input.canonicalRevision)
    .toSorted(
      (left, right) =>
        left.canonicalRevision - right.canonicalRevision ||
        left.transitionId.localeCompare(right.transitionId),
    )
    .map((transition) => presentTransition(transition, input));

  return {
    canonicalState,
    lead: presentations[0],
    queued: presentations.slice(1),
    motionPaused: input.motionPaused,
    runtimePaused: false,
  };
}

function presentTransition(
  transition: SemanticTransition,
  policy: Readonly<{ reducedMotion: boolean; motionPaused: boolean }>,
): MotionPresentation {
  const allowed = travelSemantics.has(transition.semantic);
  const travel = allowed && !policy.reducedMotion && !policy.motionPaused;
  const immediate = allowed && policy.reducedMotion && !policy.motionPaused;
  return {
    ...transition,
    presentation: travel ? "travel" : immediate ? "immediate-placement" : "persistent-label",
    durationMs: travel ? 480 : 0,
    properties: travel ? ["transform", "opacity"] : ["opacity"],
    checkpoints: travel ? ["start", "responsibility-transferred", "settled"] : ["settled"],
    persistentLabel: `${capitalize(transition.semantic)} recorded at ${entityLabel(transition.toEntityId)} · revision ${transition.canonicalRevision}`,
    announcement: `${capitalize(transition.semantic)} moved to ${entityLabel(transition.toEntityId)}`,
    loop: false,
  };
}

const authoredEntityLabels: Readonly<Record<string, string>> = {
  zone_review: "Review station",
  zone_delivery: "Delivery area",
  zone_team: "Team work area",
  zone_collaboration: "Collaboration table",
  zone_manager: "Manager desk",
  zone_library: "Project Library",
};

function entityLabel(entityId: string): string {
  if (authoredEntityLabels[entityId]) return authoredEntityLabels[entityId];
  return entityId
    .replace(/^zone_/u, "")
    .split("_")
    .map(capitalize)
    .join(" ");
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
