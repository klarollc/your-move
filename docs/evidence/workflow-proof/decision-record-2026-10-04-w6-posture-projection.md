# Workflow proof W6 — owner ruling

Date: 2026-10-04
Source: the owner's approval in session, 2026-10-04: “approved as recommended”.
Proposal: `docs/proposals/2026-10-04-workflow-proof-w6-read-model-comparison.md`.

## Ruling

Select route **(c)**: project posture history from the canonical snapshot as a `postures` field on
`OfficeWorkView`.

The projection must preserve the canonical per-work-item history, including `runId`, requested,
granted and declared posture, `match`, `differences`, `eventId` and `recordedAt`. A work item with no
posture event has an empty `postures` array. Auxiliary input remains unable to supply posture or
other canonical facts and continues to fail closed.

## Scope and authority

This ruling resolves W6's design choice only. It authorizes preparing a separate W6 task breakdown
for owner approval. It does **not** authorize implementation, W7–W9, a live run or any external
effect. The W6 task itself remains owner-approval gated.
