# Handoff — state, next action, and what would otherwise be relearned expensively

Written 2026-09-18, last updated 2026-10-18 for the owner-approved Your Move R1 workstream. Read `AGENTS.md` first for authority; this document is the
live state, the next action, and the things a fresh session pays for twice if nobody wrote them down.

---

## Current owner-authorized workstream — Your Move R1

On 2026-10-18 the owner approved R1 only: hosted Railway foundation and OpenAI/Anthropic provider connections. The source plan and narrow amendment are `docs/your-move-redesign-build-plan-2026-10-18.md`; the authorization is recorded in `docs/evidence/your-move-r1-authorization-2026-10-18.md`; the checklist is `tasks/your-move-r1-todo.md`. Work on `feature/your-move-r1-hosted-providers` in its dedicated worktree. Do not switch to or modify `main`.

Scope exclusions: no Hermes provider, multi-user support, billing, local-loopback changes, canonical event-log changes, lamp/T3/T4 changes, or R2–R5. Success-path tests must mock at the provider HTTP boundary; use invalid dummy keys for rejection tests; no real provider credentials. Build deploy-ready Docker/Railway configuration and document required settings, but do not connect the Railway project, set variables, push, or deploy. The Railway project reference is in the authorization record.

**Next action:** complete the R1 checklist, starting with the hosted-only server boundary and provider vault; preserve the existing loopback and event-log paths. Run the R1-focused checks and applicable regression suite before reporting completion.

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

## Historical Phase 7 handoff — snapshot as of 2026-10-03

The detailed Phase 7 status below is preserved as a historical handoff. The current assignment is the owner-approved R1 workstream above; its scope and next action supersede the older Phase 7 “Do next” note without changing Phase 7's recorded results.

**Phase 7, the rendered office — in progress in the 2026-10-03 snapshot.** Spec
`docs/phase-7-high-fidelity-spec-v0.1.md` (F-1 to F-8), plan `tasks/phase-7-plan.md` (Q-1 to Q-5),
checklist `tasks/phase-7-todo.md` (the full record of every task: RED, GREEN, mutations, moved
assertions, owner rulings). `position.json` carries each task's state and gate. Latest `verify` on a
clean tree: **`a582953`, runner `p7t5b-verify-20261003-01`: unit 646, component 154, integration
90 (+3 skipped), contract 85, e2e 92, a11y 42, visual 68.** Exit 0, `dirty: false`,
`evidenceChanged: false`.

**Task 5b ruling and current state, 2026-10-03.** The owner approved
`tasks/phase-7-art-gap-plan-draft.md` as written, for Task 5b only: wall-only −8%/−4% face shades,
mid-grey front cut tops, fixed soft daylight, and a new `architecture-b` capture slice. Labels stay
deferred to Task 8; furniture shading and the Active palette stay unchanged. The renderer and RED
assertions are committed at `a582953`. Focused architecture plus frozen-frame tests pass (17/17).
Formatting, lint, typechecks, unit (646), component (154), integration (90; 3 skipped), contract
(85), provenance, side-effect, knowledge, and production build checks passed. The 92 e2e and 42
a11y cases all reported passing, but both Playwright processes hung after their last case and were
interrupted; there is no clean browser-command exit or complete `verify` gate. The owner has now
captured both approved viewports under `docs/evidence/phase-7/architecture-b/`; both hashes match
provenance entries 631–632, and the read-only provenance check is clean. The owner's exact AR-01
review is: "slice meets expectations". A subsequent clean owner-run `verify` passed on `a582953`
(runner `p7t5b-verify-20261003-01`), closing the gate described below.

**Historical next action at that time:** finish the Task 6 owner gate in `tasks/phase-7-task-6-todo-draft.md` §6.8. The Luna
implementation is ready for review under the three owner-approved corrections recorded there.
Focused tests pass 37/37; final default/inspector clearance checks pass at both approved viewports.
The standalone furniture browser command hung in teardown after reaching all 12 cases. The
visible runner subsequently completed full `verify` with exit 0 (`p7t6-verify-20261003-01` on
`dc2f404`: unit 659, component 154, integration 90 (+3 skipped), contract 85, e2e 104, a11y 42,
visual 68), but recorded a dirty tree for the owner's concurrent proposal. That proposal is
tracked unchanged in `40090e8`. Clean committed owner-run `verify`, owner captures in the `furniture`
slice, provenance and the owner's exact AR-01/AR-04 review remain. Team chair backs are small
because chairs tuck under the desktops; ask the plate review to assess their legibility.
The Task 6 checklist records performed checks and limitations. Task 7 waits for that review;
full Phase 7 art acceptance still waits for Tasks 7–10 and the explicit Task 10 owner ruling.

Concurrent owner files were preserved separately: the comprehension proposal is tracked unchanged
in `40090e8`; `docs/evidence/dogfood-register (2).md` is tracked in place, unchanged, in `6ece901`
under the owner's explicit instruction. Tracking the latter required one provenance entry; the
writer appended only that new owner-supplied artifact, with no re-recording or attribution changes.
No furniture captures were regenerated. The failed clean runs were bookkeeping checks: stale
position metadata (corrected in `e20edea`) and that missing provenance entry (now registered).
Confirm the final clean runner result in `node_modules/.cache/agent-runner/outbox/` before the
owner's furniture capture and exact plate review.

### Why Phase 7 exists

The owner compared the Phase 7-O app captures with the approved art pack (AR-01 to AR-04) on
2026-09-28: "nowhere near", "mainly rendering". The app drew flat grey rectangles in Pixi; the
approved Active visual system (`reconciliation-b-clarity`, Phase 6) existed only as SVG evidence
built by script. Phase 7 puts that system into the app and raises it toward AR-01 in slices, each
captured by the owner beside the plate before the next starts (Q-3), so drift is caught per slice
rather than at the end.

### Done, in order, with the reason for each choice

- **Task 1, fonts (gate `edd91fe`).** Fira Sans and Fira Mono 5.3.0 (`@fontsource`, exact pins,
  Latin only), SIL OFL texts in `licenses/fonts/` with a test. A `?surface=font-sheet` page was
  captured by the owner in Windows Chromium first (Q-4: F-5 required the faces confirmed on his
  machine before becoming tokens); owner: "Looks good." Then `--font-ui`/`--font-mono` on `:root`,
  loaded once from `global.css` (T-1), Mono only for Technical detail values (T-2).
- **Task 2, move before changing (gate `d7c98dd`).** `scripts/phase6-candidate-{geometry,render,
  styles}.ts` moved by `git mv` to `packages/ui-system/src/scene/`, exported as
  `@cuckcode/ui-system/scene`. No output change: the frozen Phase 6 frame and every approved capture
  re-render byte for byte (`scripts/phase7o-digest-successors.unit.test.ts`), which is what makes
  every later change provably additive. The provenance test resolves old paths through a declared
  move map; the register keeps approval-time paths.
- **Task 3, split by owner ruling into 3a and 3b** because the app's flat rectangles, the layout
  policy's 64×32 tile and Phase 6's 34 px tile were three geometries, and one change could not show
  which a failing test was about.
  - **3a (gate `6cc9475`):** `svg-scene-renderer.ts` behind the unchanged `SceneRendererPort`, at
    parity with Pixi. `render-error` replaced `canvas-loss` (Q-1): SVG has no context to lose, so the
    state became a general "The office could not be drawn" with the outline as the fallback. Limit:
    e2e reaches `render-error` by URL; no test forces a real mount failure.
  - **3b (gate `52cafbb`), rulings G-1 to G-3.** G-1: one geometry. `office-layout.ts` (camera
    bounds, zones, role anchors, hit regions) now derives from the Phase 6 geometry via
    `scene/entities.ts`; the camera's rules (fixed rotation, zoom stops, fit, pan clamp, 44 px
    minimum target, Reset view) are unchanged, only measurements moved (D-02 calls them graybox
    measurements; F-4 said keep Phase 6 geometry). Bounds snap outward to whole pixels because the
    isometric edges are irrational and Reset view must stay byte-exact. G-2: **no figures until Task
    7**, because a figure at a desk claims presence and F-3 says poses come only from the behaviour
    map; Phase 6's fixed figures would have shown offline agents as present. G-3: DOM labels stay,
    Phase 6's baked labels are left out. Person labels sit on their own desk; zone labels above the
    zone's back corner (Phase 6's own rule). The scene is art drawn once plus one invisible hit
    polygon per entity.
  - **Closed at `6cb0dea`** with owner captures `docs/evidence/phase-7/active-office/`. Owner:
    "the basic structure is approaching ab-reference-v1, but clearly falls short of the quality when
    compared directly." That gap is what Tasks 5–8 exist for.
- **Task 4, Pixi removed (gate `2b97c73`), rulings R-1 to R-3.** R-1: the probe and its three specs
  went; **the only browser tests of pan, zoom limits and pointer–keyboard camera parity went with
  them** (they ran on the probe). Camera rules stay unit-tested in `office-camera.unit.test.ts`;
  in-office pan and zoom were never built, so that D-02 item is open, not lost. R-2: the owner ran
  `npm.cmd uninstall pixi.js --workspace @cuckcode/web` on Windows (a lock produced on Linux risks the
  cross-platform hazard); the lock dropped exactly pixi.js and eleven packages only it used. R-3:
  `SceneDescriptor` carries a required outline and no rectangle. Guards:
  `scripts/no-pixi.unit.test.ts`, `tests/e2e/phase-7-no-pixi.spec.ts`. Bundle: 880,765 bytes in 13
  files to 398,467 in 2; the >500 kB chunk warning is gone.
- **Task 5, the room (gate `0637b27`), rulings W-1 to W-4.** `scene/architecture.ts`: two back
  walls, front walls cut to 0.3-tile stubs (one fixed cutaway rule: stubs are lower than a desk top,
  so `resolveCutaways` never fires and nothing is hidden), four windows, and floor daylight from one
  fixed `SUN`. W-1: windows on the **upper-right** wall, not AR-01's left, because the approved
  renderer already shades right-facing sides lighter, so light from that side agrees with every
  existing shadow without editing the Active style. W-2: walls 2 tiles high, which fits the camera's
  existing headroom; 2.6 tiles would have dropped the 1280 zoom from 1.125 to 1.0 and squeezed two
  labels to 177 px against a 180 px maximum. Wall thickness is taken **inward** for the same reason
  (outward stood 7 px outside the frame). W-3: scene ground `#efe7d9` (Active palette) instead of
  grey, so the field belongs to the office. W-4: perimeter only; partitions wait for Task 6 if
  wanted. F-6 is enforced: `tests/e2e/phase-7-architecture.spec.ts` asserts the drawn room is
  byte-identical across ready, stale, offline, partial, conflict and `blocked-elsewhere`.
  Owner captures `docs/evidence/phase-7/architecture/` (`732fb5e`). Owner: "new captures are a
  definite improvement and i agree with the items you noted."

### Task 5b: approved shell refinement — complete

The owner approved the proposal as written on 2026-10-03. The approved wall-only shading and cap
changes, plus a fixed radial-gradient treatment for daylight, are implemented; new tests first
failed on those three visual contracts and now pass. Furniture face shading and the frozen Phase 6
composition remain unchanged. The visual capture spec targets `architecture-b`, preserving the
reviewed `architecture/` evidence. The owner captures match provenance, and the owner's AR-01
review is "slice meets expectations". The clean owner-run verify above passed, so Task 5 is done.
Zone-label position and style stay together for Task 8. Task 6's detail plan is approved; its
separate task breakdown was owner-approved 2026-10-03; implementation is in progress.

### Remaining Phase 7 (each needs its own owner-approved plan before building)

Task 6 furniture per zone (plate review; plan approved, task breakdown approved; implementation in progress) · Task 7 figures,
F-3, poses only from the behaviour map, paused when blocked, still when unknown, adversarial
fixtures still refused (plate review) · Task 8 in-scene cues, F-7 (one amber marker per manager
request; "Status unknown"
without motion; AR-03 review) **plus zone-label placement and label styling** · Task 9 capture
matrix and evidence, F-8, measured contrast, frame time (Q-5) · Task 10 owner visual acceptance
against AR-01–AR-04 · Task 11 optional second cold run (needs a new key and interval).

**Recorded for later tasks, not fixed:** at zoom 0.875 (inspector open) the Product Designer and
Implementation Engineer desks are ~155 px apart, so two long labels can touch; the overlap test
covers the default view only (Task 7/8). The capture spec `tests/visual/phase-7-active-office.spec.ts`
serves every slice through its `SLICE` constant (now `architecture-b`); change it per slice so earlier
captures are never overwritten.

### Not authorized or not drafted

- **DF-028 fix** — proposal `docs/proposals/2026-10-03-df-028-e2e-on-the-production-bundle.md`,
  option (a), not ruled. Cause traced: the dev server's `/@react-refresh` request fails with
  `net::ERR_NO_BUFFER_SPACE` on Windows, leaving a blank page; four occurrences, last at `d7c98dd`.
  A rerun is green. If a `verify` fails with a blank page, read the kept trace before calling it a
  regression.
- **B-5** (a runtime producer for DF-029's version-3 conditions) — not authorized; no real agent can
  yet say "blocked, not on you".
- **Kickoff open questions** (housekeeping 3f, ruled option 2 after Phase 7-O) — plan not drafted.
- A durable `gh` credential fix (below) — optional, not done.

### Earlier, still true

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
- **DF-029, fixed 2026-10-03 (`tasks/df-029-todo.md`, spec §10):** payload version 3 lets a
  blocked or waiting condition omit the request; manager attention follows the request; the
  inspector says "Nothing needs you." and who can resolve it; `?fixture=blocked-elsewhere` shows
  AR-03 column 1 (owner: "it matches"). **Caveat:** no runtime producer emits version 3 yet, so a
  real agent cannot say it. That is B-5, not authorized.
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
- **Order since acceptance, all done:** DF-029 (2026-10-03), the Phase 5 fixture removal
  (2026-10-03, gate `f30481b`), then Phase 7 (above). `codex-currency` is merged (`41c4625`). Work
  is on `main` directly now.

**Phase 5 was accepted by the owner on 2026-09-25**
(`docs/evidence/phase-5/decision-record-2026-09-25-task-10-owner-acceptance.md`). The D-24
production-suitability review is recorded by hand in
`docs/evidence/phase-5/d24-production-suitability-review.json`: **due 2026-10-09, escalation
2026-10-02**, owner as Delivery Lead and reviewer. Nothing in the code enforces it.
**Disposition recorded 2026-09-27 on branch `codex-currency` (`c3752cb`), merged 2026-09-28 (`41c4625`):**
`reuse_concepts_only`, and the fixture's presence in production packages ruled an unruled
deviation. **Removed 2026-10-03** (`tasks/phase-5-fixture-removal-todo.md`;
`docs/evidence/phase-5/decision-record-2026-10-03-fixture-removed.md`): the fixture lives in
`fixtures/decision-notice` with its own production build on port 4175, which the four Phase 5
suites load; `scripts/fixture-isolation.unit.test.ts` fails if production reaches it again; C-11
is checked through a successor review in `docs/evidence/phase-5-fixture-removal/`. `verify` now
needs ports 4173, 4174 and 4175 free. Closing the Phase 5 fixture initiative is a separate owner
act.

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
**Script execution is disabled on his PowerShell, so `npx`/`npm` fail; give `npx.cmd`/`npm.cmd`.**
On 2026-10-03 a failed `npx` followed by `Remove-Item Env:...` meant the retry ran without the
regenerate flag and wrote nothing to `docs/evidence`; give the whole block with `.cmd` forms.

**Owner capture recipe (every Phase 7 slice):**
`$env:CUCKCODE_REGENERATE_EVIDENCE = "1"`, `npx.cmd playwright test
tests/visual/phase-7-active-office.spec.ts`, `Remove-Item Env:CUCKCODE_REGENERATE_EVIDENCE`,
`npm.cmd run phase5:provenance:write` (expect `"appended": 2`), `git status --short`. The agent then
checks each PNG's sha256 against its ledger line, records the owner's words verbatim in the
checklist, commits the evidence, runs `verify`, and only then marks the task done.

| Command | Purpose |
| --- | --- |
| `npm run kickoff:preflight` | Task 17 preconditions, no provider calls |
| `npm run phase5:contract:build` | Rebuild the acceptance contract and traceability matrix |
| `npm run verify` | The whole gate. At `a582953`: unit 646, component 154, integration 90 (+3 skipped), contract 85, e2e 92, a11y 42, visual 68 |
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

Git: work happens on `main` (since the 2026-09-28 merge). Remote is `klarollc/CuckCode`, private,
over HTTPS — SSH has no key registered and `ssh -T git@github.com` fails. **Pushes are owner-run.**
The active `gh` account is `nateriera`, which cannot push; the owner runs `gh auth switch --user
klarollc`, `git push origin main`, `gh auth switch --user nateriera`. `gh` 2.100.0 does not pick the
account from the URL's username; a repo-local credential fix was never made. **Unpushed at this
writing:** `0637b27`, `9986ec2`, `732fb5e` and the commit carrying this update.

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
`playwright.config.ts` now enforces it. Ports: **4173** dev server, **4174** production preview of
the office (captures use it), **4175** the Decision Notice fixture's own build. All three must be
free; the owner runs another project whose agent sometimes holds 4173/4174, which stops a run at
e2e start — that is not an orphan to kill.

**Agent session practice (Cowork, 2026-10-02/03).** The agent edits and tests in a cloud container
mirror of the repo (full install, Node 22, Playwright via a local config pointing at the container's
Chromium), never `npm install`s against the owner's folder, copies changed files to the owner's
machine, and confirms each transfer by comparing sha256 lists on both sides before committing there.
Known container-only failures, not regressions: a `/favicon.ico` console 404 from the full Chromium
build (scaffold e2e, Decision Notice visual), `scripts/phase5-script-paths.unit.test.ts` (the
successor review JSON is not mirrored), `position-record` (no `.git`). The commit's gate is always the
owner's runner `verify` on a clean tree, never the container run. After any commit check for a stray
`.git/index.lock` and that `position.json` actually changed with its checklist.

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

## Task 6 clearance ruling — 2026-10-03

Owner approved the target correction recorded in the Task 6 plan and breakdown: canonical hit
polygons stay exact, furniture stays behind transparent targets, targets remain operable, and
visible labels remain clear. The original literal hit-polygon nonintersection requirement is
superseded because the existing polygons intentionally cover floors and desks.

The owner subsequently approved the existing desk-under-own-label overlap only; all added chairs,
papers, foliage, rug marks and floor seams must avoid every label plate. See the plan's overlay.
