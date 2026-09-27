# Smoke allowance: one more smoke run, under the feature policy

Date: 2026-09-27
Source: the owner's in-session answer, "Smoke under the policy (Recommended)", to the question of
what this session takes on after the Codex follow-ups closed.

| Item | Ruling | What it means |
| --- | --- | --- |
| Smoke ledger budget | **Raised from 3 to 6.** | `docs/evidence/runtime/smoke-ledger.json` allows one more `codex:smoke` run: one turn and the two transport retries CX-4 permits a run. The Phase 5 ledger is untouched. |
| Purpose | **Prove the feature policy under a real turn.** | The first smoke (2026-09-26, `SMOKE_OK`) ran before the policy existed. This run is the first turn with 145 of 150 features off and the MCP enumeration in the binding, and it settles `secret_auth_storage`, left open by the 2026-09-27 ruling: an authentication failure reopens it as a keep. |
| Where | **The `codex-currency` worktree.** | The main copy is in active use by Phase 7-O; a run and a provenance write there would record that session's in-flight evidence. |

It precedes any budgeted run. The release review that failed in passes 6–9 waits on its result.

## Authority

A ruling on an allowance only. No code change.
