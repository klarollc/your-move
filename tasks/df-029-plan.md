# Implementation plan: DF-029, blocked but not on you

Status: **OWNER-APPROVED 2026-09-28, D-1 to D-3 as recommended.** Written under the approved amendment
`docs/proposals/2026-09-28-df-029-blocked-not-on-you.md` (B-1 to B-5 as recommended). **Not
authorized to start before Phase 7-O is accepted** (Task 12): it changes what the office shows.
Checklist: `tasks/df-029-todo.md`, approved separately.

## Outcome

An agent can record a blocker that someone other than the manager can clear. The office shows it
as blocked, in neutral colour, with who can resolve it; it is not in the rail and not in the bar
count. A blocker that does ask the manager to act keeps today's treatment. Every recorded log, and
the default office, reads exactly as before.

## Where the change lands

| Layer       | File                                                                                     | Change                                                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contract    | `packages/contracts/src/work-payloads.ts`                                                | `payloadVersion: 3`: `requestedAction` optional; `waitingOn: manager` without a request refused. Versions 1 and 2 unchanged.                                                                                                                     |
| Domain      | `packages/domain/src/work-truth.ts`                                                      | Retains a version-3 condition (the truth type's `requestedAction` becomes optional).                                                                                                                                                             |
| Domain      | `packages/domain/src/attention.ts`                                                       | `blocked`, `failed` and `waiting_input` raise attention only when the condition carries a request, or when no condition is recorded (versions 1 and 2, unchanged).                                                                               |
| Application | `packages/application/src/office-read-model.ts`                                          | Each held item's condition gains a derived `resolver`: an agent id through staffing to its role name; an evidence id to kind and version; `external` as "an external dependency"; anything unresolved as not recorded (B-2).                     |
| Web         | `apps/web/src/office-model.ts`                                                           | Inspector "What needs you" reads "Nothing needs you. {resolver} can resolve it." when a blocker has no request; `requestedActionText` and `whyText` handle the absent request. Labels and the bar need no change: both already follow attention. |
| Fixtures    | `apps/web/src/office-fixtures/index.ts`                                                  | New named log `blocked-elsewhere` (B-4): the Test Engineer blocked, waiting on the Implementation Engineer, no request. The default log does not change.                                                                                         |
| Tests       | contract, domain unit, application contract, web component, e2e, the Task 9 capture spec | Test first for each; one new capture journey.                                                                                                                                                                                                    |
| Spec        | `docs/phase-7-o-operability-spec-v0.2.md`                                                | A dated successor section for §3.2, §6, §7 (a ninth adversarial class) and §8.4 (B-4 of the amendment).                                                                                                                                          |

## Decisions this plan needs

- **D-1, version 3 on `failed` and `waiting_input` too.** The amendment names blockers. The same
  optional request applies naturally to `failed` (a failure someone else is fixing) and
  `waiting_input` (input from another agent). **Recommendation: apply to all three
  attention-raising work states**, so the rule is "attention follows a request" everywhere.
  `review_requested` is always a request to the manager and keeps a required request.
- **D-2, the Phase 6 reduction proof.** `stripPhase7OAdditions` (P-1) strips the Phase 7-O
  additions for the frozen digest. An optional field left absent adds nothing to existing logs, so
  **the proof should hold unchanged**; the plan verifies it rather than assuming it, and work stops
  for a ruling if it moves.
- **D-3, the comprehension key.** The default office does not change, so
  `tests/e2e/phase-7o-comprehension-key.spec.ts` must stay green untouched. If it moves, work stops:
  it would mean the default office changed.

## Risks

- A blocker with no request is invisible to the manager unless they look. That is the intended
  trade (rule 4), and the scene label still says "Blocked". The inspector names the resolver.
- The Codex normalizer and role briefs do not emit version 3 yet (B-5). Until they do, only
  fixtures exercise it; the plan does not claim agents use it.
