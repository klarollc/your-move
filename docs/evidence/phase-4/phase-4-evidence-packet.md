# Phase 4 evidence packet — graybox office and collaborative kickoff

Status: **Tasks 1–18 complete. The Phase 4 owner gate is open and awaits the owner.**
Specification: `docs/phase-4-graybox-office-and-kickoff-spec-v0.1.md`, `.ui-craft/spec.md`
Plan and checklist: `tasks/phase-4-plan.md`, `tasks/phase-4-todo.md`
Span: 2026-08-13 to 2026-09-14

## What Phase 4 was for

A truthful, accessible graybox office over the accepted canonical runtime, its full manager and agent
collaboration paths proved with deterministic fixtures, and — after a separate gate — one bounded
live D-25 kickoff producing a charter for the manager to approve. High-fidelity art was excluded
throughout.

## What exists

| Tasks | Outcome |
| --- | --- |
| 1–3 | Authority reconciled, read-model and intent contracts, component and browser harness |
| 4–8 | Loopback boundary, spatial measurements, PixiJS adapter, camera and hit testing, React shell with the equivalent Office outline |
| 9–12 | Shared selection and inspector, attention rail, Project Library and evidence surfaces, failure/reconnect/motion equivalence |
| 13–14 | D-25 kickoff domain, command workflow, kickoff UI and reciprocal parity |
| 15 | Graybox visual, accessibility and comprehension gate — **accepted 2026-09-08 on partial human evidence** |
| 16 | Exact role promotion and live kickoff preflight |
| 17 | **The bounded live D-25 round, complete 2026-09-14** |
| 18 | This packet |

402 tests pass across the repository; typecheck, lint and format are clean.

## What Phase 4 proves

**The office is a projection of canonical state, not a picture of one.** Scene descriptors, the
accessible outline and the attention rail are all derived from replayed events. Motion occurs only
where canonical state carries it.

**Six promoted roles behave as distinct agents in live use.** Task 17 ran thirteen turns across six
persistent threads under the packet's limits. Four roles proposed; the two reviewer roles critiqued.
Fourteen disagreements and thirty-two uncertainties were recorded in the round that stopped, and the
completed round attributed disagreement to all six roles and listed ten unresolved evidence gaps. The
revisions split four amend / two affirm along exactly the line the briefs describe.

**Containment held.** No external effect was observed in either live attempt. Bindings were verified
against the approved packet on every session: six distinct material fingerprints, models and effort
as approved.

**The system stops rather than repairs.** Attempt 1's synthesis was refused and the run halted at
turn 7 with everything prior preserved. That is the designed behaviour and it is the reason the
defect behind it was visible at all.

## What Phase 4 does not prove

1. **MDD §19 and §20 are not met.** Task 15 closed by owner waiver with comprehension tasks T3, T5
   and T6 never performed and the manual screen-reader walkthrough never run. **Neither waiver is a
   pass**, and both remain open against this phase.
2. **No charter is approved.** Task 17 ended at `phase: revision` with `implementationAllowed: false`.
   The manager disposition is outstanding, and Phase 5 has nothing to execute until it exists.
3. **Ten evidence gaps are open**, named by the agents themselves — the approving manager is
   unidentified, the viewport/browser/accessibility conformance matrix is unspecified, the decision
   fixture and provenance rules are unspecified, acknowledge and defer semantics are unresolved, and
   the severity taxonomy and due-date handling are undefined.
4. **One live round is one sample.** Thirteen turns on one day tell us the roles are distinct and the
   round completes. They do not tell us the behaviour is stable across runs.
5. **No high-fidelity art, no deployment, no external effect** was in scope and none occurred.

## Defects found during Phase 4 and fixed

| Finding | Why it mattered |
| --- | --- |
| `createControlledCodexHome` withheld the credential | Every role exercise failed `AUTH_REQUIRED` while the owner was authenticated; the DF-010 fix had isolated the credential by accident |
| `roles:promotion:status` joined the superseded import | Reported an empty promoted set while six roles were promoted — a gate reporting closed while open (DF-012) |
| `waitForNotification` never consumed | A thirteen-turn round would have replayed turn one twelve times and reported success |
| Kickoff domain hardcoded `"delivery"` | The live round would have died at turn 7 of 13 on a naming mismatch, spending the whole allowance |
| JSON array coerced to its first element | A role answering with a list would have had one item adopted as its whole position |
| Synthesis prompt conflated two identifier kinds | Cost attempt 1 at turn 7 |

The first four were found by the preflight, the rehearsal, or by measuring. Only the last was found
by spending a live turn — which is the trade the rehearsal was built to make.

## Phase 4 gate

The owner accepts this evidence or requests corrections. Accepting it does not authorize Phase 5,
high-fidelity art, deployment, or any external effect, all of which remain separately gated. The two
MDD §19/§20 waivers carry forward unresolved.
