# Codex runtime currency checklist

Status: **OWNER-APPROVED 2026-09-25.** Tasks 2, 4 (tests and command), 5–13 are authorized in order;
Tasks 1, 3, 4's upgrade run and 14 are owner-run.
Plan: `tasks/codex-currency-plan.md`, **owner-approved 2026-09-25**, CP-1 to CP-4 as recommended.
Specification: `docs/codex-runtime-currency-spec-v0.1.md`, **owner-approved 2026-09-25**, CX-1 to
CX-6 as recommended.
Authority: `docs/evidence/runtime/decision-record-2026-09-25-codex-currency.md`.

## Rules for every task

- **Work happens in the worktree** `.worktrees/codex-currency` on branch `codex-currency`, never in
  the main working copy, which belongs to Phase 7-O.
- **RED before GREEN.** The RED is an assertion failure against a deliberate stub, recorded in
  `tasks/codex-currency-red-green.md` before GREEN and never re-run afterwards. It moves to
  `docs/evidence/runtime/codex-currency/red-green-log.md` at Task 13 with one owner-run provenance
  write (owner ruling 2026-09-25, so task gates do not wait on provenance writes).
  A test that cannot fail against its stub is named as such, not claimed as RED.
- **The gate is a runner result on a clean tree** in the worktree, with the command named beside
  every count. Container runs are the inner loop and are recorded as container-GREEN only.
- **No `npm install` from an agent shell against the mount.** Installs are owner-run in PowerShell.
- **No live provider call** except Task 14, owner-run.
- **Stop and ask** when code and a document disagree, when a surface diff shows anything the spec
  did not name, or when a task would touch a file outside its list.
- Historical evidence is never rewritten: passes 1–9, the Task 17 artifacts, the 0.146.0 bundle,
  `turn-ledger.json`.

## Tasks

- [x] **Task 1 — Worktree, owner-run** (CP-1).
  - Owner, from `C:\Users\nater\CuckCode` in PowerShell:
    `git worktree add .worktrees/codex-currency -b codex-currency`;
    `Add-Content .git/info/exclude '.worktrees/'`; then in the worktree `npm.cmd install` and
    `npm run agent:runner`.
  - Agent, after the worktree exists: move (not copy) this stream's four untracked documents from
    the main copy into the worktree — the specification, this checklist, the plan and the decision
    record — and make them the branch's first commit. They then exist once, on `codex-currency`.
  - Acceptance: `git status` in the main copy shows no `.worktrees` entry and none of the four
    documents; the worktree runner answers `git-status` with the new branch and a clean tree after
    the first commit.
  - Verify: runner `check:toolchain` in the worktree passes.
  - **Result, 2026-09-25 (PT):** done. Worktree on `codex-currency`, excluded, installed, runner
    live. Commits `fa89280` (the four documents, moved out of the main copy), `7e58e99` (lockfile
    resync — pre-existing drift at `b0af24d`, owner ruling), `4c62849` (provenance line for the
    decision record, owner-run `phase5:provenance:write`). **Gate:** runner `verify` exit 0 on a
    clean tree at `4c62849`, `evidenceChanged: false` — unit 397, component 73, integration 67 + 3
    skipped, contract 77, e2e 50, a11y 46, visual 62.
  - **Deviations, stated:** (1) `check:toolchain` is not on the runner allowlist; `verify`, which
    runs it, was the gate. The same holds for every checklist gate naming `test:protocol`,
    `test:toolchain`, `test:runtime` or `phase5:provenance`: `verify` substitutes. (2) The 12
    Phases 0–3 artifacts whose ledger digests are of CRLF bytes were given the main copy's exact
    bytes in this worktree, by owner ruling, after checking each differs only by line endings; git
    sees no change. (3) Git runs here only with an explicit `--git-dir`; the worktree's `.git`
    pointer is a Windows path. Commits over the bridge leave lock files, removed under the
    session's delete permission. All three go to the Task 13 dogfood entry.

- [x] **Task 2 — Pin module and executable resolver** (R1.2, R1.3, R1.5, R2.1).
  - Files: `packages/runtime-codex/package.json` (declaration `"@openai/codex": "0.157.1"`, no
    install yet), `packages/runtime-codex/src/codex-pin.ts`, `codex-pin.unit.test.ts`,
    `scripts/check-toolchain.test.mjs`.
  - Acceptance: `CODEX_PIN` equals the declaration; the resolver maps win32-x64, linux-x64 and
    darwin-arm64 to their `vendor/<triple>/bin` paths; `CUCKCODE_CODEX_EXE` overrides; a missing
    platform package refuses with `CODEX_EXECUTABLE_UNRESOLVED`; a range (`^0.157.1`) is refused
    with `CODEX_PIN_NOT_EXACT`.
  - Characterization, not RED: `parsePlatformPackage("@openai/codex-win32-x64")` joins family
    `@openai/codex`.
  - Verify: runner `test:unit`, `test:toolchain`.
  - **Result:** `db76113`. RED 9/9 assertion failures against a stub; GREEN 9/9; characterization
    passed first run, not claimed as RED. Added `CODEX_PACKAGE_VERSION_MISMATCH`: the platform
    package's own `codex-package.json` names its version and entrypoint. **Gate:** runner `verify`
    exit 0, clean tree at `db76113` — unit 406 (397 + 9), every other count unchanged.

- [x] **Task 3 — Install, owner-run** (R1.1, R1.6).
  - Owner, in the worktree: `npm.cmd install`.
  - Acceptance: the lockfile diff adds only `@openai/codex` and its platform packages; the resolver
    finds `codex.exe`; `codex.exe --version` prints `codex-cli 0.157.1`.
  - Verify: runner `check:toolchain`, `git-status` (agent reviews the lockfile diff).
  - **Result:** owner ran `npm.cmd install`. The lockfile diff is two hunks, 132 insertions, 0
    deletions: the seven `@openai/codex` entries (launcher plus six platform packages, each with an
    integrity hash) and `devDependencies` on the runtime-codex workspace. Installed:
    `@openai/codex` and `@openai/codex-win32-x64`, whose `codex-package.json` states 0.157.1 and
    entrypoint `bin/codex.exe` (322,515,248 bytes). **Deferred, stated:** the agent shell cannot
    execute a Windows binary, so `codex.exe --version` is first observed by the owner-run Task 4
    upgrade, which refuses unless it prints `codex-cli 0.157.1`. The gate is Task 4's `verify`.

- [x] **Task 4 — Upgrade command and surface diff** (R4).
  - Files: `scripts/codex-surface-diff.mjs`, `scripts/codex-surface-diff.test.mjs`,
    `scripts/generate-codex-protocol.mjs` (becomes the upgrade command), `package.json` scripts
    (`protocol:codex:upgrade`).
  - Acceptance: fixture tests — an added `ThreadItem` type and an added `CodexErrorInfo` variant are
    flagged for ruling; a removed server request is flagged; identical bundles give an empty diff;
    the command never edits the pin.
  - **Owner-run:** `npm run protocol:codex:upgrade -- 0.157.1`, writing
    `packages/runtime-codex/protocol/0.157.1/` and its `surface-diff.md`.
  - **Stop condition:** anything non-additive, or any item type or error variant beyond
    `functionCallOutput`, `rateLimitExceeded`, `misalignmentPolicyViolation`, stops work for a
    ruling. The bundle hash is compared with the container-generated 0.157.1 bundle.
  - Verify: runner `test:protocol`.
  - **Result:** tooling `26e8cba` (RED 9/10, one test named as unable to fail against its stub;
    GREEN 10/10). The owner ran `npm run protocol:codex:upgrade -- 0.157.1` on Windows, which also
    observed `codex-cli 0.157.1` from the installed `codex.exe` (Task 3's deferred check). Bundle:
    314 files, `bundleHash` `98111ca770d4d181fa42551a666d8c9be42d1333540ef70fd93cffda53fba24f`,
    identical to the diagnosis-time generation and the mirror rehearsal; `surface-diff.md`
    byte-identical to the rehearsal's. **Stop condition not triggered:** no breaking entries, and
    the three entries needing a ruling are the three the spec named. Each is already decided by an
    approved ruling: `functionCallOutput` is an effect (CX-2); `rateLimitExceeded` and
    `misalignmentPolicyViolation` are not transport classes (CX-4 names four), so neither is
    retried. **Gate:** runner `verify` at `41cf4eb`: first run exit 1 — one visual capture
    (`Phase 5 decision notice — saving`, chromium-1280) never rendered its state within 5 s, 61/62; this
    commit changes nothing the web app loads. Re-run on the same clean commit: exit 0, visual 62/62, every
    other count unchanged. Recorded as a flake, not hidden.

- [x] **Task 5 — Single-source guard** (R2.3, R2.4, R1.4).
  - Files: `scripts/codex-pin.test.mjs`, `test:protocol` wiring.
  - Acceptance: fails on any Codex version literal in non-test source outside the declaration, on a
    desktop-app path outside historical evidence, and on a missing `protocol/<pin>/` bundle.
  - RED: the current tree — the supervisor regex, seven `protocolVersion` literals, the generator
    constant, four desktop-app paths. Real code rather than a stub; recorded as such.
  - Verify: runner `test:protocol`.

- [x] **Task 6 — Wire every consumer to the pin** (R2.2, R1.2–R1.4, R4.3).
  - Files: `supervisor.ts`, `phase4-kickoff-session.ts`, `run-phase4-kickoff.ts`,
    `run-phase5-release-review.ts`, `run-phase5-surface-contract.ts`,
    `run-phase5-verification.ts`, `run-phase5-visual-qa.ts`, `run-phase6-review.ts`,
    `run-role-exercises.ts`, `codex-live.integration.test.ts`, `check-codex-protocol.mjs`,
    `fixtures/fake-app-server.mjs`.
  - Acceptance: Task 5 GREEN; the supervisor, binding, kickoff and role-exercise suites stay green;
    comparison tests keep their literals.
  - This commit moves the runtime to 0.157.1.
  - Verify: runner `test:protocol`, `test:unit`, `test:integration`, `typecheck`,
    `typecheck:scripts`.
  - **Result, Tasks 5 and 6 together:** `e06b03c`. Committed as one because the Task 5 guard is RED
    on the tree until Task 6 lands. Guard RED 5/7 against a stub; the real-tree RED found 22
    violations, including live probes and the supervisor integration test spawning by the desktop
    path, and the fake server's hard-coded user agent, which the plan had not listed.
    `carriesVersion` RED 2/3. **Gate:** runner `verify` exit 0, clean tree at `e06b03c` — unit 409,
    integration 67 + 3 skipped, others unchanged; `protocol:codex:check` verifies both bundles and
    the pin. **Files beyond the list:** the two live probe tests, a comment in `codex-pin.ts`, and
    `supervisor.unit.test.ts`.

- [ ] **Task 7 — Drift preflight** (R3, CP-4).
  - Files: `scripts/codex-drift-core.mjs`, `scripts/codex-drift.mjs`,
    `scripts/codex-drift.test.mjs`, `phase4-kickoff-preflight.ts`, the live scripts, `package.json`
    (`protocol:codex:drift`, and in `verify` after `test:protocol`).
  - Acceptance: refuses on version mismatch, on hash mismatch and on an unresolvable executable,
    naming observed and expected values; makes no network request; each live script calls it
    before opening a session.
  - RED: a stub core that always reports no drift.
  - Verify: runner `verify` (first run with the new stage).

- [ ] **Task 8 — Item classification** (R5, CX-2).
  - Files: `item-classification.ts` and its unit test; `phase4-kickoff-session.ts` and
    `role-exercise.ts` (both local sets deleted).
  - Acceptance: table keys equal the pinned schema's `ThreadItem` enum; `text` is exactly
    `agentMessage`, `reasoning`, `userMessage`, `plan`, `contextCompaction`; an unknown type stops
    the kickoff turn with `UNCLASSIFIED_ITEM_TYPE`; the role exercise's one-`agentMessage` rule is
    unchanged.
  - RED: a stub table missing `functionCallOutput`.
  - Verify: runner `test:unit`, `test:integration`.

- [ ] **Task 9 — Supervisor: server requests and notification subscription** (R6.5, R6.2).
  - Files: `supervisor.ts`, `supervisor.integration.test.ts`, `fake-app-server.mjs` (modes
    `server-request`, `retry-then-fail`).
  - Acceptance: a server request is answered with a JSON-RPC error and surfaces as
    `SERVER_REQUEST_REFUSED` naming its method; per-thread notifications, including `error`, reach
    a subscriber in order; `CODEX_ARGS` and the request allow-list are unchanged.
  - RED: today's behaviour — the request is swallowed and the turn times out.
  - Verify: runner `test:integration`, `test:runtime`.

- [ ] **Task 10 — Shared turn runner** (R6.1, R6.3, R6.4, R6.6, CP-3, CX-3, CX-4).
  - Files: `turn-runner.ts` and its tests; `failure-classification.ts`; `fake-app-server.mjs`
    (modes `slow-stream`, `silent-turn`, `transport-fail-once`, `transport-fail-twice`,
    `non-transport-fail`); then `phase4-kickoff-session.ts` and `role-exercise.ts` moved onto it.
  - Acceptance: a slow but streaming turn completes; a silent turn idle-times-out at the injected
    180 s, is sent `turn/interrupt` and records `TURN_IDLE_TIMEOUT` with the last method seen; the
    hard cap records `TURN_HARD_TIMEOUT`; one transport failure is retried after the injected 30 s
    backoff with both attempts recorded (`transportRetry: true`); a second stops; a non-transport
    failure is never retried; at most two retries per run. Time is injected; no test waits.
  - RED: a stub runner that returns completed without waiting.
  - Verify: runner `test:unit`, `test:integration`.

- [ ] **Task 11 — Classification in records and the normalizer** (R6.1, R6.7, R7.1).
  - Files: `describeTurnCompletionFailure` and its callers, the three run-artifact writers,
    `normalizer.ts`.
  - Acceptance: failed attempts carry `codexErrorInfo` variant, `httpStatusCode`,
    `additionalDetails`, `message` and the ordered `error` notifications; the normalizer's
    `retryable` is true exactly for the four transport classes; `phase5:provenance` stays green on
    every committed pass.
  - RED: a stub that keeps only `message`.
  - Verify: runner `test:unit`, `phase5:provenance`.

- [ ] **Task 12 — Session log** (R6.8, CX-5).
  - Files: `session-log.ts` and its tests; `phase4-kickoff-session.ts`, `role-exercise.ts` callers.
  - Acceptance: written to `docs/evidence/runtime/sessions/<script>/<ISO>-<roleId>.jsonl` before
    the home is disposed; deltas excluded and counted; stderr copied as already redacted; a
    sentinel placed in the controlled `auth.json` never appears in the log.
  - RED: a stub writer that writes nothing.
  - **Gate: full `verify` on a clean tree via the worktree runner**, reported with the command and
    every stage count.

- [ ] **Task 13 — Smoke script and records** (CP-2, R7.2).
  - Files: `scripts/run-codex-smoke.ts`, `docs/evidence/runtime/smoke-ledger.json` (budget 3,
    spent 0), `package.json` (`codex:smoke`), `docs/evidence/dogfood-register.md`, `AGENTS.md`,
    `docs/HANDOFF.md`, `README.md`.
  - Acceptance: the script refuses without `CUCKCODE_LIVE_SMOKE=1`, runs the drift preflight, and
    was rehearsed end to end against the fake server; it cannot be run by the runner; DF-021's
    product response points at R3; a new DF entry records B1–B6; the boundary documents name this
    stream and its rulings.
  - Verify: runner `test:runner` (the allowlist guard must exclude `codex:smoke`), `verify`.

- [ ] **Task 14 — Owner-run smoke turn, then merge** (spec §4.4).
  - Owner, in the worktree: `$env:CUCKCODE_LIVE_SMOKE='1'; npm run codex:smoke`, then
    `Remove-Item Env:CUCKCODE_LIVE_SMOKE`.
  - Acceptance: one text-only turn at 0.157.1, recorded with the R6 fields and its session log,
    committed. A failure is recorded with its classification, not retried beyond CX-4. Not a
    release review; no verdict.
  - Then: merge `codex-currency` into `main` after Phase 7-O's in-flight task is committed; the
    owner runs `verify` on `main`.
