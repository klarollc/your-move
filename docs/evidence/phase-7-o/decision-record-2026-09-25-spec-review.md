# Phase 7-O specification review — owner ruling

Date: 2026-09-25
Source: owner's in-session reply, "your recommendations are all approved", to the recommendations
in `docs/evidence/phase-7-o/spec-review-2026-09-25.md` and the accompanying chat message.

| ID | Ruling | Effect |
| --- | --- | --- |
| R-1 | **A** | Phase 7-O extends the canonical event vocabulary so drill-down can resolve real detail: a work-to-role-assignment relation, a structured condition (reason, waiting-on, requested action) on transitions into `blocked`, `waiting_input` and `review_requested`, and retained cause event and time on agent presence changes. Additive changes to `contracts` and `domain`; no new packages. Auxiliary records may not supply state, blocker, approval or requested-action facts. |
| R-2 | **Yes** | Add a machine decision-sufficiency criterion: in the default fixture, every open attention item's inspector resolves cause, condition, requested action and at least one evidence link. |
| R-3 | **Yes** | Default and named office states become versioned event logs replayed through `replayProject`. `apps/web` may not construct projection output directly, and a structural guard enforces it. |
| Minor | **Yes** | Review findings 4–6: freshness for a missing timestamp is `unavailable`, and any replay issue blocks "current"; opening the Evidence Library at an item/version is new behavior; the comprehension answer key is committed and hashed before the cold interval. |
| Runner | **Specify only** | The agent may write a proposal for a Windows-side, allow-listed command runner so an agent can run `verify` and named suites without a human relay (housekeeping item 1). No implementation is authorized. |

This ruling authorizes **revising the Phase 7-O specification** to v0.2. It does not approve that
specification, a plan, tasks, or any implementation. v0.1 is preserved as the draft the review
assessed.

Next gate: owner review and approval of `docs/phase-7-o-operability-spec-v0.2.md`.
