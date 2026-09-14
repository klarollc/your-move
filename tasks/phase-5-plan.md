# Implementation plan: Phase 5 controlled six-role acceptance project

Status: **Owner-authorized 2026-09-14.** All four decisions are ruled and the charter is approved; `AGENTS.md` is amended the same day. Tasks 1-9 authorized, Task 10 owner-run.
Governing: MDD §24 Phase 5, §6 D-23/D-24, `docs/implementation-plan-v0.1.md` Phase 5
Input: the charter the owner approves from the Task 17 round (`docs/evidence/phase-4/live-kickoff/task-17-run/`)
Prior phase: `tasks/phase-4-plan.md`

## Outcome

The admitted six-role team executes the approved charter as an isolated representative software
feature, producing every required evidence class, and the owner accepts the fixture outcome or
records bounded revisions.

Phase 5 is the phase where the project's whole argument is tested: not whether agents can talk, which
Task 17 showed, but whether six bounded roles can carry one piece of work to a standard a reviewer
would accept.

## The thing that makes this phase different

Every prior phase produced artifacts an agent wrote under human direction. Phase 5's required run
(MDD §24) assigns the work to the roles: the Implementation Engineer records RED, GREEN and REFACTOR
evidence; the Test Engineer produces deterministic browser and failure evidence; the Visual QA
Reviewer captures and annotates current-build evidence; the Release Reviewer independently returns
NEEDS WORK or owner-approval eligibility.

**How literally that is read is the single largest decision in this plan**, and it is recorded as
Decision 5-A rather than assumed. It changes the turn budget, the cost, the evidence provenance, and
what the phase actually proves, and no reading of it is obviously correct.

## Open decisions — all must be ruled before Task 1

- **5-A — Who implements.** The agents, an agent-supervised human-driven build, or a hybrid where
  agents own design/review/verdict and implementation is driven conventionally.
- **5-B — Turn and cost budget.** Phase 5 has no D-25 thirteen-turn cap. A budget must be set before
  the first provider call, and the run must stop at it rather than negotiate.
- **5-C — The ten evidence gaps.** The agents named them; someone must answer them before
  implementation, because each is a place where a passing test would prove nothing.
- **5-D — MDD §19/§20.** The comprehension study and screen-reader walkthrough were waived in Phase 4
  and remain unmet. Phase 5 either inherits the waiver, repeats the gate properly, or proceeds with
  the debt recorded again.

## Task sequence

- **Task 1 — Record the approved charter.** The owner's charter, versioned, with the disposition of
  every one of the ten gaps. No implementation before this exists.
  - Verify: charter record test; `implementationAllowed` cannot be true without it.

- **Task 2 — Freeze the acceptance contract.** The Decision Notice acceptance contract from MDD §6,
  reconciled with the charter, as machine-checkable criteria. Every criterion carries its evidence
  class.
  - Verify: criterion-to-evidence traceability matrix, and no criterion without a named class.

- **Task 3 — Product Designer surface contract.** The interaction and art-direction contract for the
  component, owner-accepted before implementation. Uses the Active visual system from Phase 6.

- **Task 4 — RED evidence.** Failing tests for every criterion, each failing for its stated reason.
  A test that never failed for the right reason is not evidence.

- **Task 5 — GREEN and REFACTOR.** Implementation to the contract, then refactor with behaviour held.

- **Task 6 — Test Engineer verification.** Deterministic browser and failure evidence, negative paths,
  and an explicit statement of what is not covered.

- **Task 7 — Visual QA capture.** Current-build evidence at the approved viewports, annotated against
  the art-direction contract. Screenshot diffs detect change; they never approve taste.

- **Task 8 — Shared-knowledge scenario.** Contribution, retrieval and conflict resolution exercised
  and passing, per the Phase 5 gate.

- **Task 9 — Release Reviewer verdict.** Independent: NEEDS WORK or eligible-for-owner-approval.
  **The reviewer may not be the implementer**, and the verdict is not a rubber stamp on a green suite.

- **Task 10 — Owner acceptance.** The owner accepts the fixture outcome or records bounded revisions.
  **Owner-run.** Atomically creates the D-24 review that Phase 8 closes.

## Dependency graph

```text
5-A .. 5-D ruled
      |
1 charter recorded
      |
2 acceptance contract -> 3 surface contract
      |
4 RED -> 5 GREEN/REFACTOR -> 6 test verification -> 7 visual QA
      |                                  |
      +----------- 8 shared knowledge ---+
      |
9 independent release verdict
      |
10 OWNER acceptance  <-- stop
```

## Risks

| Risk                                                    | Impact | Mitigation                                                                                |
| ------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| A green suite is mistaken for an accepted feature       | High   | Task 9's verdict is independent and Task 10 is owner-run; completion is never approval    |
| The agents implement something that only looks finished | High   | Task 2's criteria are machine-checkable and carry evidence classes before any code exists |
| Budget is discovered rather than set                    | High   | 5-B is ruled before the first provider call, and the run stops at it                      |
| The ten gaps are answered implicitly by implementation  | High   | 5-C is ruled at Task 1; an unanswered gap blocks the criterion that depends on it         |
| One live sample is treated as stable behaviour          | Medium | Phase 4 recorded that one round is one sample; Phase 5 should say how many runs it took   |
| Phase 5 quietly becomes production work                 | High   | The fixture is isolated by D-23 and reuse is a separate D-24 scope                        |

## Stop conditions

Stop for: any implementation before the charter is recorded; any external effect; exceeding the 5-B
budget; a release verdict written by the implementer; a criterion satisfied without its named
evidence class; any attempt to treat a passing suite or a screenshot diff as owner acceptance; or any
production reuse of fixture code.

## Approval gate

This plan authorizes nothing. It requires Decisions 5-A through 5-D, an owner-approved charter, and
an explicit authorization of Phase 5 behaviour amending `AGENTS.md`. Task 10 remains owner-run.
