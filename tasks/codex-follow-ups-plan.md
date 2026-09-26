# Implementation plan: Codex currency follow-ups

Status: **OWNER-APPROVED 2026-09-26.** Written under the approval of
`docs/codex-follow-ups-spec-v0.1.md` (FU-1 to FU-4 as recommended, 2026-09-26). No task is
authorized until `tasks/codex-follow-ups-todo.md` is also approved.

Where: branch `codex-currency`, worktree `.worktrees/codex-currency`, before the merge. Task 7 runs
on `main` after the merge.

## Checked before planning, with no provider call

In the container, with the pinned 0.157.1 and no credential: `thread/start` accepted a `config`
disabling all 38 features FU-1 disables, including the dotted `guardianv2.thread_context` as a
nested key, and `mcpServerStatus/list` answered `{"data":[]}`. That the override stops
`codex_apps` in a signed-in session is **not** established; Task 6's probe establishes it.

## Design

| Module                                                                  | Change                                                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/agent-runner.allowlist.json`                                   | Six entries (F4).                                                                                                                  |
| `packages/runtime-codex/src/session-log.ts`                             | Identity redaction and home-path folding (F3); header `redaction: "v1"`.                                                           |
| `scripts/redact-held-session-log.ts`                                    | One-shot: the held smoke log through the same redaction, written with `redactedAfterCapture: true` (F3.4).                         |
| `scripts/evidence-line-endings.test.mjs`                                | The CR guard (F2.1), added to `test:ui-contract` (FU-4).                                                                           |
| `scripts/generate-codex-protocol.mjs`, `scripts/codex-surface-diff.mjs` | The upgrade writes `features.json`, also when the bundle already exists; the diff flags new or changed default-on features (F1.2). |
| `packages/runtime-codex/src/feature-policy.ts`                          | `FEATURE_POLICY` and the `features` config it yields (F1.1, FU-1, FU-2), tested against the pinned `features.json`.                |
| `role-exercise.ts` (`exerciseThreadStartParams`)                        | Carries the feature config, so every caller inherits it.                                                                           |
| `supervisor.ts`                                                         | `mcpServerStatus/list` joins `ALLOWED_REQUEST_METHODS` (read-only).                                                                |
| `packages/contracts/src/runtime.ts`                                     | `observedMcpServers: Array<{ name, status, toolNames }>                                                                            | null`on the strict`RuntimeBindingReport` (FU-3). |
| `binding.ts`, `phase4-kickoff-session.ts`, `role-exercise.ts`           | Enumerate after `thread/start`, report, refuse `TOOL_SURFACE_PRESENT` (F1.3, F1.4).                                                |
| `persistence/runtime-trust-store` tests, `fake-app-server.mjs`          | Follow the contract; the fake answers `mcpServerStatus/list`, with a mode that reports a server.                                   |
| `scripts/run-codex-probe-surface.ts`                                    | The owner-run probe (F1.5).                                                                                                        |

## Task sequence

RED before GREEN against a deliberate stub, recorded in
`docs/evidence/runtime/codex-currency/red-green-log.md` under a new heading, before GREEN. Each
task's gate is a runner `verify` on a clean tree. Evidence writes are batched so the owner runs
`phase5:provenance:write` twice in all (Tasks 3 and 6).

1. **Allowlist (F4).** RED: a runner test that requires the six entries, against today's file.
2. **Session-log redaction (F3.1–F3.3, F3.5).** RED: the fixture test against the unchanged
   redaction.
3. **CR guard, worktree bytes, redacted smoke log, re-record (F2.1–F2.3, F3.4).** RED: the guard
   against the worktree as it stands (twelve CRLF files; real code, stated as such). Then the twelve
   return to LF, the redacted smoke log is written, and **the owner runs `phase5:provenance:write`**
   once, covering twelve re-records and one new log.
4. **`features.json` in the upgrade (F1.2).** RED: surface-diff fixture tests for a new default-on
   feature. Then **the owner reruns `npm run protocol:codex:upgrade -- 0.157.1`**, which checks the
   existing bundle's hash and writes `features.json`.
5. **Feature policy and enumeration (F1.1, F1.3, F1.4, FU-3).** RED: the policy-vs-`features.json`
   guard; the contract field; the thread/start config; `TOOL_SURFACE_PRESENT` against a fake that
   reports a server. The contract change runs through contracts, binding, persistence and
   role-exercise suites.
6. **The probe (F1.5, F1.6).** The script, rehearsed against the fake server. Then **the owner runs
   `$env:CUCKCODE_LIVE_PROBE='1'; npm run codex:probe-surface`**. **Stop condition:** if the policy
   session still shows `codex_apps`, or the control does not, work stops for a ruling. The record
   and its log are evidence: **the owner runs `phase5:provenance:write`**. Records: DF-027's
   product response, the decision record, and the checklist.
7. **After the merge, on `main` (F2.4).** The main copy's twelve files are converted to LF in place,
   after checking each differs only by line endings. `verify` on `main`.

## Risks, stated

- **The contract change does not reach committed evidence** (checked): `runtimeBindingReportSchema`
  is applied only when a new report is written to the trust store
  (`persistence/src/runtime-trust-store.ts`) and in the contract tests. The committed Task 17 run
  artifacts are never parsed against it. Existing trust-store fixtures gain the field.
- **A kept feature may depend on a disabled one.** Offline, `thread/start` accepted the full disable
  config, but only a signed-in `thread/start` shows whether anything the policy keeps misbehaves.
  The Task 6 probe is where that shows; it spends no turn.
