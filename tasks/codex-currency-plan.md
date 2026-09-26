# Implementation plan: Codex runtime currency and failure diagnosability

Status: **OWNER-APPROVED 2026-09-25, with CP-1 to CP-4 as recommended.** Written under the approval
of `docs/codex-runtime-currency-spec-v0.1.md` (CX-1 to CX-6 as recommended,
`docs/evidence/runtime/decision-record-2026-09-25-codex-currency.md`). `tasks/codex-currency-todo.md` was approved the same day.

## Outcome

Every live Codex session runs the npm-installed `@openai/codex@0.157.1`, resolved from
`node_modules`, and refuses before spawning a turn if the binary or its schema differs from the
pin. Moving the pin is one command that writes a programmatic surface diff for ruling. A failed or
stalled turn records Codex's own classification and retry history, is interrupted rather than
abandoned, and leaves a session log behind. No turn item or server request can pass unrecognized.

## Decisions this plan needs before tasks are written

### CP-1: where the work happens (blocking)

Phase 7-O Tasks 1–10 are authorized and in progress in the same working copy: two commits landed
during this session and `packages/domain` has uncommitted changes that are not this stream's. The
runner marks any dirty-tree result as never the gate for a commit, so two streams sharing one
working copy would make every result from either stream dirty.

**Recommendation: a git worktree inside the connected folder.**
`git worktree add .worktrees/codex-currency -b codex-currency`, with `.worktrees/` added to
`.git/info/exclude` so no tracked file changes. The owner runs `npm.cmd install` there once and
starts a second runner in it. The branch merges to `main` after the Task 12 gate.

Alternative: wait until Phase 7-O Task 10 is committed, then work in the main copy. No setup cost,
but this stream starts later and every live run stays blocked until then.

### CP-2: the smoke turn (spec §4.4)

**Recommendation:** `release-reviewer` on `gpt-5.6-sol`, the configuration behind passes 6–9.
One text-only turn asking for `{"ok": true}`, run by a new `npm run codex:smoke` that refuses
without `CUCKCODE_LIVE_SMOKE=1`. It uses its own ledger, `docs/evidence/runtime/smoke-ledger.json`,
**budget 3**: one turn plus the CX-4 retry allowance. It never touches the Phase 5 ledger (19/60).
The runner cannot run it, because live scripts are excluded from the allowlist by design.

### CP-3: one turn runner for both paths

`openKickoffSession` waits with `waitForTurnCompleted` (180 s). `runRoleExercise` waits with
`waitForNotification("turn/completed", 90_000)`, which returns the first cached completion and is
the defect `waitForTurnCompleted` was written to fix. **Recommendation:** both move onto one shared
turn runner in `@cuckcode/runtime-codex` that carries R5, R6.1–R6.6 and R6.8. The role exercise
keeps its stricter one-`agentMessage` rule (R5.4). Declining leaves two copies of the timeout,
interrupt and classification logic, which is the C-1 F2 defect.

### CP-4: `verify` spawns Codex

R3.3 puts `protocol:codex:drift` in `verify`. It spawns the pinned binary twice (`--version` and
`app-server generate-json-schema`), about two seconds and no network. `verify` then requires the
dependency installed. **Recommendation: accept.** In the cloud container the linux-x64 build
produces the same hash (proven for 0.146.0), so the inner loop keeps working.

## Design

| Module                                                     | Kind               | Responsibility                                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/runtime-codex/package.json`                      | data               | `devDependencies["@openai/codex"]: "0.157.1"`, exact (CX-6). The only declaration.                                                                                                                                                                           |
| `packages/runtime-codex/src/codex-pin.ts`                  | pure + resolver    | `CODEX_PIN` read from the manifest above; `resolveCodexExecutable({ env, platform, arch, resolve })` → platform package → `vendor/<triple>/bin/codex[.exe]`. Injected `resolve` for tests.                                                                   |
| `packages/runtime-codex/src/item-classification.ts`        | pure               | CX-2 table, `classifyItem(type)` → `text` / `effect` / `unclassified`.                                                                                                                                                                                       |
| `packages/runtime-codex/src/turn-runner.ts`                | I/O via supervisor | `runTurn(supervisor, { threadId, input, idleMs, hardMs, retry })`. Liveness from any notification carrying the thread and turn id; `turn/interrupt` on expiry; `error` notifications collected; CX-4 transport retry; returns every attempt.                 |
| `packages/runtime-codex/src/failure-classification.ts`     | pure               | `CodexErrorInfo` → `{ class, httpStatusCode, transport: boolean }`. Also feeds `retryable` in the normalizer (R6.7).                                                                                                                                         |
| `packages/runtime-codex/src/session-log.ts`                | I/O                | CX-5 writer. Deltas excluded and counted; stderr copied as already redacted; never reads the credential.                                                                                                                                                     |
| `supervisor.ts`                                            | changed            | Server requests answered with a JSON-RPC error and surfaced as `SERVER_REQUEST_REFUSED` (R6.5); handshake version from `CODEX_PIN` (R2.2); a per-thread notification subscription for the turn runner. `CODEX_ARGS` and `ALLOWED_REQUEST_METHODS` unchanged. |
| `scripts/codex-drift.mjs` + `scripts/codex-drift-core.mjs` | I/O + pure         | R3. The core compares version text and manifest hashes; the I/O spawns the resolved binary.                                                                                                                                                                  |
| `scripts/generate-codex-protocol.mjs`                      | changed            | Becomes `protocol:codex:upgrade -- <version>` (R4). Resolves the executable through `codex-pin.ts`. Writes `protocol/<version>/` and `surface-diff.md`, and never moves the pin.                                                                             |
| `scripts/codex-surface-diff.mjs`                           | pure               | The spec §5 surface extracted from two schema bundles, and the diff between them. Flags new `ThreadItem` types and `CodexErrorInfo` variants for ruling.                                                                                                     |
| `scripts/codex-pin.test.mjs`                               | test               | R2.3, R2.4, R1.4 guards, in `test:protocol`.                                                                                                                                                                                                                 |
| `scripts/run-codex-smoke.ts`                               | live               | CP-2.                                                                                                                                                                                                                                                        |

**Consumers rewired in Task 6:** `phase4-kickoff-session.ts` (`CODEX_EXECUTABLE`),
`run-phase4-kickoff.ts`, `run-phase5-release-review.ts`, `run-phase5-surface-contract.ts`,
`run-phase5-verification.ts`, `run-phase5-visual-qa.ts`, `run-phase6-review.ts`,
`run-role-exercises.ts`, `codex-live.integration.test.ts`, `check-codex-protocol.mjs`, and
`fake-app-server.mjs` (user agent from the pin).

**Not changed:** `CODEX_ARGS`, the request allow-list, the kickoff policy's spawn-arg sequence,
controlled-home composition, promotion, D-25 budgets, the 0.146.0 bundle, and every committed run
artifact. None of the touched modules is reachable from the Phase 5 side-effect review's entry
points (checked: its module list contains no `runtime-codex` path), so that evidence does not move.

## Task sequence

Every behavioral change is RED → GREEN → REFACTOR. The RED is an assertion failure against a
deliberate stub, recorded before GREEN in `docs/evidence/runtime/codex-currency/red-green-log.md`
and never re-run afterwards. Container runs are the inner loop; each task's gate is a runner result
on a clean tree, with the command named beside the count.

1. **Worktree (CP-1), owner-run.** Create the worktree and exclude, install, and start the runner
   there. Gate: runner `check:toolchain` passes in the worktree.
2. **Pin module and resolver** (R1.2, R1.3, R2.1). Unit tests: resolution per platform, override
   honoured, a missing platform package refuses with `CODEX_EXECUTABLE_UNRESOLVED`. The
   declaration is added to `packages/runtime-codex/package.json` in this task, uninstalled. Also a
   characterization test that `parsePlatformPackage("@openai/codex-win32-x64")` joins family
   `@openai/codex` (R1.5). It already holds, so it is recorded as not a RED.
3. **Install, owner-run** (R1.1, R1.6). `npm.cmd install` in the worktree. The lockfile diff is
   reviewed for exactly the codex packages. Gate: runner `check:toolchain`, and the resolver finds
   `codex.exe`.
4. **Upgrade command and surface diff** (R4). Pure diff tests against small schema fixtures: an
   added item type is flagged; a removed server request is flagged; an identical bundle yields an
   empty diff. Then the **owner runs `protocol:codex:upgrade -- 0.157.1`**, which writes the bundle
   and `surface-diff.md`. **Stop condition:** if the diff disagrees with spec §1 (anything
   non-additive, or an item type or error variant beyond those named), work stops for a ruling.
5. **Single-source guard** (R2.3, R2.4, R1.4). RED on the current tree: the guard reports the
   supervisor regex, seven `protocolVersion` literals, the generator constant and four desktop-app
   paths. This RED is real code, not a stub, and is recorded as such.
6. **Wire every consumer to the pin** (R2.2, R1.2–R1.4). GREEN for Task 5. This is the commit that
   moves the runtime to 0.157.1 (R4.3, ruled by CX-1). The existing supervisor and binding tests
   stay green, with literals kept only in tests of the comparison itself.
7. **Drift preflight** (R3). Core tests: version match and mismatch, hash match and mismatch, an
   unresolvable executable. Wired into `kickoff:preflight`, every live script before a session
   opens, and `verify` after `test:protocol` (CP-4). Gate: runner `verify`.
8. **Item classification** (R5, CX-2). The guard test (R5.3) compares the table with the pinned
   schema's `ThreadItem` enum and is RED against a stub table missing `functionCallOutput`. Both
   local effect sets are deleted. The kickoff session stops on `unclassified` with
   `UNCLASSIFIED_ITEM_TYPE`.
9. **Supervisor: server requests and notification subscription** (R6.5, R6.2 plumbing). The fake
   server gains `server-request` and `retry-then-fail` modes. RED: today a server request is
   swallowed and the turn times out.
10. **Turn runner** (R6.1, R6.3, R6.4, R6.6, CP-3, CX-3, CX-4). Fake modes `slow-stream` (must
    complete), `silent-turn` (must idle-time-out, send `turn/interrupt`, record
    `TURN_IDLE_TIMEOUT`), `transport-fail-once` (must retry once after backoff, both attempts
    recorded), `transport-fail-twice` (must stop), `non-transport-fail` (must never retry). Time is
    injected so tests do not wait 30 s. Then both call sites move onto it; the role-exercise unit
    and integration suites stay green.
11. **Failure classification in records and the normalizer** (R6.1, R6.7, R7.1). Release-review,
    kickoff and role-exercise artifacts gain the new attempt fields additively. The normalizer's
    `retryable` is derived. Evidence readers (`phase5:provenance`) stay green on all committed
    passes.
12. **Session log** (R6.8, CX-5). Canary test: an `auth.json` containing a sentinel is placed in
    the controlled home, and the sentinel never appears in the log. The log is written before
    `dispose`. Gate: **full `verify` on a clean tree via the runner**, reported with the command.
13. **Smoke script and records** (CP-2, R7.2). `run-codex-smoke.ts` rehearsed against the fake
    server first. Update DF-021's product response; add the DF entry for B1–B6. Align `AGENTS.md`
    current boundary, `docs/HANDOFF.md` and `README.md` with the rulings, in the same pass.
14. **Owner-run smoke turn** (spec §4.4). `$env:CUCKCODE_LIVE_SMOKE='1'; npm run codex:smoke`,
    then clear it. The result and its session log are committed. This is not a release review and
    produces no verdict. Merge `codex-currency` to `main`.

## What this plan does not establish

- Why passes 6–9 failed. The next failure is recorded; the old ones stay **unknown**.
- That 0.157.1 works for a thirteen-turn kickoff or a release review. Task 14 proves one turn.
- Any protection against a vendor change that keeps the schema identical but changes behavior. R3
  catches changes to the binary and the protocol, not to the backend.
