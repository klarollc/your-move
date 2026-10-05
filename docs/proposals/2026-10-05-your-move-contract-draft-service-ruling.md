# Owner ruling: Your Move contract-draft service

**Date:** 2026-10-05
**Decision:** Approved as written
**Proposal:** `docs/proposals/2026-10-04-your-move-contract-draft-service-proposal.md`

The owner approved the contract-draft service proposal as written and authorized implementation
through its ordered §7 RED–GREEN gate. The approved source is the CuckCode-owned
`contract-drafter-v1` procedure through the pinned Codex App Server session adapter; draft
provenance is server-bound, pre-approval drafts remain transient, and approved creation records the
original candidate separately from the manager-approved final contract in the shared
`work.created` event path.

Implementation and verification use only the test-only fake adapter. Fake receipts must remain
structurally isolated and cannot authorize a production create. No live provider session is
authorized by this ruling. If the pinned model is unavailable, stop for another ruling rather than
substituting a model.

W12, the §20 comprehension run, promotion, deployment, and notification delivery remain outside
this ruling.
