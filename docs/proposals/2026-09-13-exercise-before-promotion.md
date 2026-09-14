# Exercise before promotion

**Status: IMPLEMENTED. Corrected 2026-09-13** — this line read "proposed, not approved. Nothing implemented" after the exercise gate had already shipped. The gate exists (`90df656`), the opt-in launcher exists (`fca2482`, `scripts/run-role-exercises.ts`), and all six exercises performed under `bcba1f2`. Left uncorrected it was the DF-003 defect this project has already recorded against `AGENTS.md` and `tasks/phase-4-todo.md`.

Author: agent, 2026-09-13. Raised out of Task 17c but not part of it: this changes the promotion
gate itself, which every future artifact passes through.

## 1. What promotion currently certifies

`promote-roles.mjs` and `check-agency-agents.mjs` together establish that a role was **faithfully
acquired**: the bytes match the upstream at a pinned commit, the path is allowlisted, the overlay is
non-executable and correctly shaped, no instruction was injected during import, and the whole set
promotes or none of it does.

Every one of those checks is sound and all of them pass.

None of them establishes that the role **works under the constraints it will run in**. Promotion is
a fidelity certificate that reads, at every downstream use, as a fitness certificate.

## 2. The evidence that this matters

Three findings now share one shape.

- **DF-010.** Every thread loaded an instruction source in the owner's Codex home — unpinned,
  shared across all six roles, itself pointing at a further skill directory. The promotion machinery
  pins instructions exactly; it had no way to ask whether there were others.
- **DF-011.** Two of six roles instruct the agent to run shell commands as its first action, in a
  kickoff where any observed command stops the whole run. Two of six describe Laravel, Livewire and
  FluxUI. All six claim persistent memory that ephemeral threads do not have. Every import guard
  passed, including one named *"rejects hidden instructions and executable overlays"*.
- **The probes.** What the runtime reports, and whether `CODEX_HOME` is honoured, were both
  unanswerable by reading the tree and both answered in one turn or less.

In each case the guards were exact inside a boundary that had been drawn by assumption, and in each
case the thing that found the problem was cheap contact with reality.

## 3. Why the fix is not another guard

A guard is written inside the same boundary as the thing it guards. That is why running the existing
import checks more carefully would never have found DF-011: the checks ask whether the copy is
faithful, and the problem is that faithful is not the same as usable. A new check written by the
same reasoning would sit in the same place.

The register already tried the prose-rule route once, for DF-008, and recorded it as a weaker
answer than a test. A fourth prose rule is weaker still.

What has actually worked, three times running, is exercising the thing once.

## 4. Proposal

**A role may not be promoted until it has been exercised once against the real runtime, and the
result recorded.**

The exercise is deliberately small:

- One bounded, text-only turn per role, in a controlled Codex home containing only that role's
  composed instruction, under the same sandbox and approval settings a kickoff turn will use.
- A single standard prompt, identical for all roles, asking the role to state in its own words what
  it is responsible for and what it will not do.
- The transcript is the evidence.

Six turns, once, per import.

### What the exercise can assert mechanically

- The turn completed.
- No external effect was observed — no `runtime.command`, `file`, `tool` or `artifact`.
- The reported model, effort and protocol match what was approved.
- `instructionSources` contains exactly the composed role file and nothing else.

Those four are ordinary machine checks and belong in the exercise record.

### What only a person can assess

Whether the role's answer describes the role that was intended, in terms of the project it is
actually joining. No test establishes that. For these six roles, a person reading six short
transcripts would have seen the shell-command instruction and the Laravel stack immediately.

### Recording it honestly

The exercise record must mark, per role, whether it was **performed or not performed** — the rule
MDD §20 already imposes on comprehension tasks, for the same reason it was imposed there: an
unperformed check must never be recorded as a passed one. A waived exercise is a legitimate owner
decision and must read as a waiver.

## 5. Making it structural rather than habitual

`planPromotion` refuses a role with no recorded exercise, with a named failure code, the same way it
already refuses a partial set, an unknown role, or drifted digests.

That matters more than the exercise itself. A procedural rule that lives only in a document is one
busy afternoon from being skipped; a refusal code is not. It also fits the existing shape — the
promoted set is derived on every read rather than trusted once, and an exercise that is not recorded
is simply another thing the derivation cannot find.

## 6. Cost and the obvious failure mode

Six turns per import, plus the reading. Against this task's history — five weeks of building
promotion machinery for roles that cannot run here — that is not a close call.

The failure mode is ceremony: an exercise that is run, recorded and never read, which would convert
a real check into a passed gate that means nothing. That is the same failure the comprehension
study hit when unperformed tasks were nearly scored as interface failures. The performed /
not-performed mark is the mitigation, and it is the only part of this proposal that has already been
tested in practice.

## 7. Scope

Roles now. The same argument plainly extends to any artifact that will be executed rather than
read, but extending it is a separate decision and should be made when there is a second kind of
artifact to extend it to, not in advance.

## 8. Approval requested

1. That promotion requires a recorded exercise, refused by a named code when absent.
2. The shape of the exercise in §4: one text-only turn per role, standard prompt, four mechanical
   assertions, transcript read by the owner.
3. That the six existing roles be exercised before any promotion, which is the first use of it.
