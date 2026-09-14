# Decision record — Phase 6 golden states approved

Status: **OWNER APPROVED 2026-09-13.** Recorded against `640a376`.

## What was approved

All five golden states, as produced in the approved Task 8 reconciliation
(`reconciliation-b-clarity`) and rendered at both approved viewports:

| State | Captures | Semantic-motion subjects |
| --- | --- | --- |
| `01-default-office` | 1440×900, 1280×800 | 2 — the active work item and its agent |
| `02-active-collaboration` | 1440×900, 1280×800 | 3 — work, its agent, the collaboration |
| `03-manager-escalation` | 1440×900, 1280×800 | 0 |
| `04-blocked-work` | 1440×900, 1280×800 | 0 |
| `05-visual-review` | 1440×900, 1280×800 | 0 |

The sixth state the brief names — reduced-motion equivalents — is established rather than drawn
separately: every capture contains zero animation constructs, so a reduced-motion viewer receives
exactly the frame everyone else does. There is no motion to remove.

## What the approval rests on

The owner viewed the rendered golden states. Two of the acceptance criteria are perceptual and could
not have been settled any other way:

- **"No fake activity"** for `04-blocked-work` — whether a blocked office reads as stopped.
- **"A single clear attention path"** for `03-manager-escalation` — whether one subject asking for
  the manager is unambiguous, and nothing competes.

Both were flagged to the owner as the judgements only he could make, and the approval followed
direct inspection of those frames.

## What this approval does not do

It does not promote the visual system from Candidate to Active. That is a separate, explicitly
owner-run action under the Phase 6 gate, and it is Task 10's subject. It does not authorize Phase 7
high-fidelity implementation, and it does not create a visual regression baseline.

## Corrections made before this approval, recorded so the approval is not read as covering them

Three defects were found while producing these states and fixed before they were shown:

1. Task 6 had documented twenty of twenty-two canonical states; collaboration kinds are a third
   family and both carry motion.
2. No work transition propagates to the agent holding it, so the first blocked fixture animated an
   agent beside stopped work — the fake activity the brief forbids by name.
3. `02-active-collaboration` rendered byte-identically to `01-default-office`, because the renderer
   drew nothing with the participants it was given.

A Task 6 cue requiring "participants co-located at the shared surface" was also corrected: the
canonical state never moves an agent, so rendering them gathered would have been fake proximity.

The approved states are the corrected ones. Nothing above is waived.
