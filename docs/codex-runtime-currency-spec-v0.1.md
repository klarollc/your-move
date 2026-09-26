# Codex runtime currency and failure diagnosability — specification v0.1

**Status: OWNER-APPROVED 2026-09-25, with CX-1 to CX-6 as recommended.** Authority:
`docs/evidence/runtime/decision-record-2026-09-25-codex-currency.md`. Approval authorizes an
implementation plan only; the plan and its task list each need approval before any code changes.
Erratum 2026-09-25, after approval: §1 said "six scripts"; a recount while planning found seven.
No requirement changes. R6.7 was withdrawn by owner ruling on 2026-09-26; see §3.

## 1. Problem

Two faults were conflated as "the Codex connection is flaky".

**F-A, drift (deterministic, current blocker).** Every live script spawns the desktop app's
bundled `codex.exe`. The app updated it from 0.146.0 to 0.156.1, and every run now refuses at the
handshake (DF-021). The pin is written independently in the supervisor regex, seven scripts'
`protocolVersion`, the generator and the checker. `protocol:codex:check` stays green because it
checks the committed bundle, not the binary the harness spawns.

**F-B, undiagnosable failures (passes 6–9, cause unknown).** The harness discarded the evidence
that would have named the cause:

| # | Defect | Where |
| --- | --- | --- |
| B1 | Only `turn.error.message` is kept; `codexErrorInfo` (the failure class and HTTP status) and `additionalDetails` are dropped | `describeTurnCompletionFailure` |
| B2 | `error` notifications with `willRetry` are ignored, so Codex's own reconnect attempts are invisible | `CodexStdioSupervisor#acceptStdout` consumers |
| B3 | A fixed wall-clock wait (180 s kickoff/review, 90 s role exercise) that ignores whether the turn is streaming, and never sends `turn/interrupt` | `phase4-kickoff-session.ts`, `role-exercise.ts` |
| B4 | A server-initiated request (numeric `id` plus `method`) is taken for a response, dropped, and never answered; the turn would hang to timeout | `#acceptStdout` |
| B5 | The controlled `CODEX_HOME` and the in-memory `stderr` are discarded at close, taking Codex's own logs with them | `openKickoffSession`, run scripts |
| B6 | The external-effect rule is an allow-list of known effect types, kept in two copies; any unlisted item type counts as text | `EFFECT_ITEM_TYPES`, `EXTERNAL_EFFECT_ITEM_TYPES` |

Evidence gathered without a provider call, 2026-09-25:

- `npm i @openai/codex@0.146.0` (linux-x64) regenerates the committed bundle exactly: bundle hash
  `ad2276a8362863c4bcc4083ca33b4a300920419b4ef244689d84c7706f710197`, 275 of 275 files. The npm distribution is a valid source for the pin, and the
  generated schema does not vary by platform.
- 0.146.0 → 0.157.1 on the consumed surface is additive: no server request method added or removed;
  `Turn`, `TurnStatus`, `InitializeResponse` identical; `ThreadStartResponse` and `TurnStartParams`
  required fields unchanged; `ErrorNotification` unchanged in shape. New: `CodexErrorInfo` gains
  `rateLimitExceeded` and `misalignmentPolicyViolation`, `TurnError` gains `misalignment`,
  `ThreadItem` gains `functionCallOutput`. `thread/rollback` was removed (unused).
- The 0.146.0 item vocabulary already contains `imageView`, `subAgentActivity`, `hookPrompt`,
  `sleep`, `enteredReviewMode`, `exitedReviewMode` — none in the kickoff effect list. B6 is not
  hypothetical.

Pass 8's `error sending request for url` is a client-side send failure reported after Codex's
internal retries; it is an open, unresolved report class upstream on Windows. **This
specification does not claim to know why passes 6–9 failed and does not try to find out by
spending turns.** It makes the next failure name itself.

## 2. Scope

In: the Codex runtime package, the scripts that open Codex sessions, the protocol generator and
checker, the kickoff preflight, `verify`, the dogfood register.

Out: any live provider call beyond one smoke turn (§4.4, owner-run); Phase 5 re-review; any
change to roles, promotion, the D-25 budget shape, or `CODEX_ARGS`; a second runtime; historical
evidence (passes 1–9, Task 17 artifacts, the 0.146.0 bundle) — preserved unchanged.

## 3. Requirements

### R1 — Codex is a pinned project dependency (item 1)

- R1.1 `@openai/codex` is declared at an **exact** version (no range) in one workspace manifest;
  the lockfile's integrity hash is the provenance of the binary.
- R1.2 The executable is resolved from the installed platform package
  (`@openai/codex-<platform>-<arch>` → `vendor/<target-triple>/bin/codex[.exe]`) by module
  resolution, never by a hardcoded path.
- R1.3 `CUCKCODE_CODEX_EXE` may still override the path, but an override is subject to R3 exactly
  like the default; it cannot bypass the pin.
- R1.4 The desktop app's binary is not referenced anywhere outside historical evidence.
- R1.5 The installed platform package joins the existing `checkNativePlatform` family check, so a
  cross-platform install is caught the same way DF-006 is.
- R1.6 Installation is owner-run in PowerShell. No agent shell runs `npm install` against the
  mounted tree.

### R2 — One pin (item 2)

- R2.1 The pinned version is declared once: the exact version in R1.1.
- R2.2 Supervisor handshake check, `BindingExpectation.protocolVersion` in every live script,
  the protocol generator, the protocol checker and the bundle directory all derive from it.
- R2.3 A test fails if a Codex version literal appears in non-test source outside the declaration.
  Tests that exercise the comparison itself may use literals.
- R2.4 A test fails if `packages/runtime-codex/protocol/<pin>/` does not exist.
- R2.5 The 0.146.0 bundle stays in the tree as the historical record for Phases 4–5 evidence.

### R3 — Drift preflight, no provider call (item 3)

- R3.1 `npm run protocol:codex:drift` resolves the executable (R1.2/R1.3), runs `--version`, and
  refuses unless it equals `codex-cli <pin>`.
- R3.2 It regenerates the schema into a temporary directory and refuses unless the bundle hash
  equals the committed `protocol/<pin>/manifest.json`.
- R3.3 It is called by `kickoff:preflight`, by every live script before a session opens, and by
  `verify`. A refusal names the observed and expected values.
- R3.4 It makes no network request and spends no turn.

### R4 — Deliberate upgrade (item 4)

- R4.1 `npm run protocol:codex:upgrade -- <version>` runs against an owner-installed candidate and
  writes, without changing the pin:
  - the new bundle at `protocol/<version>/` with its manifest;
  - `protocol/<version>/surface-diff.md`: for the consumed surface (§5) — client methods used,
    server request methods, notifications read, `Turn`, `TurnStatus`, `TurnError`,
    `CodexErrorInfo`, `ThreadItem` types, `InitializeResponse`, the `thread/start` and
    `turn/start` params and responses — every addition, removal and change, generated
    programmatically (never hand-written; lesson 2).
- R4.2 The diff marks any new `ThreadItem` type or `CodexErrorInfo` variant as **requiring a
  classification ruling** (R5.3, R6.6) before the pin can move.
- R4.3 Moving the pin is a separate commit after owner ruling, followed by the rehearsal suite and
  the owner-run smoke turn (§4.4).

### R5 — Unknown item types stop a run (item 5)

- R5.1 One classification table, exported from `@cuckcode/runtime-codex`, maps every `ThreadItem`
  type in the pinned schema to `text` or `effect`. Both the kickoff session and the role exercise
  consume it; the two local sets are deleted.
- R5.2 An item whose type is not in the table stops the turn as an observed effect with code
  `UNCLASSIFIED_ITEM_TYPE` naming the type.
- R5.3 A test fails if the pinned schema's `ThreadItem` vocabulary and the table's keys differ.
- R5.4 The role exercise's stricter rule (exactly one `agentMessage`) is unchanged.

### R6 — Failures are recorded, bounded and interruptible (item 6)

- R6.1 **Classification recorded.** A failed turn records `codexErrorInfo` (variant and
  `httpStatusCode`), `additionalDetails`, and `message`, verbatim.
- R6.2 **Retries visible.** Every `error` notification for the turn is recorded in order with
  `willRetry`, its classification and a monotonic timestamp.
- R6.3 **Activity-aware wait.** The turn wait ends on `turn/completed` for its turn id, or when
  no notification for its thread and turn has arrived for the **idle limit**, or at the **hard
  cap**. Values are decision CX-3.
- R6.4 **Interrupt on expiry.** On either limit the harness sends `turn/interrupt`, waits a bounded
  interval for `turn/completed` with status `interrupted`, and records `TURN_IDLE_TIMEOUT` or
  `TURN_HARD_TIMEOUT` with the elapsed time and the last notification method seen.
- R6.5 **Server requests answered.** A message with both `id` and `method` is a server request.
  The supervisor answers it with a JSON-RPC error and fails the active turn with
  `SERVER_REQUEST_REFUSED` naming the method. Nothing is silently dropped.
- R6.6 **Transport retry.** A turn that fails with `httpConnectionFailed`,
  `responseStreamConnectionFailed`, `responseStreamDisconnected` or
  `responseTooManyFailedAttempts`, and produced no output items, may be re-submitted once after a
  backoff. Budget and limits are decision CX-4. Any other class is never retried by the harness.
- R6.7 **`retryable` is truthful.** Where the normalizer emits `retryable`, it is derived from the
  R6.6 transport classes instead of the hardcoded `false` (closes C-1 F4 for Codex).
  **Withdrawn 2026-09-26, owner ruling during Task 11.** The premise was wrong: the normalizer's
  hardcoded `retryable: false` sits only on its two parse-failure codes (unsupported and malformed
  event), where `false` is true; Codex's `error` notification becomes a `runtime.error` event, and
  the contract gives that event no `retryable` field. `normalizeCodexEvent` also has no caller
  outside its own tests. C-1 F4 stays open until a consumer needs a retryable `runtime.error`. The
  failure class and transport flag live in the run records (R6.1).
- R6.8 **Diagnostics preserved.** Before the controlled home is disposed, the session's supervisor
  stderr (already redacted) and its notification stream, excluding `*/delta` payloads but counting
  them, are written to the location in decision CX-5. The credential is never copied out.

### R7 — Records

- R7.1 Run artifacts (release-review pass, kickoff run, role exercise) gain the R6 fields
  additively; existing schemas stay readable and historical files are not rewritten.
- R7.2 DF-021's "product response" is updated to point at R3. A new dogfood entry records B1–B6 as
  an agent-side problem: *the harness kept its own summary of a failure and threw away the
  provider's classification of it.*

## 4. Verification

4.1 RED–GREEN for every behavioral requirement, against the existing fake app server
(`packages/runtime-codex/src/fixtures/fake-app-server.mjs`) extended to emit: `error` notifications
with and without `willRetry`; a failed turn carrying each transport class; a slow but streaming
turn (must not time out); a silent turn (must idle-time-out and receive `turn/interrupt`); a server
request (must be answered and fail the turn); an unclassified item type.

4.2 R2.3, R2.4, R3 and R5.3 are executable governance guards in `verify`.

4.3 Container runs are inner-loop only. The gate is the owner's full `npm run verify` on Windows,
reported with the command beside the count.

4.4 One owner-run live smoke turn at the new pin, text-only, one role, recorded with the R6 fields,
before any budgeted run. It is not a release review and produces no verdict.

## 5. Consumed surface (the definition R4 diffs against)

Client requests: `initialize`, `account/read`, `thread/start`, `turn/start`, `turn/interrupt`,
`thread/read`. Client notification: `initialized`. Server notifications read: `turn/completed`,
`error`, plus every notification carrying the active thread and turn id (liveness only). Server
requests: all (each is refused, R6.5). Types: `InitializeResponse`, `ThreadStartParams/Response`,
`TurnStartParams/Response`, `Turn`, `TurnStatus`, `TurnError`, `CodexErrorInfo`, `ThreadItem`,
`GetAccountResponse`.

## 6. Decisions requested

| ID | Question | Recommendation |
| --- | --- | --- |
| CX-1 | Target version | **0.157.1** (npm `latest` on 2026-09-25). Surface diff above is additive. |
| CX-2 | Item classification for R5.1 | `text`: `agentMessage`, `reasoning`, `userMessage`, `plan`, `contextCompaction`. `effect`: everything else in the pinned vocabulary, including `functionCallOutput`, `imageView`, `subAgentActivity`, `hookPrompt`, `sleep`, review-mode items. Conservative: a wrong `effect` costs a stopped turn, a wrong `text` costs the no-external-effect guarantee. |
| CX-3 | Idle limit / hard cap | **180 s idle, 15 min hard cap**, one value set for all live scripts. Replaces 90 s / 180 s wall clocks. |
| CX-4 | Transport retry budget | **One retry per turn, two per run, 30 s backoff. A retried attempt counts against the ledger** (the provider may have billed it; the ledger must never under-report spend) and is recorded as a separate attempt with `transportRetry: true`. |
| CX-5 | Diagnostics location | `docs/evidence/runtime/sessions/<script>/<ISO timestamp>-<roleId>.jsonl`, committed. Deltas excluded, counted. |
| CX-6 | Where the pin is declared | `packages/runtime-codex/package.json` `devDependencies`, since that package owns the supervisor. |

## 7. Known risks, not addressed here

- **Token rotation in the controlled home.** `auth.json` is copied into a temporary home. If Codex
  refreshes the token mid-session, the rotated credential is written there and deleted with it,
  and the user's own `auth.json` may hold a consumed refresh token. Unverified. 0.156+ adds
  `modelProvider/authRecovery*` notifications, which R6.2-style recording would surface. Recorded
  for a later ruling.
- **Binary size.** The Windows platform package is a ~159 MB download; the exe is ~323 MB. Every
  install fetches it.
- **Vendor cadence.** Codex publishes roughly weekly. "Current" is a policy, not a state; R3 makes
  staleness visible, R4 makes catching up a bounded task. It does not upgrade automatically.
