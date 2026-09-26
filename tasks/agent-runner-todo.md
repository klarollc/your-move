# Agent command runner checklist

Status: **OWNER-APPROVED 2026-09-25**, with the plan and AR-1. Tasks 1–6 are authorized; Task 7 is
owner-run.
Plan: `tasks/agent-runner-plan.md`
Authority: W-1 to W-3, `docs/evidence/phase-7-o/decision-record-2026-09-25-spec-approval.md`

## Blocking decision

- [x] **AR-1**: implement in Node (`scripts/agent-runner.mjs`) rather than PowerShell. **Approved
      by the owner 2026-09-25.**

## Tasks

- [ ] Task 1: Allowlist and guard.
  - Acceptance: every entry resolves to a real `package.json` script or a fixed git argv; no live,
    promotion, evidence-write or `--force` entry; exclusions derived from `package.json`.
  - Verify: `npm run test:runner`, with RED recorded against a stub naming `phase5:release:run`.
- [ ] Task 2: Request parsing and staleness.
  - Acceptance: only `{ id, command }` accepted; unknown, extra-key, bad-id, oversized, non-JSON
    and stale requests refused with a named reason.
  - Verify: `npm run test:runner`.
- [ ] Task 3: Environment refusal and a scrubbed child environment.
  - Verify: `npm run test:runner`.
- [ ] Task 4: Execution through an injected spawner.
  - Acceptance: argv array, never a shell; `npm` via `process.execPath` and `npm-cli.js`; one
    request at a time; result carries head, porcelain and dirty flag; missing `npm-cli.js` refuses
    startup.
  - Verify: `npm run test:runner`.
- [ ] Task 5: `git-push` behind `--allow-push`, fixed argv, detached HEAD refused.
  - Verify: `npm run test:runner`.
- [ ] Task 6: Wiring: `agent:runner` and `test:runner` scripts, `test:runner` in `verify`,
      README and HANDOFF notes.
  - Verify: the owner's `npm run verify` completes (last direct relay run).
- [ ] Task 7: **Owner-run.** Start the runner. Agent requests `git-status`, `test:unit` and
      `verify`. Counts are cross-checked against the owner's last direct run and recorded in the
      dogfood register.
