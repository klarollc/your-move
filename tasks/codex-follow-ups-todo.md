# Codex currency follow-ups checklist

Status: **OWNER-APPROVED 2026-09-26.** Tasks 1–7 are authorized in order; the owner steps are
marked.
Plan: `tasks/codex-follow-ups-plan.md`, **owner-approved 2026-09-26**.
Specification: `docs/codex-follow-ups-spec-v0.1.md`, **owner-approved 2026-09-26**, FU-1 to FU-4
as recommended.
Authority: `docs/evidence/runtime/decision-record-2026-09-26-codex-follow-up-rulings.md`.

## Rules for every task

The rules of `tasks/codex-currency-todo.md` apply unchanged: worktree only; RED as an assertion
failure against a deliberate stub, recorded before GREEN in
`tasks/codex-follow-ups-red-green.md` (appended to
`docs/evidence/runtime/codex-currency/red-green-log.md` at Task 3, before the provenance write),
never re-run; the
gate is a runner `verify` on a clean tree, counts read from the run's log; no installs from an agent
shell; stop and ask on any doc/code disagreement or a file outside a task's list; historical
evidence is never rewritten. **No live provider turn** anywhere in this checklist; Task 6 opens a
signed-in session but never starts a turn.

## Tasks

- [x] **Task 1 — Runner allowlist (F4).**
  - Files: `scripts/agent-runner.allowlist.json`, `scripts/agent-runner.test.mjs`, `README.md`,
    `docs/HANDOFF.md`.
  - Acceptance: `check:toolchain`, `test:toolchain`, `test:protocol`, `protocol:codex:check`,
    `protocol:codex:drift`, `test:runtime` are allow-listed and pass every existing guard unchanged;
    README and HANDOFF state that a commit's gate is still a full `verify`.
  - RED: a test requiring the six entries, against today's allowlist.
  - Verify: runner `verify`; then the runner itself answers `test:protocol` and
    `protocol:codex:drift` as a check that the entries work.
  - **Result:** `1e5fe74`. RED 1 against today's allowlist; GREEN 27/27; the existing guard accepts
    all six unchanged. **Gate:** runner `verify` exit 0, clean tree at `1e5fe74` — runner 27, unit
    461, others unchanged. **Pending:** the runner reads its allowlist once at startup, so the
    new entries work after the owner restarts it. **Done after the owner's restart:** the runner
    answered `test:protocol` (21/21, both bundles and the pin) and `protocol:codex:drift` (ok
    against the Windows `codex.exe`), each exit 0 on a clean tree at `6a3b67b`, in seconds.

- [x] **Task 2 — Session-log redaction (F3.1–F3.3, F3.5).**
  - Files: `packages/runtime-codex/src/session-log.ts` and its unit test.
  - Acceptance: `account/*` and `remoteControl/*` params become `{ "redacted": "identity" }` with
    method, sequence and timing kept; the home prefix becomes `~` in every string for `/`, `\` and
    doubled `\\` separators, case-insensitively on Windows; the header carries `redaction: "v1"`; a
    fixture shaped like the real smoke log (PC name, installation id, plan type, rate limits, both
    path forms) leaves none of them; existing redaction unchanged.
  - RED: the fixture test against today's redaction.
  - Verify: runner `verify`.
  - **Result:** `6a3b67b`. RED 1/7, then a refinement RED 1/8 (home folding needed a boundary);
    GREEN 8/8; two mutations caught. **Gate:** four runs; three failed on collisions with the main
    copy's runner (two C-10 overruns, one port-4173 refusal), recorded in the red-green log and
    DF-025. The fourth, queued after the main runner was idle, passed: `verify` exit 0, clean tree at
    `6a3b67b` — unit 463, component 73, integration 76 + 3 skipped, contract 77, e2e 50, a11y 46,
    visual 62.

- [x] **Task 3 — CR guard, worktree bytes, redacted smoke log (F2.1–F2.3, F3.4).**
  - Files: `scripts/evidence-line-endings.test.mjs`, `package.json` (`test:ui-contract`),
    `scripts/redact-held-session-log.ts`,
    `docs/evidence/runtime/sessions/run-codex-smoke/2026-09-26T12-34-44-005Z-release-reviewer.jsonl`.
  - Acceptance: the guard fails naming any text file under `docs/evidence/` with a CR byte and skips
    binary files; the twelve worktree files return to their committed LF bytes (nothing committed
    for them); the redacted smoke log carries `redactedAfterCapture: true` and passes Task 2's
    assertions; the original stays in `.cuckcode/`.
  - RED: the guard's synthetic cases against a stub, and the guard against the worktree as it stands
    (twelve CRLF files; real code, stated as such).
  - **Owner:** `npm run phase5:provenance:write` — twelve re-records and one new record. The agent
    checks each digest against the bytes before committing.
  - Verify: runner `verify`, `phase5:provenance` with no stale digests.
  - Result (2026-09-26): code `1804ce7`, ledger `d95a52a`. The owner's write added 15 records, not
    the 13 planned: the twelve re-records, the new redacted log, and records for the two edited
    evidence files (`runtime/codex-currency/red-green-log.md`, `dogfood-register.md`), which the
    checklist did not count. All 15 digests and byte counts match the bytes; none has a CR byte.
    `fu3-prov-01`: exit 0, `staleDigests` and `missingFromLedger` both empty. `fu3-verify-01`
    at `d95a52a`: exit 0, not dirty, evidence unchanged; the guard's 5 tests pass, including the
    real-tree test. Queued after main's `task8b-verify-01` had finished and its runner was idle.

- [ ] **Task 4 — Features in the upgrade (F1.2).**
  - Files: `scripts/generate-codex-protocol.mjs`, `scripts/codex-surface-diff.mjs` and its test,
    `packages/runtime-codex/protocol/0.157.1/features.json`.
  - Acceptance: the upgrade writes `features.json` (name, stage, default) whether or not the bundle
    already exists; the surface diff flags a new or changed default-on feature for ruling; the
    existing bundle hash is still checked, never rewritten.
  - RED: surface-diff fixture tests for a new and a changed default-on feature.
  - **Owner:** `npm run protocol:codex:upgrade -- 0.157.1`.
  - Verify: runner `verify`.

- [ ] **Task 5 — Feature policy and enumeration (F1.1, F1.3, F1.4, FU-1 to FU-3).**
  - Files: `packages/runtime-codex/src/feature-policy.ts` and its test, `role-exercise.ts`,
    `supervisor.ts`, `binding.ts`, `packages/contracts/src/runtime.ts` and its contract test,
    `scripts/phase4-kickoff-session.ts`, `fixtures/fake-app-server.mjs`, the persistence
    trust-store tests, and the binding and role-exercise tests.
  - Acceptance: `FEATURE_POLICY` classifies exactly the pinned `features.json`, keeping only
    `content_item_kinds`, `enable_request_compression`, `system_proxy_fallback`, `fast_mode` and
    `unbounded_connection_retries`; every `thread/start` carries the resulting disable config;
    `mcpServerStatus/list` is allow-listed and called after `thread/start`; the report carries
    `observedMcpServers` and keeps `toolIds: null`; a session whose enumeration is not empty refuses
    with `TOOL_SURFACE_PRESENT` naming the servers; `CODEX_ARGS` unchanged.
  - RED: the policy guard against a stub table; the contract field; the config in thread/start
    params; the refusal against a fake mode that reports a server.
  - Verify: runner `verify`.

- [ ] **Task 6 — The probe (F1.5, F1.6).**
  - Files: `scripts/run-codex-probe-surface.ts`, its pure core and test, `package.json`
    (`codex:probe-surface`), the probe record under `docs/evidence/runtime/probe/`, its session log,
    `docs/evidence/dogfood-register.md` (DF-027), the decision record, this checklist.
  - Acceptance: refuses without `CUCKCODE_LIVE_PROBE=1`; runs the drift preflight; one signed-in
    session, `thread/start` twice (control without the policy, then with it), each followed by
    `mcpServerStatus/list`; never calls `turn/start`; touches no ledger; rehearsed against the fake
    server first; the runner cannot run it.
  - **Owner:** `$env:CUCKCODE_LIVE_PROBE='1'; npm run codex:probe-surface`, then
    `Remove-Item Env:CUCKCODE_LIVE_PROBE`; then `npm run phase5:provenance:write`.
  - **Stop condition:** the policy session still shows `codex_apps`, or the control does not.
  - Verify: runner `verify`.

- [ ] **Task 7 — On `main`, after the merge (F2.4).**
  - Convert the main copy's twelve files to LF in place, after checking each differs only by line
    endings; no provenance write (the ledger already holds the LF digests); owner runs `verify` on
    `main`.
