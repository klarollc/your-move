# Handoff — state, next action, and what would otherwise be relearned expensively

Written 2026-09-18, last updated 2026-09-28 for Phase 7-O Tasks 9f–10. Read `AGENTS.md` first for authority; this document is the
live state, the next action, and the things a fresh session pays for twice if nobody wrote them down.

---

## Approved visual supplement — 2026-09-27

The owner approved the completed A/B art reference pack (AR-01–AR-04 and its constitution) as a
visual supplement to Active `reconciliation-b-clarity`. Read
[the approval record](art-reference-approval-2026-09-27.md) before UI work. The pack remains local
under the owner-directed `/output/` Git exclusion; missing or changed artifacts block affected
visual work. Office-first hierarchy, progressive disclosure and the illustrated anti-dashboard
rules now govern future visual proposals and reviews. No implementation or baseline promotion
is authorized by this approval. Existing phase gates remain.

## Where the project is

**Read `position.json` at the repository root.** Since 2026-09-28 it is the one record of where
every workstream stands, what is authorized, what is frozen (the Phase 7-O cold-run interval is a
freeze there, enforced by a test), what waits on the owner, and the dates that matter.
`scripts/position-record.test.mjs`, inside `verify`, fails if it disagrees with a checklist, cites a
commit that does not exist, is older than a checklist it summarizes, or if a frozen path changes.
This document keeps the narrative: why things are the way they are, and what is expensive to
relearn.

Phase 5 turn ledger: **19 of 60** including the verdictless pass 9 attempt. Acceptance criteria: **21 ready, 0 blocked** — all ten charter
gaps are closed. Ready means assessable. It does not mean met.

**Current owner ruling, 2026-09-18 (the later of two that day):** C-17 is **out of scope, not met**.
The human screen-reader walkthrough is retired for this single-user tool. The same-day met
disposition, the earlier waiver and the pass-5 verdict remain historical. The walkthrough's SR-01
finding and the need for an independent release-review refresh remain current.

---

## The immediate next action

**Phase 7-O, 2026-09-28.** Tasks 1–10 are done; `tasks/phase-7-o-todo.md` is the record. The last
`verify` on a clean tree passed at `f1ca1be`: unit 586, component 139, integration 79 with 3
skipped, contract 78, e2e 88, a11y 46, visual 64.

- **Phase 7-O accepted by owner waiver, 2026-10-02.** The cold run (Task 11, build `3d47326`)
  scored **1 of 6, not met**; the owner accepted under the MDD §19 waiver clause. Never cite §20
  comprehension as passed. Sheet, findings F-11-1 and F-11-2, and the reconstructed-marks
  deviation: `docs/evidence/phase-7-o/comprehension/run-2026-10-02.md`. The interface freeze has
  ended with Task 11.
- **The key is spent for this interface.** The owner authorized the agent to read it for scoring.
  A future cold run needs a new key and a new interval.
- **The key is guarded two ways inside `verify`:** the e2e spec asserts every fact the key quotes
  at its task URL, and `scripts/comprehension-preamble.test.mjs` asserts the preamble's SHA-256.
  If either fails, the interface or the key moved; both need a ruling, and a key change restarts
  the interval.
- **Rendering is Phase 7.** The owner compared the 9f captures with AR-01–AR-04 on 2026-09-28
  ("nowhere near"; "mainly rendering") and deferred the rendering gap to Phase 7 under P-0. The
  captures do not meet the plates and must not be cited as if they did.
- **DF-029, open, owner ruling 2026-09-28:** a blocked agent cannot say it is not blocked on the
  manager (every blocked item is manager attention; every v2 condition requires a requested
  action). AR-03's "blocked, not on you" is not expressible. Fixed by its own amendment after
  Phase 7-O: contract, domain attention rule, spec §6 and §8.4, the P-4 bar count, fixtures.
- 9g (plain rail controls, evidence heading) and 9h (disposition refused only where no decision
  can be recorded) were found and fixed after the plate review and during Task 10 preparation.
- **Housekeeping, 2026-09-28:** item 1 (the test relay) is closed by the command runner (DF-022);
  item 2 is recorded in the Phase 4 log; 3a (`3494b6d`, DF-030) and 3b/F6 (`e0fc3a7`) are fixed;
  item 4 (the register's promotion path and status index, guarded by
  `scripts/dogfood-index.test.mjs`) is in place; 3f is ruled (kickoff emits open questions,
  option 2, after Phase 7-O); item 5 is done (`e5df37f`). 3c (F4) is fixed (`283e11d`): a
  provider error's phase says whether Codex will retry it. 3d (F3) is closed with no code
  change (optional provider identifiers, never synthesized). 3e (DF-006 prevention) stays declined.
  The housekeeping queue is otherwise empty.
- **Approved 2026-09-28, not authorized for implementation until Phase 7-O is accepted:** the DF-029
  amendment (`docs/proposals/2026-09-28-df-029-blocked-not-on-you.md`, B-1 to B-5) and the Phase 7
  specification (`docs/phase-7-high-fidelity-spec-v0.1.md`, F-1 to F-8; F-5 decided: Fira Sans + Fira
  Mono, SIL OFL 1.1, Windows rendering check still to do). Order: DF-029, the Phase 5 fixture removal, then the Phase 7 plan.
  `codex-currency` is merged (`41c4625`); the D-24 disposition is on this line now. Local `main`
  still points at `5b436cc`: fast-forward it before pushing.

**Phase 5 was accepted by the owner on 2026-09-25**
(`docs/evidence/phase-5/decision-record-2026-09-25-task-10-owner-acceptance.md`). The D-24
production-suitability review is recorded by hand in
`docs/evidence/phase-5/d24-production-suitability-review.json`: **due 2026-10-09, escalation
2026-10-02**, owner as Delivery Lead and reviewer. Nothing in the code enforces it.
**Disposition recorded 2026-09-27 on branch `codex-currency` (`c3752cb`), merged 2026-09-28 (`41c4625`):**
`reuse_concepts_only`, and the fixture's presence in production packages ruled an unruled
deviation. Its removal (one re-export in `packages/domain`, two routes in `apps/web/src/main.tsx`,
four Phase 5 browser suites) is unauthorized follow-on work under its own specification, and it
touches `apps/web/src/`, so it waits until after the Phase 7-O cold run. Closing the Phase 5
fixture initiative is a separate owner act.

**Current Phase 5 refresh attempt:** pass 9 (2026-09-22) spent one turn and stopped at
`NOTIFICATION_TIMEOUT` without a verdict. It is recorded in the provenance ledger (2026-09-25) and
supersedes only passes 6 to 8. Pass 5 remains the latest complete release verdict;
do not treat pass 9 as acceptance or rewrite earlier attempts.

**Task 10 is done: the owner accepted on 2026-09-25**, on the pass-5 verdict below, knowing no
independent verdict exists under the current scope.

The current verdict is release review **pass 5, 2026-09-14: `NEEDS WORK`, 20 of 21 satisfied**, zero
overclaims, citing sixteen artifact versions by content address.

Pass 5's statement that C-17 was the only outstanding criterion was historical: it was waived at the
time, and the reviewer correctly refused to count that waiver as satisfaction. C-17 is now out of
scope by owner ruling, which removes the obligation without satisfying it. It does not change the
historical pass-5 verdict or make the project eligible for owner approval.

C-09 and C-11 were closed by owner ruling on 2026-09-14 and pass 5 confirms both:

- **C-09 — closed.** All twenty contract states are measured three times each, at both viewports,
  and the reduced-motion and 200% zoom readings must equal the baseline.
  `tests/accessibility/phase-5-decision-notice-state-matrix.spec.ts`.
- **C-11 — closed.** `npm run phase5:sideeffects` walks the import graph from three declared entry
  points and reads all 36 reachable first-party modules, whether or not a journey executed them.
  Zero findings in all five categories. It is the static half and does not replace the behavioral
  isolation records.
- **C-17 — out of scope, not met, owner ruling 2026-09-18.** Excluded by the overlay in
  `docs/evidence/phase-5/acceptance-contract-scope.json`. Earlier the same day the owner had marked it
  met (`c-17-owner-acceptance.json`); the scope ruling came later and outranks it, and
  `formatC17Status` in `scripts/phase5-release-brief.ts` enforces that ordering. No brief or verdict
  may count C-17 as satisfied.

**Nothing technical is authorized or outstanding for C-17.** An independent release-review refresh
was attempted in passes 6–8, but each stopped on the first turn before producing a verdict. Pass 8
records the concrete runtime failure as `stream disconnected before completion` while calling the
ChatGPT Codex backend. The attempts are preserved and provenance is clean; no eligibility claim is
made here. Pass 9 then timed out, and on 2026-09-25 the pinned Codex binary was found updated to
0.156.1, so any further run now refuses at binding (DF-021). The owner chose not to re-pin, then
later the same day reversed that and ruled to keep CuckCode current with Codex: see **Codex runtime**
under Operational specifics.

**The ledger disagreed about this until 2026-09-19, and the ledger was wrong.** Because passes 6, 7
and 8 are named `pass-<N>.json`, the supersession derivation retired everything below them, so
`provenance.jsonl` recorded pass 5 as superseded by pass 8 — a failed connection standing as the
current release review, and every honest citation of the real verdict reading as a stale one under
P-3. Ruled and closed the same day:
`docs/evidence/phase-5/decision-record-2026-09-19-supersession-retraction.md`. Supersession now
applies **within a class** — a pass retires an earlier pass only when both carry the product their
review exists to produce, or neither does — and the fifteen wrong edges are withdrawn by a new
`unsupersede` op under P-6 rather than edited out. Recorded as DF-020. **Pass 5 is current again and
passes 6 to 8 supersede only each other.** Nothing about the verdict changed; what changed is that
the ledger can say which artifact is current. `npm run phase5:provenance` reports the live state.

**Ruled and closed 2026-09-14**, `docs/evidence/decision-record-2026-09-14-scripts-typecheck.md`.
`scripts/` was not in the tsconfig project graph and had never been typechecked;
`npm run typecheck:scripts` made it visible and reported two pre-existing errors in completed
phases. Both are fixed under owner rulings S-A to S-D, and `typecheck:scripts` now runs inside
`verify`, immediately after `typecheck`.

- **The shipped one.** `run-phase4-kickoff.ts` wrote `roleId: report.roleId`; `RuntimeBindingReport`
  is strict and has no `roleId`, so the key was dropped and **both committed Task 17 run artifacts
  record bindings that do not say which role they were for.** The script now takes the role from the
  preflight candidate — the record that joins a runtime session to a role contract — and refuses
  with `BINDING_ROLE_UNRESOLVED` rather than recording an unattributed binding. The fix changes what
  a *future* Phase 4 live run records; no such run is authorized and no evidence was rewritten. The
  two artifacts carry a correction beside them, never in them:
  `phase-4/live-kickoff/task-17-run/correction-2026-09-14-binding-roleid.json`, which recovers the
  six-row `agentId` → `roleId` mapping from each file's own transcript **and states that the join is
  inferred from `agentId` rather than recorded in the binding row.**
- **The type-only one.** `build-phase6-golden-states.ts` passed `work: undefined` into an optional
  property. Fixed by omitting the key; proven a no-op first — five golden states, both viewports,
  ten captures compared in memory, zero differing digests, nothing written.

**`run-phase4-kickoff.ts` has no test and cannot get one as written.** It is a top-level
side-effecting module and the run-record projection is inline in it, so the defect was reachable only
by reading the file or by typechecking it. Nothing in this pass is TDD evidence; the new `verify`
stage is the guard. Extracting the projection into a pure function is unruled work.

Nothing else is authorized. The ten items the reviewer says would change its verdict are ordinary
work nobody has ruled on, except these three, which cannot be closed by an agent at all:

- **C-17 is out of scope, not met — owner ruling 2026-09-18.** The ruling
  (`docs/evidence/phase-5/decision-record-2026-09-18-screen-reader-scope.md`, overlay
  `docs/evidence/phase-5/acceptance-contract-scope.json`) outranks both the 2026-09-14 waiver and the
  earlier same-day met disposition (`docs/evidence/phase-5/c-17-owner-acceptance.json`), which remain
  as history. Screen-reader behaviour has never been verified. SR-01 stays open in the record.
- **C-18 is unblocked, 2026-09-14.** Gap 3 closed: the owner ruled a sidecar append-only ledger and
  the schema is `docs/evidence/phase-5/provenance/schema.json`. Whether the ledger's forty-three
  `unknown` producers satisfy "every evidence artifact" is a release-review judgement, not settled.
- **C-19 is closed, 2026-09-14.** The owner looked at the forty plates on the contact sheet and
  accepted fidelity for the whole inventory, no exceptions:
  `docs/evidence/phase-5/c-19-owner-acceptance.json`. The human-visual-acceptance half of the
  criterion exists for the first time. Per-state marks live in the viewer's browser and were not
  supplied, so none are claimed. Whether C-19 is *satisfied* against the whole of its assertion is
  still a release-review judgement.

**Read DF-015 before writing any brief.** Four briefs in this phase described a world that did not
exist, cost three agent turns, and nearly cost the release verdict: the first release pass reported
four of twenty-one satisfied and the third reported eleven, on an unchanged implementation. Every
false claim was hardcoded prose that was true the day it was written. No brief states what evidence
exists any more — `scripts/phase5-evidence-inventory.ts` reads the tree and reports it.

## Open debts, none of them closed

- **MDD §20 remains unmet at the project level.** Phase 7-O Task 11 performed all six tasks on
  2026-10-02 and scored 1 of 6; the owner waived the criterion to accept Phase 7-O. **Phase 8
  inherits an unmet §20.**
- **MDD §19's walkthrough obligation was retired 2026-09-18**, owner ruling, screen readers out of
  scope for a single-user tool. **Phase 8 no longer inherits it.** C-17 is excluded by overlay, not
  satisfied: screen-reader behaviour has never been verified and no brief may claim otherwise. The
  walkthrough's V0/V1 findings were separately addressed — SR-03 and SR-04 by the 2026-09-18
  tab-order fix, SR-02 and SR-05 reclassified, SR-01 still unresolved. Automated accessibility
  tests, keyboard operability and accessible naming stay in scope.
  What survives from the earlier gate: governance did not close it by itself, three review passes
  refused to certify against it, and the independent refresh is still blocked on a working runtime
  connection rather than treated as a verdict.
- **Gap 3 closed 2026-09-14** with the sidecar ledger. `npm run phase5:provenance` runs inside
  `npm run verify`: 282 artifacts recorded with digest and producer, six supersession edges, and the
  enforcement that matters — no current artifact may cite a superseded one outside a declared
  historical field. Corrections are appends, so an earlier claim stays in the history.
  **Forty-four artifacts carry `producerKind: unknown`**, almost all pre-Phase-5: no code in the
  tree writes them and no record says who did. Stated, not guessed. This read forty-three of 282
  here until 2026-09-14; it was already forty-four of 292 at `2b5f212`, before that day's two new
  artifacts, both of which are attributed. `npm run phase5:provenance` reports the live numbers.
  One of the forty-four, `phase-5/side-effect-review.json`, has **five recorded digests at an
  identical 4498 bytes** and no producer rule, so every run of its producer re-records it. Unruled.
  The ledger gained a retraction op on 2026-09-19 (P-6, DF-020). It is the one op that can change
  what the ledger says is current, so two things bound it: a test asserts a retraction alters no
  record entry, and the builder **refuses** rather than skips a derived edge that is currently
  retracted, so no later build can quietly undo a ruling. **Unruled and worth knowing:**
  `authorizedBy` is required to be a non-empty string and is not resolved against the tree, so a
  retraction citing a decision record that does not exist would be accepted.
- **Three Phase 6 provenance gaps** carry forward: no external visual reference informed any
  candidate; the generated half of the approved hybrid medium was never produced; four of six named
  typefaces cannot be embedded, with Phase 7 embedding as the named trigger.
- **Phase 5 will not prove agents can write code.** Decision 5-A is hybrid — agents own design,
  review and verdict; implementation is conventional. That is a recorded departure from the literal
  MDD §24 run and the Phase 5 packet must say so.
- **One live round is one sample.** Thirteen turns on one day say the roles are distinct and the
  round completes. They say nothing about stability across runs.

---

## Rules that are easy to violate

- **Never implement without a recorded owner ruling.** Specification → plan → tasks →
  implementation, with explicit approval at each boundary.
- **Promotion is owner-run, always.** Build the request and the command; never execute it. Both role
  promotion and the Phase 6 visual promotion are gated behind `CUCKCODE_OWNER_PROMOTION=1` and the
  owner runs them.
- **"Noted" is not approval.** MDD D-25: silence is not agreement. When the owner acknowledges
  rather than approves, record it as acknowledged and ask again. He answers directly when asked.
- **Do not accept delegation on an item where your own recommendation was that he decide.**
- **Amend every boundary document in the same pass as the ruling.** `AGENTS.md`, `README.md`, the
  MDD, and the relevant checklist. Leaving one stale is the repeated defect below.
- **RED evidence is a recorded observation, not a live report.** Never re-run a RED capture after
  GREEN.

---

## The recurring defect, and its variants

**A guard is exact inside a boundary nobody examined.** Recorded as DF-010, DF-011, DF-012 and found
at least eight more times in Phase 6 alone. Its variants, each of which cost real time:

- A guard that passes on material that cannot work (DF-010, DF-011).
- A guard that refuses material that works — `roles:promotion:status` joined the superseded import
  and reported an empty promoted set while six roles were promoted (DF-012). **A gate reporting
  closed while open.**
- A guard that is only as current as its call site. Ask, on every decision that supersedes something:
  *what still reads the thing we just superseded?*
- A guard written inside the same boundary as the thing it protects. Twelve passing tests over
  `promotedRoleIds` all built their own manifest fixture, so none could see which manifest the CLI
  actually passed.
- A guard that greps prose. It passes on whatever phrasing it is handed; use a structured field.
- **A mutation that fails to apply is indistinguishable from a guard that does not work.** Verify the
  mutation landed before believing a survivor. This happened once with a prettier-wrapped string.

**And the one that cost the most (DF-015):** four briefs described a world that did not exist. A
brief is a promoted role's entire world, it was treated as framing rather than as evidence, and the
answer's accuracy is bounded by it. **Never hardcode a claim about what evidence exists.**

**And the variant that nearly got filed as a flake (DF-014):** the capture runner passed `--grep
"@visual Phase 5"` through `execFile` with `shell: true`, so the shell split it and Playwright
received `@visual` as the pattern with `Phase` and `5` as positional file filters. It appeared to
work because those strings match the phase-5 filenames. It surfaced as **one unreproducible
failure**, and "I could not reproduce it" means "I do not know what happened" — filing it as a flake
would have left every artifact the harness produced counted as evidence of a command nobody ran.
**No evidence-producing script should invoke a tool through a shell.**

**And the variant Task 7 produced twice in two days:** a brief that hands a role a false premise and
then files the answer as evidence. The verification brief said there were no component tests after
Task 5 shipped them. The Visual QA brief never mentioned the accessibility and isolation suites, so
the reviewer correctly reported that no such checks were shown to it and recommended work already
done. **A brief is an evidence artifact and its accuracy is a precondition of the answer's.**

**And the variant that had been running the longest (DF-013):** `npm run verify` — the eighteen-stage
gate that claims the whole project passes — had never completed since Phase 1. Playwright's default
`testMatch` collected a Vitest file out of `tests/` and died at collection, so no e2e, accessibility
or visual test ran under it. Every session reported suite health from the individual stages instead,
and every one of those numbers was true and none of them was the gate. Fixed by naming `testMatch`.
**Report suite health from `verify`, and name the command beside any count.**

**And the newest variant, from Task 5:** every guard in this repository checks that a claim matches
reality *now*. None notices when a historical record is replaced by a current one. Re-running the RED
capture after GREEN silently overwrote "seventeen failed" with "seventeen passed" — true at the time
of writing and completely beside the point. The capture now refuses to overwrite. The general gap in
the evidence model is not fixed.

---

## Defects that cost a live run, or nearly did

- `createControlledCodexHome` gave the session an empty `CODEX_HOME`, which replaces the credential
  Codex reads along with the instruction sources it was meant to replace. Six role exercises failed
  `AUTH_REQUIRED` while the owner was authenticated the whole time.
- `waitForNotification` returned the first cached notification and never consumed it. A thirteen-turn
  round would have replayed turn one twelve times **and reported success**. Fixed by
  `waitForTurnCompleted`, which matches on turn id.
- The kickoff domain hardcoded `"delivery"` as the synthesis author while the promoted roles are
  `delivery-lead`. The live round would have died at turn 7 of 13 after spending six turns and the
  whole allowance. **Caught by the rehearsal, not by the run.**
- A JSON array was sliced from its first brace and its first element adopted as a role's whole
  position — quiet coercion of an answer never given.
- Attempt 1 of the live kickoff *did* fail at turn 7, on a prompt that said "Include every
  contributionId" immediately before asking for a register keyed by role id. That one cost a run.

**The lesson that generalises:** rehearse against a fake runtime before spending a bounded allowance.
`packages/application/src/kickoff-rehearsal.integration.test.ts` is the pattern.

---

## Operational specifics

**Agent command runner (2026-09-25).** When the owner has `npm run agent:runner` open, an agent
requests a check by writing `{ "id": "<8-64 chars, a-z0-9->", "command": "<allowlisted>" }` to
`node_modules/.cache/agent-runner/inbox/<id>.json` and reads `outbox/<id>.json` and
`logs/<id>.log`. The result carries `head`, `dirty` and `evidenceChanged`; a dirty-tree run is
never the gate for a commit. Live runs, promotions and evidence writes cannot be allow-listed
(`scripts/agent-runner.test.mjs` enforces it) and the child never sees a `CUCKCODE_*` variable.
`git-push` works only when the owner started the runner with `-- --allow-push`. Six read-only
checks joined the allowlist on 2026-09-26 (`check:toolchain`, `test:toolchain`, `test:protocol`,
`protocol:codex:check`, `protocol:codex:drift`, `test:runtime`); they are for targeted checks only, a
commit's gate is still a full `verify` on a clean tree, and the runner must be restarted to see an
allowlist change.

**Codex runtime (2026-09-26, branch `codex-currency`).** Codex is the npm dependency `@openai/codex`
at one exact version in `packages/runtime-codex/package.json`, resolved from `node_modules` by
`resolveInstalledCodexExecutable()`; the desktop app's copy is never spawned. `npm run
protocol:codex:drift` asks the installed binary for its version and schema, with no provider call,
and every live script refuses without it. To move the pin: `npm.cmd install --no-save
@openai/codex@<v>`, `npm run protocol:codex:upgrade -- <v>`, rule on the generated
`protocol/<v>/surface-diff.md`, then change the declaration and reinstall. Every turn goes through
`runTurn` (180 s idle, 900 s cap, interrupt on either, one transport retry from a run budget of two),
every run record carries `runtime` attempts with Codex's own failure class, and every live session
leaves a log under `docs/evidence/runtime/sessions/`. Why passes 6–9 failed stays unknown (DF-025).

Everything runs from `C:\Users\nater\CuckCode`. The owner uses **PowerShell**, so `&&` is a parse
error and there is no inline env-var prefix — write `$env:X='1'; cmd` and clear it afterwards.

| Command | Purpose |
| --- | --- |
| `npm run kickoff:preflight` | Task 17 preconditions, no provider calls |
| `npm run phase5:contract:build` | Rebuild the acceptance contract and traceability matrix |
| `npm run verify` | The whole gate. At `f1ca1be`: unit 586, component 139, integration 79 (+3 skipped), contract 78, e2e 88, a11y 46, visual 64 |
| `npm run phase5:capture` | Recapture the 40 browser cells and rebuild the manifest |
| `npm run phase5:fidelity` | Contract names, as amended by the overlay, against the captured trees |
| `npm run phase5:visualqa:run` | Visual QA Reviewer annotation (live, debits the ledger) |
| `npm run phase5:knowledge` | Rebuild the shared-knowledge scenario from the two passes |
| `npm run test:knowledge` | The Phase 5 shared-knowledge gate condition (also in `verify`) |
| `npm run phase5:release:run` | Release Reviewer verdict (live, debits the ledger) |
| `npm run phase5:verify:run` | Test Engineer verification pass (live, debits the ledger) |
| `npm run phase5:surface:run` | Product Designer surface contract (live, debits the ledger) |
| `npm run roles:promotion:status` | Which roles are promoted, derived from `roles/authored` |
| `npm run phase6:*` | Rebuild any Phase 6 artifact |

Live runs need an explicit opt-in env var — `CUCKCODE_LIVE_PHASE5`, `CUCKCODE_LIVE_KICKOFF`,
`CUCKCODE_LIVE_ROLE_EXERCISE` — and every one of them debits `docs/evidence/phase-5/turn-ledger.json`
where applicable. **A budget nobody debits is discovered rather than set.**

Git: work happens on `hermes/phase-4-task-15-evidence`; fast-forward `main` at the **end** of a
session, not the start, or it silently falls behind. Remote is `klarollc/CuckCode`, private, over
HTTPS — SSH has no key registered and `ssh -T git@github.com` fails.

Each verification pass writes its own file — `verification.json` is pass 1, then `pass-N.json`. The
runner used to overwrite one path, which would have replaced the Task 6 assessment with a later one
and erased the record that the component was ever unverified. The brief and the overclaim
cross-check both read the live test inventory through `scripts/phase5-test-inventory.ts` rather than
from `red-evidence.json`, which stopped being the inventory the moment a test was added.

Browser captures route through `tests/support/evidence-output.ts` and nothing else. It writes into
`docs/evidence` only when `CUCKCODE_REGENERATE_EVIDENCE=1`, and `scripts/evidence-immutability.test.mjs`
fails any spec that names the evidence tree directly — committed evidence was silently rewritten by
an ordinary test run twice before (D4-P-001, D4-P-003). Do not add a second capture path; that guard
caught one being added during Task 7.

Playwright and Vitest share `tests/`. `.spec.ts` is Playwright, `.test.ts` is Vitest, and
`playwright.config.ts` now enforces it. Port 4173 is the preview server; a leftover one from an
earlier session will fail `test:e2e` with "already used".

Owner rulings that amend an authored artifact are recorded as an **overlay**, never edited into it —
`surface-contract/amendments.json` carries decision 7-B's two name changes with their reasons, and
the fidelity check refuses to apply an amendment whose stated base no longer matches what the
authored contract says. The Product Designer's artifact records what that role produced on the day it
produced it.

Golden-state capture digests cover the **rendered SVG string**, not the file, which gains an XML
declaration and `xmlns` on write. Hashing a capture directly will not match; a guard reverses the
transform and asserts it does.

---

## What is genuinely proven, stated plainly

Six promoted roles bind, brief identically, run concurrently under packet limits with containment
intact, and behave as **distinct agents** in live use — four proposed, the two reviewer roles
critiqued, unprompted. A complete D-25 round fits in thirteen turns. The domain refuses a malformed
synthesis rather than accepting it. A stopped run is preserved as evidence.

The Test Engineer's Task 6 pass returned **two full, thirteen partial, six none** out of twenty-one,
with **zero overclaims** when cross-checked against what exists. It found gaps in our work, not only
in the missing component. That is the most valuable agent output of the phase, and it is bad news
delivered accurately — which is the behaviour the whole project is an argument for.
