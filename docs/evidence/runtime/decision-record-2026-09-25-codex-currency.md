# Keep CuckCode current with Codex, and make runtime failures diagnosable — owner ruling

Date: 2026-09-25
Source: owner's in-session reply to the diagnosis of release-review passes 6–9 and DF-021:
"items 1-6 Approved, explicit approval to keep CuckCode current with Codex. Target the current
version, proceed to spec then plan then tasks".

| Item | Ruling |
| --- | --- |
| Policy | **Keep CuckCode current with Codex.** This reverses the same-day choice not to re-pin recorded under DF-021. It does not reopen Phase 5 acceptance, which rests on the pass-5 verdict. |
| 1 | **Approved.** Codex is installed as a project dependency at an exact version; the desktop app's bundled binary is no longer the runtime. |
| 2 | **Approved.** One declared pin; every consumer derives from it. |
| 3 | **Approved.** A drift preflight with no provider call: binary version and regenerated schema hash against the pin. |
| 4 | **Approved.** A deliberate upgrade command that reports the change to the surface CuckCode consumes. |
| 5 | **Approved.** Unknown turn item types stop a run rather than pass as text. |
| 6 | **Approved.** Full failure classification recorded, activity-aware turn timeout with interrupt, server requests answered rather than dropped, session diagnostics preserved, one bounded retry for transport-class failures. |
| Target | **"The current version."** Interpreted as npm `latest`, `@openai/codex@0.157.1` on 2026-09-25. The desktop app carries 0.156.1. Confirmation requested as decision CX-1 in the specification. |

Authority: specification only. The specification needs approval before a plan; the plan and task
list need approval before any code changes. No live provider call is authorized by this ruling.

## Specification approved

Later the same day. Source: owner's in-session reply, "approved", to
`docs/codex-runtime-currency-spec-v0.1.md` and its decisions CX-1 to CX-6.

| Item | Ruling |
| --- | --- |
| Specification v0.1 | **Approved.** |
| CX-1 | **0.157.1.** |
| CX-2 | **Text:** `agentMessage`, `reasoning`, `userMessage`, `plan`, `contextCompaction`. **Effect:** every other type in the pinned vocabulary. |
| CX-3 | **180 s idle, 15 min hard cap**, one value set for all live scripts. |
| CX-4 | **One transport retry per turn, two per run, 30 s backoff;** a retried attempt counts against the ledger and is recorded with `transportRetry: true`. |
| CX-5 | **`docs/evidence/runtime/sessions/<script>/<ISO timestamp>-<roleId>.jsonl`**, committed; deltas excluded and counted. |
| CX-6 | **`packages/runtime-codex/package.json` `devDependencies`.** |

Authority: an implementation plan only. No code change until the plan and task list are approved.

## Plan approved

Later the same day. Source: owner's in-session reply, "approved", to
`tasks/codex-currency-plan.md` and its decisions CP-1 to CP-4.

| Item | Ruling |
| --- | --- |
| Plan | **Approved.** |
| CP-1 | **Worktree** at `.worktrees/codex-currency`, branch `codex-currency`, excluded through `.git/info/exclude`; its own install and runner. |
| CP-2 | **Smoke turn:** `release-reviewer` on `gpt-5.6-sol`, `npm run codex:smoke` behind `CUCKCODE_LIVE_SMOKE=1`, own ledger `docs/evidence/runtime/smoke-ledger.json`, budget 3. |
| CP-3 | **One shared turn runner** for the kickoff session and the role exercise. |
| CP-4 | **`verify` runs `protocol:codex:drift`**, and so requires the dependency installed. |

Authority: a task checklist only. No code change until `tasks/codex-currency-todo.md` is approved.

## Task checklist approved

Later the same day. Source: owner's in-session reply, "approved, new runner is live", to
`tasks/codex-currency-todo.md`. Tasks are authorized in order as the checklist states. The owner
reported Task 1's worktree created and its runner started.
