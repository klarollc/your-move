# Implementation plan: agent command runner

Status: **DRAFT FOR OWNER APPROVAL.** Authorized for planning by W-1 to W-3,
`docs/evidence/phase-7-o/decision-record-2026-09-25-spec-approval.md`. No implementation is
authorized until this plan and `tasks/agent-runner-todo.md` are approved.
Specification: `docs/proposals/2026-09-25-windows-command-runner.md`, approved as W-1.
Sequencing: before Phase 7-O implementation (W-3).

## Outcome

The owner starts one command in a visible terminal. While it runs, an agent can request any
allow-listed check, including `npm run verify` and `git push` when enabled, on the owner's Windows
toolchain. It receives a machine-readable result with the commit hash and a full log. No command
outside the allowlist can run, and no request can carry arguments.

## One deviation from the proposal, for approval

**Decision AR-1: implement the runner in Node, not PowerShell.** The proposal named
`scripts/agent-runner.ps1`. This plan proposes `scripts/agent-runner.mjs`, started from PowerShell
with `node scripts/agent-runner.mjs` (or `-- --allow-push`). Reasons:

- The request parser, allowlist check, environment refusal and result writer become pure Node
  modules. They are testable with `node --test` inside `verify`, and runnable from the agent's Linux
  shell with no install, like the other `scripts/*.test.mjs`. A PowerShell implementation would need
  Pester, which the repo does not have, or would go untested.
- **Spawning without a shell (DF-014) needs care on Windows.** Since the Node CVE-2024-27980 fix,
  `spawn("npm.cmd", …)` without `shell: true` fails. The runner instead spawns `process.execPath`
  with the `npm-cli.js` that ships beside `node.exe`, and resolves that path once at startup. If it
  cannot be found, startup refuses; it never falls back to a shell. `git.exe` spawns directly.

The behavior, allowlist, exclusions and guards are unchanged from the approved proposal.
**Recommendation: approve AR-1.** If declined, the plan reverts to PowerShell and adds Pester as a
dev dependency. That dependency addition would itself need approval.

## Design

| Module                                | Kind | Responsibility                                                                                                                               |
| ------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/agent-runner.allowlist.json` | data | name → `{ kind: "npm", script }` or `{ kind: "git", args }`. No other kinds.                                                                 |
| `scripts/agent-runner-core.mjs`       | pure | `parseRequest`, `resolveCommand`, `refuseEnvironment`, `formatResult`, `isStale`. No I/O.                                                    |
| `scripts/agent-runner.mjs`            | I/O  | Startup checks, inbox poll (1 s), single-flight execution, log capture, outbox write, Ctrl+C exit. Spawner injected so tests can use a fake. |
| `scripts/agent-runner.test.mjs`       | test | Everything below. Runs as `npm run test:runner`, added to `verify` beside `test:scaffold`.                                                   |

**Paths**, all under the already-ignored `node_modules/`:

- `node_modules/.cache/agent-runner/inbox/<id>.json`
- `node_modules/.cache/agent-runner/outbox/<id>.json`
- `node_modules/.cache/agent-runner/logs/<id>.log`

**Request:** `{ "id": "^[a-z0-9-]{8,64}$", "command": "<allowlisted name>" }`. Nothing else: extra
keys are refused, and files over 1 KB are refused. A request older than 10 minutes at pickup is
refused as stale.

**Result:** `{ id, command, status: "completed" | "refused", exitCode, startedAt, endedAt, head,
porcelain, dirty, logPath, refusal? }`. Git is run at the start of every request, so the result
says which tree was tested and whether it was clean. A dirty-tree result never counts as the gate
for a commit (proposal §4).

**Environment refusal:** any variable matching `CUCKCODE_LIVE_*`, `CUCKCODE_OWNER_PROMOTION` or
`CUCKCODE_REGENERATE_EVIDENCE` refuses startup and every request. The child process gets an
environment with those variables removed, so even a race cannot pass them through.

**Push:** `git-push` exists only with `--allow-push`. Its argv is fixed:
`push origin <current branch> main`, where the branch comes from `git rev-parse --abbrev-ref HEAD`
at request time. A detached HEAD is refused. No `--force` form exists in any code path, and a test
asserts that over every allowlist entry.

## Task sequence

Every behavioral change follows RED → GREEN → REFACTOR. Each RED is a failing assertion against a
deliberate stub, not a parse or import failure.

1. **Allowlist and its guard.** The allowlist file, and tests that:
   - every `npm` entry names a script present in `package.json`;
   - no entry's resolved script text contains a live, promotion or evidence-write marker;
   - the set of excluded scripts is derived from `package.json` by those markers, not hand-listed;
   - no entry anywhere contains `--force`.

   RED: a stub allowlist naming `phase5:release:run`.

2. **Request parsing and staleness.** `parseRequest` and `isStale`: valid, unknown command, extra
   key, bad id, oversized, non-JSON, stale.
3. **Environment refusal.** `refuseEnvironment` for each marker family, plus the scrubbed child
   environment.
4. **Execution with a fake spawner.**
   - argv is an array and `shell` is never true;
   - `npm` entries spawn `process.execPath` with `npm-cli.js`;
   - one request runs at a time, and the second waits;
   - the result records head, porcelain and the dirty flag;
   - a missing `npm-cli.js` refuses startup.
5. **Push gating.** `git-push` is absent without the flag, uses the fixed argv with it, and
   refuses a detached HEAD.
6. **Wiring.** Add the `agent:runner` and `test:runner` npm scripts, `test:runner` inside `verify`,
   and a `README.md` operational note. Amend `docs/HANDOFF.md`'s operational section in the same
   pass.
7. **Owner-run smoke test and cross-check.** The owner starts the runner. The agent requests
   `git-status`, `test:unit`, and then `verify`. The counts must match the owner's own last direct
   run. A mismatch is a harness defect, not a pass. Record the outcome in the dogfood register as
   progress on agent-side problem 5.

## Out of scope

Running anything outside the allowlist, remote or scheduled operation, starting the runner
automatically, and any change to Phase 5, Phase 6 or Phase 7-O behavior.

## Risks

- Anything able to write the inbox can trigger allow-listed commands while the runner is open. The
  allowlist is the boundary; the only external effect is `git-push`, gated by a startup flag.
- `npm-cli.js` location varies by Node install method. Startup refuses rather than guesses. If the
  owner's install lays it out differently, Task 7 finds out immediately.
- The runner shares the working tree and port 4173 with the owner. It refuses while its own request
  is running, but it cannot see the owner's terminal. The owner should not run e2e by hand while a
  runner e2e is in flight.
