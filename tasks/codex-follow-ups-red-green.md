# Follow-ups red-green log (staging)

Kept in `tasks/` until follow-up Task 3, then appended verbatim to
`docs/evidence/runtime/codex-currency/red-green-log.md` before the owner's provenance write, as the
2026-09-25 ruling did for the first stream, so no gate waits on a provenance write.

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
