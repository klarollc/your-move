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
