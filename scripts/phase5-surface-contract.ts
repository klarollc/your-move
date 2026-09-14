import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * What the Product Designer's surface contract has to cover, derived from the frozen acceptance
 * contract rather than listed by hand.
 *
 * Deriving it is the point. A hand-written checklist would be a second statement of the same
 * requirements, free to drift from Task 2's criteria — and the drift would show up as a surface
 * contract that passes its own review while leaving a criterion unsatisfiable.
 */
const ROOT = resolve(process.cwd());

export type RequiredState = { id: string; from: string; why: string };

/** Charter gap 7: art direction, responsive and content-length rules, reduced motion, state inventory. */
export const REQUIRED_SECTIONS = [
  "interactionContract",
  "artDirectionContract",
  "stateInventory",
  "responsiveRules",
  "contentLengthRules",
  "reducedMotion",
] as const;

export const REQUIRED_STATES: RequiredState[] = [
  {
    id: "pending",
    from: "C-07",
    why: "the seven lifecycle states must be distinguishable without colour",
  },
  { id: "acknowledged", from: "C-07", why: "as above" },
  { id: "deferred", from: "C-07", why: "as above" },
  { id: "overdue", from: "C-07", why: "as above" },
  { id: "saving", from: "C-07", why: "as above" },
  { id: "save-failed", from: "C-07", why: "as above" },
  { id: "disabled", from: "C-07", why: "as above" },
  { id: "severity-routine", from: "C-14", why: "three severity levels render distinctly" },
  { id: "severity-significant", from: "C-14", why: "as above" },
  { id: "severity-critical", from: "C-14", why: "as above" },
  {
    id: "severity-unknown",
    from: "C-14",
    why: "an unrecognised severity is a named state, never blank or guessed",
  },
  {
    id: "date-malformed",
    from: "C-15",
    why: "a malformed date is a named state, never blank or substituted",
  },
  { id: "link-resolved", from: "C-16", why: "a present fixture artifact resolves" },
  { id: "link-missing", from: "C-16", why: "each link failure is its own named state" },
  { id: "link-invalid", from: "C-16", why: "as above" },
  { id: "link-unavailable", from: "C-16", why: "as above" },
  {
    id: "validation-reason-empty",
    from: "C-04",
    why: "defer is refused with a named validation state",
  },
  { id: "validation-reason-too-long", from: "C-04", why: "as above" },
  {
    id: "validation-date-invalid",
    from: "C-04",
    why: "as above, covering absent, malformed and past dates",
  },
  {
    id: "undo-available",
    from: "C-13",
    why: "either action can be undone and the undo is its own event",
  },
];

export async function buildSurfaceContractBrief(): Promise<string> {
  const contract = JSON.parse(
    await readFile(resolve(ROOT, "docs/evidence/phase-5/acceptance-contract.json"), "utf8"),
  ) as { criteria: Array<{ id: string; statement: string; status: string }> };
  const charter = await readFile(
    resolve(ROOT, "docs/evidence/phase-5/approved-charter-v1.md"),
    "utf8",
  );
  const tokens = await readFile(resolve(ROOT, ".ui-craft/tokens.md"), "utf8");

  const criteria = contract.criteria
    .map((criterion) => `  ${criterion.id} [${criterion.status}] ${criterion.statement}`)
    .join("\n");

  return `THE APPROVED CHARTER

${charter}

THE FROZEN ACCEPTANCE CONTRACT — twenty-one criteria your surface contract must make satisfiable

${criteria}

THE ACTIVE VISUAL SYSTEM — approved design direction you must work within

${tokens}

The Active system promoted in Phase 6 is "reconciliation-b-clarity": Candidate B's human studio
warmth with three clarity traits imported from Candidate A — a 0.7px defining edge on solid faces, a
tightened contact shadow, and wider floor-zone value separation with a darker boundary. Warm palette,
textiles, practical lighting. You are designing a component, not the office, but it lives in that
system.

YOUR TASK

Produce the surface contract for the Decision Notice component. This closes charter gap 7, which is
currently blocking criterion C-19, and no implementation may begin until it exists.

Return one JSON object with exactly these keys:

{
  "interactionContract": {"...": "how acknowledge, defer, undo and validation behave, including
     keyboard and pointer paths and the rule that focus never triggers an action"},
  "artDirectionContract": {"...": "how the component looks within the Active system: surface,
     typography role, the single reserved accent and what it may never mark, spacing intent"},
  "stateInventory": [{"id": "...", "visualTreatment": "...", "nonColourCue": "...",
     "accessibleName": "..."}],
  "responsiveRules": ["..."],
  "contentLengthRules": ["..."],
  "reducedMotion": ["..."]
}

The state inventory must cover every one of these ${REQUIRED_STATES.length} states, by exactly these ids:

${REQUIRED_STATES.map((state) => `  ${state.id}  — required by ${state.from}: ${state.why}`).join("\n")}

Rules the project enforces and you may not relax:
- Status never relies on colour alone. Every state needs a cue that survives greyscale.
- No two states may share an identical non-colour signature. Distinguishable, not merely annotated.
- The accent is reserved for attention, focus and primary action. It never marks severity, role, or
  decoration.
- Reduced motion removes transitions, never meaning.
- You are defining a contract, not approving one. Only the owner accepts fidelity.

One JSON object. No prose outside it, no code fence.`;
}
