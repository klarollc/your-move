# Owner ruling: Your Move agent-side speech acts

**Date:** 2026-10-05  
**Decision:** Approved as written  
**Proposal:** `docs/proposals/2026-10-04-your-move-agent-speech-acts-proposal.md`

The owner approved the speech-acts proposal as written and authorized implementation through its
ordered §7 RED–GREEN gate. The four proposed event kinds, command mapping, actor/role binding,
manager-only boundaries, replay behavior, and truthfulness limits are within the approved scope.

Implementation must keep all writes on `executeWorkCommand`, use the existing loopback command
endpoint and canonical event log, and derive every view from `replayProject`. The server binds agent
identity and role assignment from authenticated runner/session context; it never trusts those
identity fields from the request body.

Question-answer events, inferred answers, notification delivery, W12, and the §20 comprehension run
are explicitly outside this ruling. No live provider session, promotion, deployment, or external
effect is authorized.
