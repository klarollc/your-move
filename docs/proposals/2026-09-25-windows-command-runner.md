# Windows command runner — letting an agent run the gate without a human relay

**Status: PROPOSAL. Approves nothing and authorizes no implementation.** Drafting was authorized on
2026-09-25 (`docs/evidence/phase-7-o/decision-record-2026-09-25-spec-review.md`, row "Runner").

Author: agent, 2026-09-25. Housekeeping queue item 1, and agent-side problem 5 in the dogfood
framing: the agent cannot verify its own work.

## 1. The problem

- The agent's shell on the owner's computer is a Linux VM. The repo's `node_modules` is win32, Node
  is 22 against a `>=24.18.0` pin, and running `npm install` there broke the owner's tree once
  (DF-006).
- The cloud-container mirror covers contract, unit and component suites only. It cannot run
  integration (`better-sqlite3`), e2e, a11y or visual suites, and it is not the owner's toolchain.
- Computer use cannot type into terminals. It is granted only in click mode.
- The VM has no GitHub credentials, so every push is relayed.

The result is that every claim the agent makes about `verify`, `tsc` or browser suites waits on the
owner pasting output. That was roughly fifteen round-trips in one session. `tsc` is the only check
that catches a missing required field, and the agent cannot run it.

## 2. Proposal

A PowerShell script, `scripts/agent-runner.ps1`, **started by the owner in a visible terminal** and
stopped with Ctrl+C. While it runs, it:

1. Polls a gitignored inbox, `node_modules/.cache/agent-runner/inbox/`, for request files
   `{ "id": "...", "command": "<name>" }`. The agent writes them through the existing folder bridge.
2. Looks `command` up in an **allowlist** (`scripts/agent-runner.allowlist.json`). Each entry maps
   a name to a fixed argument array. **Requests carry no arguments.** Anything not on the list is
   refused and logged.
3. Runs one request at a time, with an argument array and never a shell string. That is the DF-014
   lesson: no tool is invoked through a shell.
4. Writes `outbox/<id>.json`: the command, exit code, start and end time, `git rev-parse HEAD`,
   `git status --porcelain` at start, and the path of a full stdout/stderr log.

### Initial allowlist

`verify`, `typecheck`, `typecheck:scripts`, `format:check`, `lint`, `test:unit`, `test:component`,
`test:contract`, `test:integration`, `test:e2e`, `test:a11y`, `test:visual`,
`phase5:provenance` (read-only check), and `git-status`.

`git-push` is included **only when the owner starts the runner with `-AllowPush`**. It pushes the
current working branch and `main` to `origin`, never with `--force`.

### Excluded, deliberately

- Anything that spends the live ledger or calls a provider: `CUCKCODE_LIVE_*`,
  `phase5:*:run`, `kickoff:run`, `roles:exercise`.
- Anything owner-run by governance: role and visual promotion (`CUCKCODE_OWNER_PROMOTION`),
  `phase5:c19:record`.
- Anything that writes evidence: `phase5:provenance:write`, `*:write`, and captures with
  `CUCKCODE_REGENERATE_EVIDENCE`.
- `npm install` and any arbitrary command.

The runner **refuses to start, and refuses each request, if any `CUCKCODE_LIVE_*`,
`CUCKCODE_OWNER_PROMOTION` or `CUCKCODE_REGENERATE_EVIDENCE` variable is set** in its environment.

## 3. Guards, written as tests rather than manual gates

- A `scripts/*.test.mjs` test asserts:
  - every allowlist entry names a script that exists in `package.json`;
  - no entry's script text contains a live, promotion or evidence-write marker;
  - the list of excluded markers is derived from `package.json`, not hand-copied.

  This follows the handoff's rule that a guard asserts against the definition it guards.
- The runner's request parsing is pure and can be tested with `node --test`. It rejects unknown
  commands, extra fields and oversized files.

## 4. What results mean

A runner result is the **owner's machine running the committed tree**, identified by commit hash
and a clean-tree check. When `git status --porcelain` is non-empty at start, the result is recorded
as a dirty-tree run and does not count as the gate for any commit. The owner's environment stays
the authority. The runner removes the relay; it does not move the authority.

## 5. Risks

- **Anything that can write to the inbox can trigger allowlisted commands while the runner is
  open.** That includes any agent session with this folder connected. The allowlist is the
  boundary, and the only external effect it permits is `git-push` under `-AllowPush`. The owner
  decides when the runner is open.
- A long `verify` can collide with the owner's own work in the same tree, for example on the
  preview server on port 4173. The runner refuses a request while another is running.

## 6. Decisions requested

| ID | Question | Agent recommendation |
| --- | --- | --- |
| W-1 | Authorize a plan and tasks for the runner as specified | Yes |
| W-2 | Include `git-push` behind `-AllowPush` | Yes |
| W-3 | Order relative to Phase 7-O | Before Phase 7-O implementation, so the Phase 7-O RED/GREEN evidence can be produced without a relay |
