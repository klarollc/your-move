# Tracer task contract — draft v0.2

Status: **Draft 2026-10-03. Used for tracer attempt 1, which ended
`TRACER_INSTRUCTION_SOURCE_MISMATCH` with 0 turns (contract hash `f0f9e3fb…`). Each further attempt is
owner-started and awaits owner review.** Supersedes `tracer-task-contract-draft.md` (v0.1, left
untouched).
Task (owner-approved): the DF-007 proposed test — every canonical record type carries a validated
timestamp or a stated exemption.

Note what the tracer's real product is: not the test, but the DF entries from directing real work
through the office. The test is the vehicle.

## What changed from v0.1

- **Write posture ruled 2026-10-03: scoped file edits.** The role edits files inside the
  worktree; it does not run commands. Every other effect type stops the run.
- **Consequence the owner should see:** because the role cannot run commands, it cannot observe
  RED or GREEN itself. The RED/GREEN evidence obligation below is met by the owner (or a
  separately authorized session) running the focused test between turns and attempts.
- **Windows sandbox mode ruled 2026-10-03 (DF-043): `unelevated`.** The controlled home carries no
  `config.toml`, so without an explicit mode the runtime reports `readOnly` for a requested
  `workspace-write` (attempt 2, zero turns). The runner now sends `windows.sandbox = "unelevated"`
  with `thread/start` and records the mode on every attempt. Probe evidence:
  `docs/evidence/tracer/sandbox-probe-2026-10-04T04-*.json`.
- **Off-repo references are marked.** `DF-042`, "V1 verified FAILED", "C-1" and "C-4" appear in
  v0.1 but not in the repository (the register ends at DF-030). The owner confirmed them
  2026-10-03; their source is a thread with Muse, not a repo file. They are marked
  _owner-confirmed, source off-repo_ below. DF-042 should still be entered into the register.

## Bounded work contract (D-26 fields)

- **Outcome:** a test in `verify` asserting every canonical record type (domain + contracts
  schemas) carries a validated timestamp or a stated exemption; every currently-known type fixed
  or exempted with a reason; `verify` green.
- **Exclusions:** no MDD amendments; no changes to already-ruled stored exemptions
  (`content_manifests`, `packet_receipts`, `provider_identities` — DF-030); no new infrastructure
  or harnesses; no scope beyond record types (if a type needs a design decision, escalate
  instead); no changes outside the worktree.
- **Acceptance criteria:**
  1. The test enumerates canonical record types from the schemas (not a hardcoded list —
     DF-015's lesson).
  2. It fails on any type without a validated timestamp or a stated exemption.
  3. All known types pass at completion.
  4. Full `verify` green on a clean tree (owner-run, per DF-022 practice).
- **Dependencies:** _(owner-confirmed 2026-10-03, source off-repo)_ V1 verified FAILED 2026-10-03: the office
  exposes no work-item creation/assignment affordance, recorded as DF-042. Assignment therefore
  goes through the role-exercise machinery, with the office gap documented, not hidden. Owner
  starts the runner; a live Codex role bound under the pinned runtime (drift green, confirmed
  2026-10-03). The runner additionally requires a **linked, clean worktree** and refuses
  otherwise.
- **Evidence obligations:** recorded RED (test fails first on a known-missing type), then GREEN;
  no re-run of RED after GREEN (HANDOFF rule). **Run by the owner between turns/attempts**, since
  the role has no command ability. The runner records, per turn: item types, every file change,
  and `git status` of the worktree; one hashed transcript per attempt.
- **Permission ceiling:** `workspace-write` sandbox, approval policy `never`, network off,
  read back from `thread/start` and refused if different. File edits only, every path inside the
  worktree (`.git` excluded). Windows sandbox mode `unelevated` (owner ruling 2026-10-03), also
  read back as `workspaceWrite`. Any command, MCP call, web search, subagent, or edit outside the
  worktree stops the run. No promotion, no push (all owner-run).
- **Residual surface (stated, not hidden):** `workspace-write` also makes the temp directory
  writable, and `thread/start` accepts only a sandbox _mode_, not a narrower root list. The
  post-turn check sees only edits the runtime reports as file changes; a stray write under the
  temp directory would not be detected. The `unelevated` mode is the weaker Windows boundary: per
  the Codex documentation it "runs commands with a restricted Windows token derived from your
  current user" and applies ACL-based filesystem boundaries, where `elevated` uses dedicated
  lower-privilege sandbox users and firewall rules. The tracer accepts that weaker preventive
  control because the role is barred from commands, and the runner stops on any non-edit item. The
  reported posture does not show that edits succeed; the first live turn is the first test of that.
- **Turn budget _(owner-confirmed 2026-10-03, source off-repo)_:** 10 turns per attempt, up to 3 attempts (30
  total). Owner review between attempts; no auto-retry. A transport re-submission counts as a
  turn. Recorded as the tracer's own allowance, separate from the Phase 5 60-turn ledger.
- **Stop conditions:** scope exceeds a few turns; a needed exemption requires an owner ruling;
  assignment has no UI surface (that finding becomes part of the tracer's result); any live-run
  failure the contract didn't anticipate; any effect the permission ceiling forbids. On any stop
  condition: halt, record, escalate — do not improvise scope.
- **Definition of done:** test green in `verify`; every friction encountered during the slice
  recorded as a DF entry; manager approval of the result through the office.

## Slice protocol (how the office directs it)

1. Manager tasks the role through the role-exercise machinery (the office cannot create/assign
   work items; the workaround is documented here, not hidden).
2. The bound role edits files in the worktree; questions go through the attention rail / open
   questions.
3. The owner runs the focused test, then approves or redirects against the evidence.
4. Every off-office fallback is logged as a DF entry — that log is the deliverable that matters.

## Live-run protocol (delivered to the role in `baseInstructions`)

- You work in a linked repo worktree, never the owner's live working copy.
- Budget: 10 turns per attempt. Make steady progress; do not gold-plate.
- Edit files only inside the worktree. Do not run commands, use the network, or call any tool
  other than editing files.
- If you need an owner ruling (a new exemption, a design decision), stop and say so rather than
  inventing scope.
- End your final turn with exactly one line **starting a line** with `TRACER_RESULT:` followed by
  `done` or `blocked` and a one-line summary, e.g.
  `TRACER_RESULT: done — timestamp test written, 2 types exempted with reasons.`
  The runner stops at that line or at the turn cap, whichever comes first. (`done` here means
  "the role believes the edit is complete"; green is established by the owner's run.)

## What "V2 unknown" means operationally

The 5-A record says implementation was driven conventionally; no live role has done sustained
implementation work. If the role stalls, degrades, or can't complete: that is a successful tracer
result (V2 answered "no" for this shape), recorded as DF entries, not a failure to hide.
