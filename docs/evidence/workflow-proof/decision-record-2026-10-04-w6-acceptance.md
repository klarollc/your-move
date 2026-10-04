# Workflow proof W6 — owner acceptance

Date: 2026-10-04
Source: the owner's direction in session: “w6 accepted”.

## Ruling

The owner accepts W6, canonical posture history projected from the canonical read model into
`OfficeWorkView`.

## Evidence recorded

- The owner supplied the focused unit-test RED output (2 failed, 35 passed) and GREEN output
  (37/37 passed), followed by a successful `npm.cmd run typecheck`.
- The owner ran `npm.cmd run phase5:provenance:write` and `npm.cmd run phase5:provenance`; both
  reported `ok: true`, with no missing ledger entries or stale digests.
- The owner reported the full `npm.cmd run verify` green after commit `7280de2`. The supplied
  terminal tail shows all 42 accessibility tests and all 68 visual tests passed. The detailed
  runner footer and runner identifier were not retained in this record.
- The focused `role-exercise.integration.test.ts` command was followed by the owner's explicit
  nonzero-exit guard without an error; the terminal output for that command was not included.

The W6 implementation is in `packages/application/src/office-read-model.ts` and
`packages/application/src/office-read-model.unit.test.ts` (commits `dd57609` and `4935e06`). The
separate fake app-server stream fixture correction is commit `7280de2` and was included in the
owner-reported full verification.

This acceptance is for W6's read-model behavior. It does not accept UI work or authorize W7–W9,
W12 live execution, promotion, push, or external effects.
