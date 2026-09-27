# Codex runtime currency — red-green log

Kept in `tasks/codex-currency-red-green.md` while the stream ran, by owner ruling 2026-09-25, so
that each task's `verify` gate did not wait on a provenance write. Moved here at Task 13 and
recorded with one owner-run `phase5:provenance:write`. Each RED is captured before its GREEN is
written and is never re-run afterwards. Inner-loop runs are in the cloud container mirror (Node 22); the gate for each task is
the runner result named under it.

## Task 2 — Pin module and executable resolver

**RED**, container mirror, `vitest run --project unit packages/runtime-codex/src/codex-pin.unit.test.ts`
against the stub in which every function returns an empty value and nothing throws:

```text
× reads an exact version from the declaration
× refuses a range, a tag or a missing declaration, because only an exact version is a pin
× is the version declared in this package's manifest, not a copy of it
× maps each supported host to the triple and platform package Codex itself uses
× refuses a host Codex does not ship for
× takes the entrypoint the installed platform package declares
× honours CUCKCODE_CODEX_EXE, which the drift preflight still checks
× refuses when the platform package is not installed rather than falling back to another binary
× refuses an installed package whose own layout names a different version than the pin
AssertionError: expected '' to be '0.157.1' // Object.is equality
AssertionError: expected [Function] to throw an error
AssertionError: expected '' to be '0.157.1' // Object.is equality
AssertionError: expected { triple: '', platformPackage: '' } to deeply equal { …(2) }
AssertionError: expected [Function] to throw an error
AssertionError: expected '' to be '/repo/node_modules/@openai/codex-win3…' // Object.is equality
AssertionError: expected '' to be 'D:/codex.exe' // Object.is equality
AssertionError: expected [Function] to throw an error
AssertionError: expected [Function] to throw an error
Tests  9 failed (9)
```

Nine of nine are assertion failures. **Not RED:** the toolchain characterization test
(`@openai/codex-win32-x64` joins family `@openai/codex`) passed on first run, as the checklist
said it would; it guards existing behaviour.

**GREEN**, container mirror: 9/9; full unit project 406 (397 + 9); `tsc -b` clean; ESLint and
Prettier clean on the changed files. The resolver, run against a real container install of
`@openai/codex@0.157.1`, returned `…/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex`,
which reports `codex-cli 0.157.1`.

**Added beyond the checklist:** `CODEX_PACKAGE_VERSION_MISMATCH`. The platform package's own
`vendor/<triple>/codex-package.json` states its version, so a stale install refuses at resolution,
before the R3 preflight spawns anything. It also names the entrypoint, so no executable path is
hardcoded.

## Task 4 — Upgrade command and surface diff

**RED**, container mirror, `node --test scripts/codex-surface-diff.test.mjs` against a stub
that returns empty values everywhere:

```text
not ok 1 - the consumed surface names the files the harness actually reads
ok 2 - an unchanged bundle has an empty diff
not ok 3 - a new turn item type needs a classification ruling before the pin can move
not ok 4 - a new failure class needs a ruling on whether it is a transport failure
not ok 5 - a server request that disappears is flagged, because the refusal list is derived from it
not ok 6 - losing a client method the harness calls is breaking
not ok 7 - a new required parameter the harness does not send is breaking; a new optional one is an addition
not ok 8 - the report is deterministic and leads with what needs a ruling
not ok 9 - the upgrade takes one exact version and an optional baseline
not ok 10 - the upgrade writes only inside the new bundle and never touches the pin
# pass 1
# fail 9
```

Nine of ten are assertion failures. **Not RED:** test 2 ("an unchanged bundle has an empty
diff") cannot fail against a stub that returns an empty diff; it is a guard against false
positives, named here rather than counted.

The fixtures are the committed 0.146.0 bundle, edited in memory, so the diff is tested against the
real schema shapes rather than invented ones.

**GREEN**, container mirror: 10/10; `test:protocol` 14/14; `test:runner` 26/26 (the allowlist guard
still passes with `protocol:codex:generate` renamed to `protocol:codex:upgrade`); ESLint, Prettier
and `tsc -p tsconfig.scripts.json` clean.

**Rehearsal, container mirror, not committed:** `tsx scripts/generate-codex-protocol.mjs 0.157.1`
against a linux-x64 install produced a bundle with `bundleHash`
`98111ca770d4d181fa42551a666d8c9be42d1333540ef70fd93cffda53fba24f`, 314 files — identical to an
independent generation made during diagnosis. The report listed exactly three entries needing a
ruling (`functionCallOutput`, `rateLimitExceeded`, `misalignmentPolicyViolation`) and no breaking
entries, matching spec §1. The committed bundle comes from the owner's Windows run.

## Tasks 5 and 6 — Single-source guard, and every consumer wired to the pin

Committed together: the Task 5 guard is RED against the real tree by design and only Task 6 makes
it GREEN, so a separate Task 5 commit would fail its own `verify` gate.

**RED 1, the guard's logic**, container mirror, `node --test scripts/codex-pin.test.mjs` against a
stub that finds nothing and lists no files:

```text
not ok 1 - a Codex version literal in source is a second copy of the pin
not ok 2 - an escaped version inside a regular expression is a copy too
ok 3 - tests may name versions, because a comparison needs two
not ok 4 - the desktop app's binary is refused everywhere, tests included
not ok 5 - the pinned version must have its schema bundle, stating the same version
not ok 6 - the guarded file list covers source and skips generated and vendored trees
ok 7 - this repository holds exactly one Codex pin
# pass 2
# fail 5
```

Five of seven are assertion failures. **Not RED against the stub:** test 3 is a negative case, and
test 7 cannot fail when the guard finds nothing. Test 7's RED is the next one.

**RED 2, the real tree** — the checklist's named RED, real code rather than a stub — once the guard
logic was GREEN, test 7 reported 22 violations:

```text
desktop-binary  packages/runtime-codex/src/codex-facts-probe.integration.test.ts:27
desktop-binary  packages/runtime-codex/src/codex-home-probe.integration.test.ts:30
desktop-binary  packages/runtime-codex/src/codex-live.integration.test.ts:16
version-literal packages/runtime-codex/src/codex-pin.ts:11            (a comment)
version-literal packages/runtime-codex/src/fixtures/fake-app-server.mjs:20
desktop-binary  packages/runtime-codex/src/supervisor.integration.test.ts:32
desktop-binary  packages/runtime-codex/src/supervisor.integration.test.ts:40
version-literal packages/runtime-codex/src/supervisor.ts:321          (the handshake regex)
version-literal scripts/check-codex-protocol.mjs:91
version-literal scripts/check-codex-protocol.mjs:92
desktop-binary  scripts/codex-pin.test.mjs:54                          (the guard's own fixture)
desktop-binary  scripts/codex-pin.test.mjs:56                          (the guard's own fixture)
desktop-binary  scripts/phase4-kickoff-session.ts:35
version-literal scripts/run-phase4-kickoff.ts:75
version-literal scripts/run-phase5-release-review.ts:80
version-literal scripts/run-phase5-surface-contract.ts:73
version-literal scripts/run-phase5-verification.ts:117
version-literal scripts/run-phase5-visual-qa.ts:87
desktop-binary  scripts/run-phase6-review.ts:33
version-literal scripts/run-phase6-review.ts:98
desktop-binary  scripts/run-role-exercises.ts:20
version-literal scripts/run-role-exercises.ts:80
```

The checklist predicted the supervisor regex, seven `protocolVersion` literals, the generator
constant and four desktop-app paths. Task 4 had already removed the generator's constant and path.
The guard also found what the prediction missed: two skipped live probes and the supervisor's
integration test spawning by the desktop path, the fake app server's hard-coded user agent, the
checker's default bundle, and two comments.

**RED 3, `carriesVersion`**, which replaces the supervisor's `/0\.146\.0/` regex and is new
behaviour, against a stub that accepts everything:

```text
AssertionError: expected true to be false // Object.is equality
AssertionError: expected true to be false // Object.is equality
Tests  2 failed | 1 passed (3)
```

The passing test ("accepts the version where Codex reports it") cannot fail against an accepting
stub.

**GREEN**, container mirror: `test:protocol` 21/21, and `protocol:codex:check` now checks both
committed bundles and requires the pinned one
(`{"pinned":{"ok":true,"pin":"0.157.1"},"bundles":[…0.146.0 ok…,…0.157.1 ok…]}`); unit 409
(406 + 3); runtime-codex integration 12 passed, 3 skipped (the live probes); contract 77; runner
26; toolchain 11; `tsc -b`, `tsc -p tsconfig.scripts.json`, ESLint and Prettier clean across the
repository.

**Files beyond the Task 6 list, stated:** `codex-facts-probe` and `codex-home-probe` integration
tests (desktop path), `codex-pin.ts` (a comment), and the new `supervisor.unit.test.ts`.
`resolveInstalledCodexExecutable()` is called inside each live test and per session, never at
import, so a module that only parses turns does not need Codex installed.

## Task 7 — Drift preflight

**Deviation from the plan, stated:** the core is TypeScript (`scripts/codex-drift.ts`, tested by
`scripts/codex-drift.unit.test.ts` under vitest) rather than `codex-drift-core.mjs` under
`node --test`. Every consumer is a TypeScript live script, no TypeScript script imports `.mjs`, and
`allowJs` is off. `scripts/check-codex-protocol.d.mts` types the existing checker, so the drift
check reuses `buildProtocolManifest` rather than carrying a second copy of the canonical hashing,
which would repeat C-1 F6.

**RED**, container mirror, `vitest run --project unit scripts/codex-drift.unit.test.ts` against a
stub that always reports no drift:

```text
AssertionError: expected { ok: true, pin: '0.157.1', …(2) } to deeply equal { ok: true, pin: '0.157.1', …(2) }
AssertionError: expected true to be false // Object.is equality
AssertionError: expected true to be false // Object.is equality
AssertionError: expected true to be false // Object.is equality
AssertionError: expected true to be false // Object.is equality
AssertionError: expected [] to deeply equal [ [ '--version' ], …(1) ]
AssertionError: expected true to be false // Object.is equality
Tests  7 failed (7)
```

Seven of seven are assertion failures.

**GREEN**, container mirror: 7/7. Against real binaries, with no stub:

- the installed 0.157.1 passes, with bundle hash
  `98111ca770d4d181fa42551a666d8c9be42d1333540ef70fd93cffda53fba24f`;
- `CUCKCODE_CODEX_EXE` pointed at a real 0.146.0 binary is refused on both counts:
  `CODEX_BINARY_VERSION_DRIFT` (observed `codex-cli 0.146.0`, expected `codex-cli 0.157.1`) and
  `CODEX_SCHEMA_DRIFT` (observed `ad2276a8362863c4bcc4083ca33b4a300920419b4ef244689d84c7706f710197`,
  which is the committed 0.146.0 bundle's hash, expected `98111ca7…`). This is DF-021 reproduced
  and refused, and it shows the override cannot bypass the pin (R1.3).

**Wiring guard, proven by mutation rather than RED** (the wiring was written first): three
structural tests — the shared session opener checks before constructing a supervisor; the two
scripts that construct their own supervisor check before they do; the five others open sessions
through the shared opener. Removing `await assertNoCodexDrift()` from `phase4-kickoff-session.ts`
failed 1 of 10; removing it from `run-role-exercises.ts` failed 1 of 10; restored, 10/10.

Mirror totals: unit 419 (409 + 10), `test:protocol` 21/21, `protocol:codex:drift` ok, runner
26/26, `kickoff:preflight` reports `codex.ok: true` beside the role checks; `tsc -b`, scripts
typecheck, ESLint and Prettier clean.

## Task 8 — Item classification

**RED**, container mirror, `vitest run --project unit packages/runtime-codex/src/item-classification.unit.test.ts`
against a stub with an empty table that classifies everything as text:

```text
AssertionError: expected [] to deeply equal [ 'agentMessage', …(18) ]
AssertionError: expected [] to deeply equal [ 'agentMessage', …(4) ]
AssertionError: functionCallOutput: expected 'text' to be 'effect' // Object.is equality
AssertionError: expected 'text' to be 'unclassified' // Object.is equality
AssertionError: expected { effects: [], unclassified: [] } to deeply equal { …(2) }
Tests  5 failed (5)
```

The checklist named a stub table missing only `functionCallOutput`; an empty table fails every
assertion, including that one.

**RED, the role exercise**, the new unit test run against the pre-change `role-exercise.ts`:

```text
× stops on an item type nobody has classified rather than treating it as text
-   "code": "UNCLASSIFIED_ITEM_TYPE",
+   "code": "TEXT_ONLY_VIOLATION",
Tests  1 failed | 6 passed (7)
```

**Stated plainly:** the role exercise already stopped such a turn, under its stricter
one-`agentMessage` rule, so the change there only names the cause. The real gap was in the kickoff
session, whose allow-list let any unlisted type pass as text. That path now calls
`classifyTurnItems`, tested directly; the session itself has no test harness (plan, CP-3 is where it
gets one).

**GREEN**, container mirror: classification 5/5; role exercise 7/7; unit 425 (419 + 6);
runtime-codex integration 12 + 3 skipped; `test:protocol` 21/21 after the Task 5 guard caught a
Codex version I had written in a comment of the new module, now reworded. Both local effect
allow-lists are deleted.

**Transfer note:** one handoff tarball arrived stale — the device held the previous upload under
the same name — and the hash check caught it before anything was committed. Transfers now use a
unique file name each time.

## Task 9 — Supervisor: server requests and notification subscription

The fake app server gains two modes. `server-request` answers `turn/start` only after its own
request to the client (`item/tool/requestUserInput`) is answered, and deliberately gives that
request **the same id as the client's pending `turn/start`**. `retry-then-fail` emits three `error`
notifications (`willRetry` true, true, false) carrying `responseStreamDisconnected`, then a
failed `turn/completed` — the shape of pass 8, which the harness never saw.

**RED**, container mirror, `vitest run --project integration packages/runtime-codex/src/supervisor.integration.test.ts`
against a `subscribe` stub that delivers nothing and the unchanged message routing:

```text
AssertionError: expected undefined to match object { turn: { id: 'turn_fixture' } }
AssertionError: expected [] to deeply equal [ 'error', 'error', 'error', …(1) ]
Tests  2 failed | 7 passed (9)
```

The first line is **a second defect this task found**, beyond the one it was written for. The old
routing matched any message with a numeric id against its pending requests, so a server request
whose id coincided with `turn/start`'s resolved `turn/start` as `undefined`, and the server then
waited forever for an answer to a request nobody had seen. Server ids and client ids are separate
spaces; they are now routed apart by the presence of `method`. **Not RED:** "stops delivering to a
subscriber once it unsubscribes" cannot fail against a stub that never delivers.

**GREEN**, container mirror: supervisor integration 9/9 (6 existing + 3), stable over three
consecutive runs; runtime-codex integration 15 + 3 skipped; `test:runtime` green; unit 425.

**A test corrected during GREEN, stated:** the unsubscribe test first failed against the real
implementation because the fake's `fixture/ready` notification arrives asynchronously after the
handshake, inside the subscribed window. The test now waits for it before subscribing. The
implementation was not changed to make it pass.

A refused request is answered `{ id, error: { code: -32601 } }`, recorded in
`refusedServerRequests`, and published to subscribers as `serverRequestRefused` naming the method.
Failing the active turn on that event is the turn runner's job (Task 10). `CODEX_ARGS` and the
request allow-list are unchanged.

## Task 10 — Shared turn runner

`failure-classification.ts` keeps Codex's own `codexErrorInfo` (variant and HTTP status) and
`additionalDetails`, and marks exactly CX-4's four classes as transport. `turn-runner.ts` is
`runTurn(supervisor, { threadId, input, clock?, retryBudget?, limits? })`. Time is injected through
a `Clock` (`now`, `setTimer`, `sleep`); tests use `fixtures/manual-clock.ts`, so a 180 s idle limit,
a 900 s cap and a 30 s backoff cost nothing.

**RED**, container mirror, `vitest run --project unit` on the two new test files against stubs
(classification returns empty; `runTurn` returns `{ ok: false, code: "STUB" }`):

```text
AssertionError: expected { message: '', variant: null, …(3) } to deeply equal { …(5) }
AssertionError: expected [] to deeply equal [ 'httpConnectionFailed', …(3) ]
AssertionError: usageLimitExceeded: expected null to be 'usageLimitExceeded' // Object.is equality
AssertionError: expected { message: '', variant: null, …(3) } to deeply equal { message: 'odd', variant: null, …(3) }
AssertionError: expected false to be true // Object.is equality
AssertionError: expected false to be true // Object.is equality
AssertionError: expected false to be true // Object.is equality
AssertionError: expected { ok: false, code: 'STUB', …(3) } to match object { Object (ok, code) }
AssertionError: expected { ok: false, code: 'STUB', …(3) } to match object { Object (ok, code) }
AssertionError: expected +0 to be 1 // Object.is equality
AssertionError: expected { ok: false, code: 'STUB', …(3) } to match object { ok: false, code: 'TURN_FAILED' }
AssertionError: expected { ok: false, code: 'STUB', …(3) } to match object { ok: false, code: 'TURN_FAILED' }
AssertionError: expected { ok: false, code: 'STUB', …(3) } to match object { ok: false, code: 'TURN_FAILED' }
AssertionError: expected { ok: false, code: 'STUB', …(3) } to match object { ok: false, code: 'TURN_FAILED' }
AssertionError: expected { ok: false, code: 'STUB', …(3) } to match object { ok: false, …(1) }
AssertionError: expected { ok: false, code: 'STUB', …(3) } to match object { ok: false, code: 'RUNTIME_FAILURE' }
Tests  16 failed (16)
```

Sixteen of sixteen are assertion failures: four classification, twelve runner. They cover
completion; Codex's retries recorded in order; a slow but streaming turn not interrupted; a silent
turn interrupted at exactly 180 000 ms and not at 179 999; the 900 s cap; one transport retry after
exactly 30 000 ms and not before; a second transport failure stopping; a usage limit, a transport
failure with output, and a spent budget each never retried; a refused server request failing the
turn by name; and a `turn/start` that throws.

**A defect in my own GREEN, found by the RED suite:** the first implementation let the
`turn/completed` that answers our own interrupt overwrite `lastMethod`, so the record would have
named the interrupt's reply rather than what the turn last did. `lastMethod` now freezes when a
limit fires. **GREEN** 16/16, plus an added assertion that no timer is left pending after a turn.

**End-to-end over a real child process, written after GREEN and not claimed as RED:** five
fake-app-server modes (`transport-fail-once`, `transport-fail-twice`, `non-transport-fail`,
`silent-turn`, `server-request`) through `CodexStdioSupervisor` and `runTurn` with a manual clock.
5/5.

**Both call sites moved onto the runner (CP-3).** The kickoff session's `turn` now returns
`attempts` beside its result. The role exercise loses its 90 s wait for the first cached
`turn/completed` — the defect `waitForTurnCompleted` was written to fix for the kickoff alone — and
maps runner failures onto its existing codes (`TURN_FAILED` and `TURN_INTERRUPTED` to
`TURN_COMPLETION_INVALID`, everything else to `RUNTIME_FAILURE` with the runner code in `detail`),
so its result shape and record schema are unchanged. Its unit fake now delivers the completion as
a notification after `turn/start`, as the live runtime does.

Mirror totals: unit 441 (425 + 16); runtime-codex integration 20 + 3 skipped (15 + 5);
`test:runtime` green; `test:protocol` 21/21; `tsc -b`, scripts typecheck, ESLint and Prettier clean.

**Known, stated, not addressed:** a transport retry re-submits the same input as a new turn on the
same thread, so the failed turn's user message stays in the thread history; Codex 0.157 has no
rollback. And a reasoning model that thinks silently for more than 180 s will now be interrupted —
CX-3's choice, and no shorter than the 180 s wall clock that ended pass 9. The smoke turn will show
whether `gpt-5.6-sol` streams anything while it reasons.

### Task 10 gate failure, and its fix

The first runner `verify` at `52bc47d` failed in **integration on Windows**, not in a browser suite:
`turn-runner.integration.test.ts > interrupts a silent turn through the real protocol` received
`status: null` where it expected `"interrupted"`. Two defects in my own integration tests,
neither in the runner:

1. **A manual clock raced real I/O.** The test advanced 30 s of manual time every 5 ms of real
   time. After the idle limit fired and the interrupt went out, the next step overran the 15 s grace
   window before the slower Windows child process answered, so the runner — correctly — recorded
   "no completion after interrupt". The container is faster and passed. Tests now keep every limit
   they are not about out of reach, and the silent-turn test advances only after it has really seen
   `turn/started`.
2. **My first "out of reach" value, 1e12 ms, was worse.** It also became the timeout of the
   supervisor's `turn/interrupt` request, and Node clamps any `setTimeout` delay above 2^31 − 1 ms
   to 1 ms, so the request timed out at once and the supervisor killed the child. It hung the
   server-request test 2 times in 5 in the container. The value is now 1e9.

That clamp would hit the runner's own timers too, so `runTurn` now refuses a limit it cannot hold
(`TURN_LIMIT_OUT_OF_RANGE`). **RED** against the runner as committed:

```text
× refuses a limit a real timer cannot hold, instead of firing it at once
AssertionError: promise resolved "{ ok: true, …(2) }" instead of rejecting
Tests  1 failed | 12 passed (13)
```

GREEN 13/13; the integration file 5/5 in ten consecutive container runs.

**Behaviour now on record:** a `turn/interrupt` that itself times out makes the supervisor kill that
session's Codex process. The turn has already failed by then, but no later turn can run in that
session.

## Task 11 — Classification in records (R6.1, R7.1); R6.7 withdrawn

**R6.7 withdrawn by owner ruling, 2026-09-26.** The cheapest check first: the normalizer's
hardcoded `retryable: false` is only on its parse-failure codes, where it is true; the contract's
`runtime.error` event has no `retryable` field; and `normalizeCodexEvent` has no caller outside its
tests. No normalizer change. Erratum in the specification; C-1 F4 stays open.

`attemptRecords()` projects the runner's attempts into the committed record shape: outcome,
status, elapsed time, last method, refused server request, and for a failure Codex's own
`codexErrorInfo`, HTTP status, message, `additionalDetails` and transport flag, plus every
`error` notification in order as `codexRetries`. `describeTurnCompletionFailure` now delegates to
the classifier, so its one-line detail names the class and status too.

**RED**, container mirror, against a projection stub that kept only the message and the previous
`describeTurnCompletionFailure`:

```text
× names Codex's failure class and HTTP status, not only its message
× keep everything Codex said about a failure, which passes 6 to 9 lost
× mark a harness retry, and record a clean attempt with no failure
AssertionError: expected 'turn turn_8 reported status failed: s…' to be 'turn turn_8 reported status failed: s…' // Object.is equality
AssertionError: expected { Object (message) } to deeply equal { attempt: 1, …(9) }
AssertionError: expected { message: null } to match object { transportRetry: true, …(2) }
Tests  3 failed | 10 passed (13)
```

**Not RED:** "are plain JSON, so a record survives a round trip unchanged" cannot fail against a
stub that returns plain objects.

**GREEN** 13/13. Every writer that records a turn now embeds `runtime: attemptRecords(…)`: the
release review and the three other Phase 5 live scripts on every attempt entry, the kickoff on
every transcript entry, and the role exercise on every result that reached a turn (absent on a
refusal before any turn), carried into `roles/exercises.json` attempts and the Phase 6 review
results. That is six writers, not the three the checklist named, because all six record a turn.
The role-exercise record was proven by mutation: emptying the success record failed 1 of 8.
Nothing is rewritten: the new fields appear only in records written by future runs, and
`phase5:provenance` reads every committed pass unchanged (mirror: ok, 0 stale, 0 missing).

Mirror totals: unit 446 (+ the Task 10 guard, 447 at the gate); runtime-codex integration 20 + 3
skipped; `tsc -b`, scripts typecheck, ESLint and Prettier clean.

## Task 12 — Session log (R6.8, CX-5)

`openSessionLog(supervisor, { root, script, roleId, pin })` subscribes for the life of a session
and, on `close()`, writes `docs/evidence/runtime/sessions/<script>/<timestamp>-<roleId>.jsonl`.
The file holds a header (script, role, Codex pin, start and end times, per-method delta counts,
refused server requests), every non-delta notification in arrival order with its elapsed
milliseconds, and the supervisor's already-redacted stderr. The timestamp's `:` and `.` become `-`,
so the name is valid on Windows.

**Beyond CX-5, stated for review:** the log is diagnostic evidence, not a transcript. Beyond
counting deltas, it replaces every `text`, `delta`, `content`, `summary`, `aggregatedOutput` or
`output` string, and any string over 160 characters, with `{ redactedLength }`. `item/completed`
and `turn/completed` carry the model's full answer, and committing that would contradict how the
project already treats transcripts (a hash in the record; role exercises refuse secret-shaped
text).

**RED**, container mirror, against a stub whose `close()` writes an empty record. A first stub
that wrote nothing gave four `ENOENT` errors, which are not assertion failures, so it was replaced
before any RED was recorded:

```text
AssertionError: expected '' to be '/r/run-codex-smoke/2026-09-26T12-00-0…' // Object.is equality
AssertionError: expected {} to match object { kind: 'session', …(6) }
AssertionError: expected undefined to deeply equal { 'item/agentMessage/delta': 3, …(1) }
AssertionError: expected undefined to deeply equal { threadId: 'th', turnId: 't1', …(1) }
AssertionError: expected undefined to deeply equal [ 'item/tool/requestUserInput' ]
AssertionError: expected +0 to be 1 // Object.is equality
Tests  6 failed (6)
```

**GREEN** 6/6.

**Credential canary, over a real child process:** a controlled home whose `auth.json` holds a
sentinel, and the fake server's `Authorization: Bearer secret-canary` stderr line. The log contains
`turn/completed` and `[REDACTED]`, and contains neither the sentinel, `secret-canary`, nor the
agent's text `TURN_1_OK`.

**Wiring:** the shared session opener opens the log before the handshake and closes it after the
supervisor stops and before the controlled home is disposed, on both the handed-back and the failed
path. The two scripts that build their own supervisor do the same. A structural test asserts the
ordering.

**Mutations, each confirmed applied before its result was read:** removing the handed-back
`liveLog.close()` failed the wiring test (1/2); removing `text` from the redacted keys failed the
canary; removing the supervisor's bearer redaction failed the canary. One attempted mutation did
not apply because of shell quoting; it was redone and counted only once applied.

Mirror totals: unit 455 (447 + 8); runtime-codex integration 21 + 3 skipped; `test:protocol` and
`test:runner` green; `tsc -b`, scripts typecheck, ESLint and Prettier clean.

## Task 13 — Smoke script and records

`scripts/codex-smoke.ts` is the smoke turn's pure core, with every dependency injected (opt-in,
ledger, session, record writer, clock); `scripts/run-codex-smoke.ts` wires the real ones, opening
the Release Reviewer through the shared session opener, so the drift preflight and the session log
come with it.

**RED**, container mirror, against a stub that reports success without doing anything:

```text
AssertionError: promise resolved "{ ok: true, code: 'STUB', …(1) }" instead of rejecting
AssertionError: promise resolved "{ ok: true, code: 'STUB', …(1) }" instead of rejecting
AssertionError: expected { ok: true, code: 'STUB', …(1) } to deeply equal { ok: true, code: 'SMOKE_OK', …(1) }
AssertionError: expected { ok: true, code: 'STUB', …(1) } to match object { ok: false, code: 'TURN_FAILED' }
AssertionError: expected 'STUB' to be 'SMOKE_ANSWER_MISMATCH' // Object.is equality
AssertionError: expected { ok: true, code: 'STUB', …(1) } to match object { ok: false, code: 'CODEX_DRIFT' }
Tests  6 failed (6)
```

**GREEN** 6/6: refuses without `CUCKCODE_LIVE_SMOKE=1` before touching the ledger; refuses when
fewer than three turns remain; records an answered turn with what ran and every attempt, spending
one; spends every attempt a transport retry used; records a wrong answer as
`SMOKE_ANSWER_MISMATCH` by digest, never by text; records a session that never opened and spends
nothing. `verdict` is always `null`.

**Rehearsal, stated precisely:** against injected fakes, not a fake app server. The live script
resolves the real Codex and runs the drift preflight, which a fake binary cannot pass, so the
end-to-end rehearsal of the session path is the Task 10 and 12 integration suites. The real script
was also run in the mirror without the opt-in: it refused with `LIVE_SMOKE_EXPLICIT_OPT_IN_REQUIRED`
and wrote nothing. The runner cannot run it: its allowlist guard excludes any script that reads a
`CUCKCODE_*` variable (`test:runner` 26/26), and it is not on the allowlist.

The drift wiring test now lists `run-codex-smoke.ts` among the scripts that open sessions through
the shared opener. `docs/evidence/runtime/smoke-ledger.json` starts at budget 3, spent 0.

Records: DF-021's product response gains a dated update; DF-025 records B1–B6 and the frictions of
this stream; DF-026 records the working-copy-bytes provenance defect for its own ruling. AGENTS,
HANDOFF and README each gain one amendment. The decision record gains the rulings made during
implementation.

## Follow-ups

Under `docs/codex-follow-ups-spec-v0.1.md` and `tasks/codex-follow-ups-todo.md`, both approved
2026-09-26.

### Follow-up Task 1 — Runner allowlist (F4)

**RED**, container mirror, `node --test scripts/agent-runner.test.mjs` against today's allowlist:

```text
not ok 2 - the six read-only checks ruled on 2026-09-26 are allow-listed as themselves
    check:toolchain
    + actual - expected
    + undefined
    - {
    -   kind: 'npm',
    -   script: 'check:toolchain'
```

**GREEN** 27/27. The existing guard test ("the committed allowlist passes against the real
package.json and script sources") accepts all six unchanged: none reads a `CUCKCODE_*` variable,
writes evidence, installs or forces. The runner reads its allowlist once at startup, so the owner
restarts it to use the new entries.

### Follow-up Task 2 — Session-log redaction (F3.1–F3.3, F3.5)

**RED 1**, container mirror, the smoke-shaped fixture against today's redaction:

```text
× keeps no identity or home path from a log shaped like the real smoke session
AssertionError: Nate_PC: expected '{"kind":"session","script":"run-codex…' not to contain 'Nate_PC'
Tests  1 failed | 6 passed (7)
```

The fixture carries what the real smoke log carried: the PC name, a Codex installation id, the plan
type, rate limits, and the home path both in parsed notification strings and, doubled, in Codex's
escaped stderr — plus a lower-case `c:/users/NATER/…` spelling.

**GREEN** 7/7. `account/*` and `remoteControl/*` params become `{ "redacted": "identity" }`; the
home directory becomes `~` in every notification string and stderr line, whatever mix of `/`, `\`
and doubled `\\` spells it, case-insensitively; the header carries `redaction: "v1"`.

**RED 2, a refinement found while reading GREEN:** the home pattern had no boundary, so `/home/nate`
would also fold `/home/nate-old` into `~-old` — over-redaction, not a leak, but wrong.

```text
× folds the home directory only where it ends, not a sibling that shares its prefix
AssertionError: expected { Object (a, b, ...) } to deeply equal { a: '~/work', b: '~', …(1) }
Tests  1 failed | 7 passed (8)
```

**GREEN** 8/8 with a trailing boundary. The credential canary (integration) still passes.

**Mutations, each confirmed applied:** identity redaction switched off failed 1/8; stderr home
folding switched off failed 1/8.

Case-insensitive folding applies on every platform, so on Linux it could fold a differently cased
sibling of the home directory. That is over-redaction only, accepted.

### Follow-up Task 3 — CR guard, worktree bytes, redacted smoke log (F2.1–F2.3, F3.4)

Two small additions beyond the task's file list, stated: the guard's logic lives in
`scripts/evidence-line-endings.mjs` so it can be tested with synthetic cases as well as on the real
tree, and `rewriteSessionLog()` joins `session-log.ts` so the held log is redacted by the same code
as every new log, not a copy of it.

**RED 1, the guard**, container mirror, `node --test scripts/evidence-line-endings.test.mjs`
against a stub that finds nothing and lists nothing:

```text
not ok 1 - a text file with a CR byte is named
not ok 2 - a lone CR counts, not only CRLF
ok 3 - binary files are skipped, by declared type and by a NUL byte
not ok 4 - the file list covers the evidence tree
ok 5 - no evidence file carries a CR byte, so a clean checkout verifies the same bytes (DF-026)
# pass 2
# fail 3
```

Tests 3 and 5 cannot fail against a stub that finds nothing; test 5's RED is the next one.

**RED 2, the real tree** — real code, as the checklist said — once the guard worked: exactly the
twelve DF-026 files, and nothing else in `docs/evidence/`:

```text
docs/evidence/phase-0/environment.json
docs/evidence/phase-0/phase-0-report.md
docs/evidence/phase-1/determinism-hashes.json
docs/evidence/phase-1/environment.json
docs/evidence/phase-2/dependency-audit.json
docs/evidence/phase-2/environment.json
docs/evidence/phase-2/invariant-matrix.md
docs/evidence/phase-2/phase-2-report.md
docs/evidence/phase-2/shared-knowledge-proof.json
docs/evidence/phase-2/source-boundary-scan.json
docs/evidence/phase-3/phase-3-gate.md
docs/evidence/phase-3/red-green-log.md
```

**RED 3, the rewrite**, against a stub returning the log unchanged:

```text
× rewrites a log captured before redaction v1 to the same standard, and says so
AssertionError: expected { kind: 'session', …(3) } to match object { redaction: 'v1', …(1) }
Tests  1 failed | 8 passed (9)
```

**GREEN:** guard 4/5 then 5/5 once the twelve worktree files returned to their committed LF bytes —
each converted file was checked equal to `git show HEAD:<path>` before it was written, and git shows
no change for any of them. Rewrite 9/9.

**The held smoke log**, rewritten in the mirror with `--home 'C:\Users\nater'` (the machine it was
captured on): 18 lines in, 18 out, with identical kinds, methods, sequence numbers and timings; the
PC name, installation id, plan type, rate limits and user name all absent; paths read
`~\AppData\Local\Temp\…`. Written to
`docs/evidence/runtime/sessions/run-codex-smoke/2026-09-26T12-34-44-005Z-release-reviewer.jsonl`
with `redactedAfterCapture: true`; the original stays in `.cuckcode/held-session-logs/`.

**Task 2's gate took four runs, recorded:** three failed on collisions with the main copy's runner
— two C-10 component timeouts while the main runner ran component-test mutations and its own
`verify`, and one e2e start refused because port 4173 was in use by the main runner's e2e run
(13:20:53–13:21:35 UTC against ours at about 13:21:00). The fourth, queued only after the main
runner had been idle for a minute, passed. Gates are now queued that way.

### Follow-up Task 4 — Features in the upgrade (F1.2)

- RED (2026-09-26, `node --test scripts/codex-surface-diff.test.mjs`): 9 pass, 8 fail, every
  failure an `AssertionError`. Seven failed against deliberate stubs (`parseFeaturesList` returning
  `[]`, `diffFeatures` returning an empty diff, `mergeDiffs` returning its first argument); one
  failed against the real `upgradeWritePaths`, which did not yet list `features.json`.
- GREEN: 17 pass, 0 fail. Parser: padded columns, a stage that may contain a space, CRLF, a
  refused unreadable line (`FEATURES_LIST_UNPARSED`) and a refused empty list
  (`FEATURES_LIST_EMPTY`). Diff: a new default-on feature, a flip to default-on and a stage move on
  a default-on feature need a ruling; a default-off addition, a flip to off and a removal are
  recorded, not ruled; with no baseline list every default-on feature needs a ruling.
- Found while building: `features list` reports the state under the config it runs with (the
  2026-09-26 ruling showed `-c features.apps=false` changes it), so the upgrade runs it with an
  empty `CODEX_HOME` and a working directory outside the repository.
- Dry run in the container mirror (Linux 0.157.1, not the owner's Windows binary):
  `created:false`, bundleHash unchanged `98111ca770d4d181fa42551a666d8c9be42d1333540ef70fd93cffda53fba24f`,
  `manifest.json` bytes unchanged, 150 features, 52 default-on, `needsRuling` 55 (the 3 existing
  entries plus 52 `featureDefaultOn`, ruled by FU-1), no temporary directory left behind.
- Owner's first run (win32-x64): 150 features, **53** default-on, `needsRuling` 56, bundleHash
  unchanged. The one difference from the Linux dry run: `secret_auth_storage` (stable) is default-on
  on win32-x64 and default-off on linux-x64.
- **Erratum, spec §Findings:** "52 default-on in all" was counted from the Linux binary in the
  container mirror. The pinned binary on the owner's platform (win32-x64) reports 53. The 43
  "not removed" figure has the same source and is one short on win32-x64 for the same reason.
- **Owner ruling, 2026-09-26** (recorded in `decision-record-2026-09-27-codex-follow-up-task-6-rulings.md`):
  `secret_auth_storage` is disabled under FU-1's deny-by-default rule; Task 6's signed-in probe
  (`account/read`, no model turn) proves whether sessions still see the login, and a failure there
  reopens it as a keep. `features.json` records the platform it came from; the owner reruns the
  upgrade once to write it.
- RED (platform field): 17 pass, 1 fail, `AssertionError` against a stub `buildFeaturesRecord`
  that returned only `version` and `features`. GREEN: 18 pass, 0 fail.

### Follow-up Task 5 — Feature policy and enumeration (F1.1, F1.3, F1.4, FU-1 to FU-3)

- Established offline first (container mirror, linux-x64 0.157.1, not signed in, no turn):
  `thread/start` `config.features` takes whole feature names as keys, dots included. A bogus
  `features: {"guardianv2.no_such_xyz": false}` is refused as an unknown configuration field
  named with the whole dotted name, while the flat `"features.guardianv2.no_such_xyz"` key is read
  as a nested table. All 145 non-kept features set `false` in one `thread/start` are
  accepted; `mcpServerStatus/list` with `{threadId, detail: "toolsAndAuthOnly"}` answers
  `{"data":[],"nextCursor":null}`.
- Design: the config disables every feature not kept, not only this platform's default-on ones,
  so a platform-dependent default (`secret_auth_storage`) is off on both platforms.
  `observedMcpServers` is reported but not fingerprinted: a binding that succeeds observed none,
  and leaving it out keeps earlier fingerprints valid.
- RED (vitest in the mirror): 20 of 51 fail, every one an `AssertionError`. Eleven against
  deliberate stubs (an empty `FEATURE_POLICY`, an `enumerateMcpServers` returning `[]`); nine
  against real code without the contract field, the config or the enumeration. The surface-diff
  test (losing `mcpServerStatus/list` is breaking) failed 1 of 19 against real code.
- GREEN: the six files 51/51; surface diff 19/19. Whole mirror: `tsc -b`, `typecheck:scripts`,
  `eslint --max-warnings 0` clean; unit 478, integration 77 (3 skipped), contract 78, all pass.

### Follow-up Task 6 — The probe (F1.5, F1.6), build

- RED: the probe core's 8 unit tests and the fake-server rehearsal failed 9 of 9, every one an
  `AssertionError`, against a stub core that answered `PROBE_OK` without doing anything; the
  runner guard (`codex:probe-surface` cannot be allow-listed) failed 1 of 28 against real code
  before the script existed.
- GREEN: 9 of 9; runner 28 of 28.
- Rehearsed with the real script against the real linux-x64 0.157.1 binary in the mirror, with a
  dummy credential: without `CUCKCODE_LIVE_PROBE=1` it throws before anything runs; with it, drift
  preflight, controlled home, supervisor and redacted session log all ran, and it stopped at
  `account/read` (`PROBE_RUNTIME_FAILURE`), as a non-credential should. That record said only
  `PROVIDER_REQUEST_FAILED`, so the record now names the step it stopped at: RED 1 of 8
  (`AssertionError`), GREEN 8 of 8; the rerun recorded `step: "account/read"`.
- The drift-placement guard (`codex-drift.unit.test.ts`) caught the new script constructing its own
  supervisor; the script now calls `await assertNoCodexDrift()` in the form the guard checks, and
  the guard lists it. Whole mirror: unit 486, integration 78 (3 skipped), typecheck, lint clean.

### Follow-up Task 6 — first owner run and the listing bound

- Owner run 2026-09-27T17:57:23Z (win32-x64, signed in): `PROBE_RUNTIME_FAILURE` at
  `mcpServerStatus/list (control)`, detail `LINE_TOO_LARGE`. `account/read` and the control
  `thread/start` succeeded; the session log shows `mcpServer/startupStatus/updated` for
  `codex_apps` going `starting` → `ready` in the control thread. The control's listing exceeded
  the supervisor's 1 MiB per-message default.
- RED: a fake mode whose codex_apps catalog is over 1 MiB; the rehearsal with the default bound
  reproduced `LINE_TOO_LARGE`, and with the probe's bound (stubbed at the default) failed 1 of 11,
  with the source guard, 2 of 11 in all, both `AssertionError`.
- GREEN: `PROBE_MAX_LINE_BYTES` 64 MiB, used only by the probe's supervisor; 11 of 11. Mirror:
  unit 487, integration 79 (3 skipped), typecheck and lint clean. Every other session keeps 1 MiB.

### Follow-up Task 6 — second owner run and the record redaction

- Owner run 2026-09-27T18:12:30Z: `PROBE_OK`. Control: `codex_apps` connected, 427 tools, 18
  connectors. Policy (145 features off): no server. No turn.
- Owner ruling: the record's tool names are held and the committed copy keeps counts only.
  RED: `redactProbeRecord` stubbed to return its input, 2 of 11 failed, both `AssertionError`.
  GREEN: 11 of 11. The held capture (sha256
  `25de8b01b9bd26a60aba2618b7f920a7285f5689b5d98be63fff8e0b7ebceca6`) went through
  `scripts/redact-held-probe-record.ts` once; the committed copy (sha256
  `162df321d0cf8a50583ac1209364b4d050a5a9ed898247b66c9acb09f8c43153`) contains no connector or tool
  name.
- Not settled by the probe: a turn with `secret_auth_storage` off. Left open until the next real
  turn, by owner ruling.
