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
