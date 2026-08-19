# Phase 4 defect register

Severity definitions: `docs/master-design-document-v0.1.md` lines 1133-1140.
V0/V1 block the graybox gate. V2 requires explicit owner disposition. V3 may be scheduled as debt.

Open defects must be dispositioned before Task 15 graybox acceptance.

## Visual discrepancies

### D4-V2-001 — Unscoped global stylesheet rules collide across web surfaces

- Severity: **V2 Medium** (noticeable token inconsistency).
- Status: **Fixed 2026-08-18. Verified by full `npm.cmd run verify` on the owner's Windows environment.**
- Discovered: 2026-08-18, while explaining the modified Phase 0 rendered evidence.
- Surfaces: `apps/web/src/office-shell.css`, `apps/web/src/layout-trial.css`.

Both stylesheets declare unscoped `:root`, `*`, and `body` rules. `office-shell.css`
sets `:root { background: #e3e3df }`; `layout-trial.css` sets `:root { background: #eeeeeb }`.
Vite bundles every imported stylesheet into a single sheet for the SPA, so both rules apply
to every surface and the winner is determined by bundle order, not by intent. The graybox
office backdrop is therefore not deterministically specified by its own stylesheet.

No test asserts a background colour on any surface, so the condition is currently unverified
in either direction. `.restore/20260813-checkpoint-b-css-isolation` records that the file was
inspected during Checkpoint B; the unscoped selectors were left in place.

Severity rationale: this is V2 and not V1 because no palette, material, or lighting direction
has been approved. `.ui-craft/decisions.md` is explicit that the Phase 4 measurements are
layout policy only and approve no colour tokens. There is no approved visual direction for the
backdrop to contradict. **This defect escalates to V1 if art direction is approved before it is
fixed**, because the rendered backdrop would then be order-dependent against an approved token.

Suggested correction (not authorised): scope each surface's `:root`/`*`/`body` rules to that
surface's root element, and add a component or rendered assertion binding the graybox office
backdrop to a single named value. This is a behavioural and visual change requiring its own
RED-GREEN evidence and its own approval; it is outside Task 14 scope.

Observed consequence: this leak is the direct cause of process finding D4-P-001 below.

## Process findings

### D4-P-001 — Phase 0 rendered evidence was overwritten outside any task authority

- Status: **Closed 2026-08-18 by owner decision — accepted originals restored.**
- Incident: 2026-08-13 15:08:57 PDT, between commit `0139c30` (capture canonical layout
  trials, 15:07:07) and `21decb3` (close Task 5 layout gate, 15:09:39).

`docs/evidence/phase-0/rendered/phase-0-scaffold-chromium-1440.png` and
`…-1280.png` were re-captured during the Task 5 evidence pass and left uncommitted in the
working tree. Page content remained correct — both images still showed the Phase 0 scaffold —
but every pixel changed because the page background moved from `#ffffff` to `#eeeeeb`,
picked up from the newly added unscoped `layout-trial.css` rule (see D4-V2-001).

Impact: the re-captured files hashed `88d84850…` (1440) and `a4e89490…` (1280), while
`docs/evidence/phase-0/phase-0-report.md` records `2d2134d9…` and `df11f4de…`. An
owner-accepted phase's evidence no longer verified against its own manifest.

No automated test writes to `docs/evidence/phase-0/rendered/`; the capture was ad hoc.

Resolution: the owner-accepted originals were restored from `HEAD` on 2026-08-18. Both files
now hash exactly to the values recorded in `phase-0-report.md` and the working tree is clean.

Preventive note for Task 15: accepted-phase evidence directories are immutable once their
owner gate closes. Re-capturing them under a later build breaks the recorded SHA binding
even when the rendered content is still semantically correct.

### D4-P-002 — Phase 4 command list named three scripts that did not exist

- Status: **Closed 2026-08-18 — scripts added and verified green on the owner's Windows environment.**

`docs/phase-4-graybox-office-and-kickoff-spec-v0.1.md` (lines 233, 234, 238) and
`tasks/phase-4-plan.md` (lines 60, 61) named `test:graybox`, `test:kickoff`, and
`capture:graybox`. None existed in `package.json`. Task 15's stated verification command
list could not run as written. Under AGENTS.md this is an implementation/documentation
disagreement and a stop condition.

Resolution: the three scripts were added to `package.json` rather than removed from the
specification, because the plan's own structure defines their intent — it files
`test:graybox` and `test:kickoff` under "Focused loops" alongside the unit, component,
integration, and contract loops, and lists the browser suites separately under Checkpoints.
Both were therefore built as non-browser focused loops. `capture:graybox` was undefined in
either document; by owner decision on 2026-08-18 it runs the existing `@visual` suite at both
approved viewports followed by the graybox manifest validator, and its captures remain
ephemeral current-build evidence consistent with the Checkpoint C record.

Verification, run by the owner on Windows (Node 24, `npm.cmd`) on 2026-08-18:

- `test:graybox` — 3 manifest-validator tests, 6 unit files / 28 tests,
  3 component files / 30 tests. All passed.
- `test:kickoff` — 5 files / 13 tests across the contract, unit, and integration projects.
  All passed.
- `capture:graybox` — 12 `@visual` tests across chromium-1440 and chromium-1280,
  plus 3 manifest-validator tests. All passed.

No script was executed from the Cowork session; that environment cannot run this repository
(win32-x64 `node_modules`, Node 22 against a `>=24.18.0` engine pin). Every count above comes
from the owner's own terminal output.

Note: `test:graybox` currently runs the entire component project, which cost 33 seconds of a
34-second run. Acceptable now; revisit the payload once Task 14 adds its own component tests
and the inner-loop cost is measurable.

### D4-P-003 — Visual capture commands overwrite committed Task 5 evidence in place

- Severity: process. **Fixed 2026-08-18. Verified by full `verify` leaving the committed layout-trial PNGs unmodified.**
- Discovered: 2026-08-18, during the first `capture:graybox` run.

`tests/visual/phase-4-layout-trial.spec.ts` writes its screenshots directly to
`docs/evidence/phase-4/layout-trials/*.png`, which are committed files. Those images are the
owner-reviewed evidence behind `docs/evidence/phase-4/task-5-layout-review.md` and the approved
measurements in `.ui-craft/decisions.md`. Every `test:visual`, `capture:graybox`, and `verify`
run therefore rewrites evidence supporting an already-approved decision, with no gate and no
warning. Every other `@visual` spec correctly writes to `testInfo.outputPath()`, which lands in
the ephemeral `test-results/` directory; this spec is the sole exception.

Mitigating evidence from the 2026-08-18 run: all four files were rewritten **byte-identically**
to `HEAD` (SHA-256 unchanged). The graybox capture is bit-for-bit deterministic across runs,
so today the overwrite is a no-op and the risk is latent rather than active.

Risk: any intentional CSS, layout, or renderer change will silently mutate the Task 5 evidence
on the next verify. The change would be visible only as an unexplained dirty working tree —
precisely the condition that produced D4-P-001, and precisely as hard to explain after the fact.

Suggested correction (not authorised): have the spec write to `testInfo.outputPath()` like every
other visual spec, and regenerate the committed layout trials only through an explicit, separately
named command that the owner runs deliberately when re-deciding measurements.

### D4-P-004 — A schema change landed without the test that covers it, leaving main red

- Status: **Corrected 2026-08-18; awaiting owner re-verification of the fix.**
- Discovered: 2026-08-18, while scoping the open-question persistence task.

Task 13 (commit `85e97cf`, "feat(persistence): store immutable kickoff records") added migration
`003_kickoff` and changed `project-store.ts` to set `user_version = 3`. It did not update
`project-store.integration.test.ts`, which continued to assert `userVersion: 2` and a two-element
`migrations` array.

`npm run verify` has therefore been failing on `main` since Task 13 landed. Confirmed by the
owner on 2026-08-18: 1 failed, 39 passed, 1 skipped across 14 integration files, with both
predicted mismatches present.

Why it survived: the Task 13 evidence line reads "persistence integration 2/2", which is the
focused kickoff-store run, not the integration project. Checkpoint C's 12-file / 38-test
integration pass predates Task 13. No full `verify` ran in between. The gate was documented and
did not execute — the same shape as D4-P-002.

**A second defect concealed the first.** The failing test opened a `ProjectStore` and called
`store.close()` inline at the end of the body, with no `try/finally` and no `afterEach` cleanup.
When the assertion threw, `close()` never ran, SQLite kept the file open, and the Windows
`afterEach` `rmSync` failed with `EPERM`. The permission error is what surfaced first and reads
like an environment problem rather than a stale assertion. On Linux the unlink would have
succeeded and the real cause would have been visible immediately.

Corrections applied:

1. The assertion now expects `userVersion: 3` and all three migrations.
2. A structural invariant was added: `schema.userVersion === schema.migrations.length`. The
   enumeration is deliberately retained so that adding a migration remains a conscious update,
   but the pragma and the applied list can no longer drift apart silently.
3. Stores are registered in an `openStores` array and closed in `afterEach` before directories
   are removed, so a failing assertion reports itself instead of being masked by an `EPERM`.

Note for the open-question work: Task 3 adds migration `004_open_question` and will bump
`user_version` to 4. That update to the enumeration is expected and intentional.

### Governance implication

Both D4-P-002 and this defect are gates that were recorded as satisfied by a narrower command
than the gate describes. The durable fix is not more review. A task that changes shared schema
must run the whole project that covers it, and the evidence line must name the exact command
rather than a summary count. That rule is executable and belongs in `AGENTS.md`.

## Resolutions — 2026-08-18

### D4-V2-001 resolved: one global stylesheet, enforced

Owner decision on 2026-08-18 was to fix rather than dispose, before the Task 15 gate.

Investigation found the defect was worse than first reported. Beyond the `:root` collision:

- `layout-trial.css` declared **unscoped `button` and `button:focus-visible` rules**, so a
  diagnostic surface was styling every button in the product, including the office's.
- The three reduced-motion resets were **not identical**. `layout-trial.css` used
  `animation: none !important`; `office-shell.css` and `pixi-scene-probe.css` used
  `animation-duration: 0.01ms !important`. Both were global and `!important`, so bundle order
  decided the winner — and layout-trial's won. **The office's reduced-motion behaviour was being
  set by a diagnostic stylesheet, not its own.** Reduced motion is a Phase 4 acceptance
  requirement with passing browser evidence behind it; that evidence was real, but it was
  produced under a rule the office did not own.

Fix: `apps/web/src/global.css` is now the single document-wide stylesheet, imported once by
`main.tsx`. Every surface stylesheet is scoped. The stricter reduced-motion form was kept,
because MDD acceptance requires immediate placement and zero animations, and because it is what
the passing evidence was actually produced under.

Safety check before changing anything: the built CSS bundle was captured, the change applied, and
the bundles compared rule by rule. **136 rules after versus 137 before, nothing added, one rule
removed** — the dead `animation-duration: 0.01ms` variant that was already being overridden.
`:root` and the global reduced-motion block are byte-identical. No rendered output changed, which
is why the committed layout-trial captures remained valid.

Enforcement: `scripts/css-scope.test.mjs` fails on any escaping selector in any stylesheet other
than `global.css`, and asserts `global.css` owns the backdrop. Wired into `test:ui-contract`, so
it runs inside `verify`. A browser test additionally asserts `html` computes to
`rgb(227, 227, 223)` and that reduced motion yields zero animations.

Process note: the first RED for this fix was invalid. The test failed on a regular-expression
syntax error — an unescaped `{` under the `u` flag — rather than on an assertion. It was repaired
and re-run to produce a genuine RED listing all 14 violations before any fix was written. A test
that does not parse is not evidence.

### D4-P-003 resolved: committed evidence is immutable by default

Fix: captures route through `tests/support/evidence-output.ts`, which returns the ephemeral
per-test output directory unless `CUCKCODE_REGENERATE_EVIDENCE=1` is set. Regenerating
owner-reviewed artifacts is now a deliberate act with a reviewable diff rather than a side effect
of running the suite. Deliberate regeneration is `npm run capture:layout-trials` with that
variable set, following the same convention as the gated live kickoff.

Enforcement: `scripts/evidence-immutability.test.mjs` walks every spec under `tests/` and fails if
any file other than the sanctioned helper references `docs/evidence`, and separately asserts the
helper defaults to ephemeral output and gates regeneration explicitly. Wired into
`test:ui-contract`.

Verification: a full `verify` was run, including all 12 `@visual` tests and both layout-trial
specs. `git status --short` afterwards listed only the intended source changes; the four committed
layout-trial PNGs were **not** modified. Before this fix the same run rewrote them on every pass.

### Governance note

Three rules from this session are now executable rather than remembered: the schema/pragma
invariant (D4-P-004), stylesheet scoping (D4-V2-001), and evidence immutability (D4-P-003). Each
replaced a rule that had already been violated at least once. This is the durable form of the
lesson recorded under D4-P-002 — a gate that only exists in prose is a gate that eventually does
not run.
