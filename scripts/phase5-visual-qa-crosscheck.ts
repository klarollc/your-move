/**
 * Did a Visual QA annotation claim more than an accessibility tree can establish?
 *
 * Two things are overclaims, and one thing that looks like an overclaim is not.
 *
 * Claiming a state the build cannot enter is a claim about something that does not exist. Claiming a
 * state is *fully* satisfied asserts its visual treatment is satisfied, which no accessibility tree
 * can show — that is the class-4 judgement MDD section 18 reserves for a person.
 *
 * A third rule was drafted here and removed: that the annotation must defer *something* to a human.
 * The runner already refuses to accept an annotation with an empty `requiresHumanEyes`, and two
 * guards over one property are two guards that can later disagree about it.
 *
 * What is **not** an overclaim is marking every state `partial` with the visual gap stated. The first
 * version of this check demanded the literal value `cannot-tell-without-seeing` somewhere and, when
 * pass 2 deferred appearance on all twenty states by a different spelling, reported the most careful
 * annotation the phase has produced as dishonest. Honesty does not have exactly one spelling.
 */

export type VisualQaAnnotation = { stateAnnotations?: unknown };

type StateAnnotation = { stateId?: unknown; contractSatisfied?: unknown };

export function visualQaOverclaims(
  value: VisualQaAnnotation,
  unreachableStates: ReadonlySet<string>,
): string[] {
  const found: string[] = [];
  const annotations: StateAnnotation[] = Array.isArray(value.stateAnnotations)
    ? (value.stateAnnotations as StateAnnotation[])
    : [];

  for (const entry of annotations) {
    const stateId = String(entry.stateId ?? "");
    const satisfied = String(entry.contractSatisfied ?? "");

    if (unreachableStates.has(stateId)) {
      found.push(
        `${stateId} annotated ${satisfied} though the build cannot enter that state at all`,
      );
      continue;
    }
    if (satisfied === "yes") {
      found.push(
        `${stateId} annotated fully satisfied, which asserts a visual treatment no accessibility tree can establish`,
      );
    }
  }

  return [...new Set(found)];
}
