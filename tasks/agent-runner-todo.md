# Agent command runner checklist

Status: **OWNER-APPROVED 2026-09-25**, with the plan and AR-1. Tasks 1–6 are authorized; Task 7 is
owner-run.
Plan: `tasks/agent-runner-plan.md`
Authority: W-1 to W-3, `docs/evidence/phase-7-o/decision-record-2026-09-25-spec-approval.md`

## Blocking decision

- [x] **AR-1**: implement in Node (`scripts/agent-runner.mjs`) rather than PowerShell. **Approved
      by the owner 2026-09-25.**

## Tasks

- [x] Task 1: Allowlist and guard.
  - Acceptance: every entry resolves to a real `package.json` script or a fixed git argv; no live,
    promotion, evidence-write or `--force` entry; exclusions derived from `package.json`.
  - Verify: `npm run test:runner`, with RED recorded against a stub naming `phase5:release:run`.
  - Result, 2026-09-25: RED 8 of 9 assertion failures against a stub returning no violations (the
    ninth, "the committed allowlist passes", cannot fail against an empty stub and is not claimed as
    RED). GREEN 9/9. **Refinement, stated rather than hidden:** the plan said exclusions are derived
    from "markers" in resolved script text. A source grep for marker names matched a comment in
    `build-phase5-side-effect-review.ts` and would have excluded `verify` — the handoff's "guard
    that greps prose". The guard instead refuses a closure that invokes a non-test script file whose
    code reads `process.env.CUCKCODE_*`, plus `--write`, installs, inline env assignment and force
    flags in any command. Every live and promotion script, and browser-capture regeneration, is gated
    that way. **Limit:** an evidence writer with no env gate and no `--write` flag, such as
    `phase5:c19:record`, is kept out only by not being on the allowlist; the result's
    `evidenceChanged` flag would expose a run that wrote evidence.
- [x] Task 2: Request parsing and staleness.
  - Acceptance: only `{ id, command }` accepted; unknown, extra-key, bad-id, oversized, non-JSON
    and stale requests refused with a named reason.
  - Verify: `npm run test:runner`.
  - Result, 2026-09-25: RED 4 of 4 assertion failures. GREEN. Commands are looked up as own
    properties, so `toString` and `__proto__` are refused.
- [x] Task 3: Environment refusal and a scrubbed child environment.
  - Verify: `npm run test:runner`.
  - Result, 2026-09-25: RED 2 of 2. GREEN. **Stricter than planned:** every `CUCKCODE_*` variable is
    refused and scrubbed, case-insensitively, not only the three opt-in families —
    `CUCKCODE_CODEX_EXE` and `CUCKCODE_CODEX_AUTH` redirect the runtime, and an unnamed future
    variable should fail closed.
- [x] Task 4: Execution through an injected spawner.
  - Acceptance: argv array, never a shell; `npm` via `process.execPath` and `npm-cli.js`; one
    request at a time; result carries head, porcelain and dirty flag; missing `npm-cli.js` refuses
    startup.
  - Verify: `npm run test:runner`.
  - Result, 2026-09-25: RED 6 of 6 assertion failures. GREEN. Added beyond the plan: the result
    records `evidenceChanged` (status of `docs/evidence` before and after the run) and `branch`.
- [x] Task 5: `git-push` behind `--allow-push`, fixed argv, detached HEAD refused.
  - Verify: `npm run test:runner`.
  - Result, 2026-09-25: RED 4 of 5 assertion failures; the detached-HEAD test passed against the
    refusing stub and is not claimed as RED. GREEN 26/26 across Tasks 1–5.
  - Mutations, each confirmed applied before reading the result: `shell: true` (killed, 2 fail),
    allow-push check removed (killed), opt-in read ignored (killed, 2 fail), single-flight queue
    removed (killed), flag-shaped branch accepted (killed). **One survivor:** removing
    `scrubEnvironment` from the spawn. It is unreachable in the runner because a request is refused
    before spawning whenever a `CUCKCODE_*` variable is present; the scrub is a second layer, and the
    function itself is unit-tested. Recorded, not hidden.
- [x] Task 6: Wiring: `agent:runner` and `test:runner` scripts, `test:runner` in `verify`,
      README and HANDOFF notes.
  - Verify: the owner's `npm run verify` completes (last direct relay run).
  - Result, 2026-09-25: `test:runner` runs inside `verify` after `test:scaffold`;
    `agent:runner` starts the runner; README and HANDOFF notes added. Prettier and ESLint clean on
    the new files from the agent shell; 28/28 for `test:scaffold` and `test:runner` under Node 22.
    **Not yet verified:** the owner's full `npm run verify` on Windows.
- [ ] Task 7: **Owner-run.** Start the runner. Agent requests `git-status`, `test:unit` and
      `verify`. Counts are cross-checked against the owner's last direct run and recorded in the
      dogfood register.
