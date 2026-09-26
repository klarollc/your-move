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
