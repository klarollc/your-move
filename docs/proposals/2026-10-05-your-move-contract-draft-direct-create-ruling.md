# Owner ruling: direct manager-authored work creation

**Date:** 2026-10-05  
**Decision:** Approved as written  
**Proposal:** §11 of `docs/proposals/2026-10-04-your-move-contract-draft-service-proposal.md`

The owner approved the focused direct-create amendment as written and authorized implementation
through the ordered RED–GREEN gate.

The v4 `work.created` record has strict, mutually exclusive manager and agent provenance variants.
The manager variant records `draftSource: "manager"` with no agent candidate or provider session
identifiers. New agent-draft records use an explicit `draftSource: "agent"`; the complete prior v4
agent shape remains replay-compatible. v1–v3 replay remains unchanged and reports that draft source
was not recorded.

Without a receipt, the authenticated manager may create a validated contract as manager-authored
through the existing `work.create` command and shared log. A supplied invalid receipt remains a hard
refusal and never falls back to direct creation. Draft-first stays the default. Surface B exposes the
direct route only after the deliberate label in §11.3, and shows “Draft source: manager” plainly.

This ruling does not authorize a live provider session, W12, the §20 comprehension run, promotion,
deployment, or other external effects. Receipt mechanics and the approved draft service remain
unchanged.
