# Comprehension gate — proposal

Status: **Proposed 2026-10-03. Awaiting owner approval. Approves nothing, amends no
requirement, authorizes no work until approved.**
Purpose: gate Phase 7 Task 7 implementation on a genuine MDD §20 comprehension measurement.

## Decisions (owner-ruled 2026-10-03)

- **G-1 (gate strength):** Task 7 implementation starts when the baseline §20 run is
  completed, scored, and dispositioned. "Designed and approved" alone does not open the gate;
  "met" is not required to open it.
- **G-2 (freeze scope):** the freeze covers implementation only. Planning and specification
  for Tasks 7+ may continue under their separate approval gates.
- **G-3 (baseline before changes):** the run happens on the post-Task 6 build, before any
  interface revision, giving a clean before/after.
- **G-4 (pre-committed fork):** a not-met result defaults to revise-interface-and-re-run.
  Thesis revision (MDD amendment) or waiver-with-recorded-unknown require explicit owner ruling.
- **G-5 (key generation):** new answer key and interval are owner-owned. Confirmed 2026-10-03.
- **G-6 (disposition location):** alongside the run sheet under
  `docs/evidence/phase-7-o/comprehension/`. Confirmed 2026-10-03.
- **G-7 (exposure check wording):** plain question, no special wording care. Confirmed
  2026-10-03.

## 1. What the gate gates

Task 6 implementation (owner-approved, in progress) completes first. The baseline build is the
post-Task 6 build. **Task 7 implementation does not start until the disposition record (§4)
exists.** Planning/specification for Task 7+ may proceed (G-2) but must not alter the build
under evaluation between the run and the disposition.

## 2. Evaluator

The owner's wife: non-technical, never built the interface. Timing is at the owner's
discretion; no date is proposed here.

Pre-run exposure check: before the run, ask plainly whether anyone has walked her through the
interface before, and record the answer with the response sheet. The MDD's three-day gap rule
is trivially satisfied for an evaluator who never built the interface; the exposure check is
its replacement, guarding against incidental household exposure.

## 3. Protocol

MDD §20 as written, with two prerequisites from the project's own conventions:

1. **New answer key and interval.** Per `docs/HANDOFF.md`, the key is spent for this
   interface: "A future cold run needs a new key and a new interval." The key must quote facts
   at their task URLs (guarded in `verify`: the e2e spec asserts every quoted fact,
   `scripts/comprehension-preamble.test.mjs` asserts the preamble SHA-256). Key generation is
   owner-owned (G-5); its contents are never revealed.
2. **Exposure check** (§2 above), recorded.

Then the §20 six tasks, short orientation only, answers from the interface alone. The response
sheet records per task: actually performed (unperformed ⇒ run incomplete, never scored),
correct, and the exposure-check answer.

## 4. Scoring and disposition

Scoring per §20: 6/6 met; 5/6 met with the failure recorded as a named finding; ≤4/6 not met.

The gate's output is a **disposition record** (G-6) with the owner's ruling, one of:

- **Proceed:** met. Task 7 starts as planned.
- **Revise (default on not-met, G-4):** interface revision plan scoped to the failed
  criteria, then re-run. Task 7 starts when the owner records that the revision plan does not
  invalidate Task 7's approved scope — or, where it does, when the re-run is dispositioned.
- **Thesis revision:** MDD amendment. Explicit owner ruling required.
- **Waiver:** recorded per the §19 owner-waiver clause — it closes the gate on authority and
  never converts the unperformed check into a pass. Explicit owner ruling required.

"Dispositioned" means this record exists with the owner's ruling. The gate forces the
decision, not a specific outcome: no rendering proceeds on an unexamined score.

## 5. Freeze mechanics

- Between the baseline run and the disposition, no change to the evaluated build (G-3).
  Planning/specification work continues under G-2 but must not touch the build.
- If the run surfaces interface *defects* (as opposed to comprehension failures), those are
  fixed through the normal defect path; comprehension scoring stands on the remaining tasks,
  and any fix that alters the build restarts the baseline.

## 6. Edge cases

- **Evaluator unavailable indefinitely:** the gate cannot be satisfied by design alone (G-1).
  Escalates to owner ruling — the sharp edge accepted 2026-10-03.
- **Incomplete run:** reschedule. An incomplete run is never dispositioned as a score.
- **Revision invalidates Task 7 scope:** Task 7's plan returns for re-approval against the
  revised interface before implementation starts.

## 7. Relation to the other workstreams

- **D (true measurement)** is merged into this gate: the evaluator protocol above *is* D's
  remaining work, plus timing (owner's call).
- **B (governance audit)** runs parallel, recommend-only on phase-gate requirements.
- **C (dogfood the product)** follows as a phase-level initiative once this gate is resolved.
