# Checklist: canonical open-question record

Status: **Tasks 1-5 complete and owner-accepted. Task 5 delivered 2026-09-08 and required a
contract change beyond its authorized scope (see below). The kickoff-unification decision
remains open.**
Specification: `docs/proposals/2026-08-18-open-question-record.md`
Plan: `tasks/open-question-plan.md`

- [x] Owner approved the specification on 2026-08-18.
- [x] Owner settled the authority question on 2026-08-18: **interstitial**, Phase 4 paused,
      Task 14 resumes after Tasks 1-4.
- [x] Owner approved this plan and checklist for Tasks 1-4 only on 2026-08-18.

- [x] Task 1: Contract and validation. **GREEN, verified on Windows.**
  - Acceptance: pinned schema version; closed enums; `wouldBeResolvedBy` required non-empty;
    explicit `blocksWork`; `superseded` requires a successor id; `deferred` requires `reviewBy`;
    secret rejection on every free-text field.
  - Verify: intentional RED, then focused contract test GREEN.
  - Result: RED on absent module, then 9 contract tests passing; Prettier, ESLint, and tsc
    clean. Evidence: `docs/evidence/open-question/red-green-log.md`.

- [x] Task 2: Domain aggregate and disposition rules. **GREEN, verified on Windows.**
  - Acceptance: silence never resolves; all dispositions retained; no overwrite; manager-only
    `accepted_risk`/`rejected`; any participant may answer; reopening is a new superseding record.
  - Verify: intentional RED, then focused unit test GREEN.
  - Result: RED on absent module, then 10 unit tests passing; full container unit+contract
    regression 42 files / 175 tests; Prettier, ESLint, and tsc clean.

- [x] Task 3: Persistence. **GREEN, verified on Windows by the owner.**
  - Acceptance: immutable attributable records; restart recovery; conflict rejection; project
    isolation; disposition order preserved; additive migration 004.
  - Verify: intentional RED, then integration test GREEN.
  - Result: RED on absent module, then integration project at 45 passed / 1 skipped, up from
    40 / 1. Preceded by the D4-P-004 corrective commit that returned main to green.

- [x] Task 4: Commands and reciprocal read model. **GREEN, verified on Windows in full verify.**
  - Acceptance: exact revisioned receipts; authority enforced at the command boundary; manager
    and agent projections identical on identity, subject, confidence, evidence, disposition;
    agent can answer the three discovery questions without inferring from failure; no secrets,
    hidden reasoning, or paths cross the boundary.
  - Verify: intentional RED, then unit and reciprocal contract tests GREEN.
  - Result: RED on two absent modules, then 32 open-question tests passing; container full
    unit+contract regression 44 files / 188 tests; tsc, ESLint, Prettier clean.

- [x] Checkpoint: full `npm.cmd run verify` PASS on Windows; every Phase 4 suite green; all four
      committed layout-trial PNGs verified byte-identical to HEAD after the visual run.

- [x] Owner gate: **accepted 2026-08-18, no changes requested.**

## Separately gated

The approval above does not authorize the following.

- [x] Owner authorized Task 5 on 2026-09-08 after reviewing the Tasks 1-4 evidence.

- [x] Task 5: Attention integration. **Complete 2026-09-08.**
  - Acceptance as authorized: `question_open` at priority 35; `blocksWork` escalation;
    `neededBy` surfacing; Task 10 rail and Checkpoint C evidence re-verified or re-captured with
    recorded owner disposition.
  - **Scope actually required, larger than authorized:** the acceptance could not be met without
    adding `raisedAt` to the `OpenQuestion` contract. `ManagerAttentionItem` requires `updatedAt`
    and no timestamp existed on a question, so there was no truthful value to project. The owner
    chose the contract change over the alternatives on 2026-09-08. This amended line records what
    the task became; the original acceptance did not anticipate it.
  - Verified: attention projector unit tests 5/5, contract 12/12, full `npm run verify` green on
    Windows. Task 10 rail evidence **re-verified, not re-captured** — visual 22/22 with no
    committed capture changed, so no owner disposition on a changed capture was required.
  - Reason stays `question_open` when escalated. Owner-agreed 2026-09-08: raising the priority
    but not renaming the reason avoids asserting a work state canonical state does not hold,
    which is the substitution the whole record type exists to remove.

- [ ] Owner decides specification §4 kickoff unification: leave alone, emit additionally, or
      reference. Recommendation is emit additionally, deferred until the base record is proven.

- [ ] Office representation and spatial anchor: unauthorized, pending a D-02 composition decision.
