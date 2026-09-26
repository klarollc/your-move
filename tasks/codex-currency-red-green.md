# Codex runtime currency — red-green log

Kept in `tasks/` while the stream runs, by owner ruling 2026-09-25, so that each task's `verify`
gate does not wait on a provenance write. At Task 13 it moves to
`docs/evidence/runtime/codex-currency/red-green-log.md` with one owner-run
`phase5:provenance:write`. Each RED is captured before its GREEN is written and is never re-run
afterwards. Inner-loop runs are in the cloud container mirror (Node 22); the gate for each task is
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
