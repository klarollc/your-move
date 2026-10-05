# Your Move behavior-to-evidence matrix

**Status:** the ordered workflow-core gates and implementation verification are green. This matrix
records technical implementation evidence, not owner visual acceptance. The real agent-authored
contract-draft service remains unavailable pending its separate proposal and ruling; W12 and §20
remain gated owner actions.

## Approved seven-item change set

| Decision | Reconciliation with approved workflow-core proposal | Surface B implementation and evidence |
|---|---|---|
| 1. Derive resurface; require honest defer input | No `work.resurfaced` event. Due state derives from `work.ruling_recorded` plus the replay clock. | Defer requires a reason and future `datetime-local` value converted to UTC. The calm certification cites only derived due state. `work-list-model.unit.test.ts` verifies due grouping/wait age and absence of a resurface event; `work-list.component.test.tsx` verifies the real future-time input. |
| 2. No browser-verified evidence; show each line | Attestation is replay-derived; the browser supplies no counts or verified claims. Exception acceptance does not change evidence state. | Escalation detail and ruling session show per-obligation states. Tests cover checked, recorded, claimed, and missing lines; exception acceptance preserves the shown state. Worktree digest is read from logged evidence, never typed into the ruling. |
| 3. Require override reason | `accept_with_exception` requires a non-empty reason in the approved command. | The override reason is required before submit; component and core command tests cover it. |
| 4. Receipts make no delivery claim | No delivery adapter exists, so receipts report logged effects only. | Ruling/nudge receipts say “recorded at rNNN” and “visible on next check-in”; tests reject “sent” or “notified” wording. |
| 5. Re-scope records full terms and diff | Approved `work.rescoped` event records a full contract revision and preserves history. | The edit form submits a replacement contract; the projection retains revisions and shows an old-to-new diff. Component coverage opens the item from the assignee lens and verifies the diff. |
| 6. Show manager queue age | Age derives from manager-attention event time or the recorded due time; no new event is added. | Model projects `waitingMs`; the rail uses plain wording such as “your move for 6 days.” Model and component tests cover the calculation and label. |
| 7. Numeric grant, omitted-event count, scoped watermark | Positive integer turn grant uses the approved command. The away watermark remains project-scoped. | Turn grant uses the entered number; away digest reports omitted events; local-storage key retains the project ID. Items with no recorded turn budget now say turn use is unavailable and expose no budget actions. |

## §8 behavior coverage

| Approved behavior | Evidence | Status / limit |
|---|---|---|
| One projection through `replayProject`, provenance, evidence states, missing values, stale/damaged/disagreement states | `apps/web/src/work-list-model.ts`, `work-list-model.unit.test.ts` | Implemented. Projection/adversarial tests pass; malformed and incomplete log states disable writes. |
| Fresh empty, all-clear, filtered empty, calm landing, unfiltered rail | `work-list.tsx`, browser screenshots in the local temp QA directory | Implemented. Current production build was inspected at 1440×900 and 1280×800. Captures are temporary technical QA, not owner evidence. |
| Deterministic ordering, collapse, filters, fractional counts, full oldest-first rail | `work-list-model.unit.test.ts`, `work-list.component.test.tsx` | Implemented and covered by projection/component tests. |
| Failure states, escalation detail, manager aging, honest resurface, line-level evidence, full re-scope diff | `work-list-model.ts`, `work-list.tsx`, focused unit/component tests | Implemented; W12 is not run. Downstream links and risk remain explicitly unavailable where the core has no facts. |
| Master lamp, log time travel, past-write refusal, confirmed-append journey, reduced motion | `work-list-page.tsx`, `work-list-page.component.test.tsx`, component motion test | Implemented and covered. Browser reduced-motion preference and keyboard focus were exercised. |
| Ruling session, digest, quiet suggestions/suppression, attestation, assignee lens, receipts/undo | `work-list.tsx`, projection/component/page tests | Implemented through approved commands and replay. Session and detail show per-line evidence states; receipts do not claim delivery. |
| Server-measured worktree digest bound to evidence; mismatch/missing refusal | `apps/server/src/worktree-digest.ts`, `loopback-session.ts`, `work-list-page.component.test.tsx` | Implemented in stages 1–4; page tests cover missing and mismatched digest and ensure failed commands do not advance the projection. |
| Agent-authored contract draft before `work.created` | `NewWorkUnavailable`; page test verifies no command request | Not available; plainly disabled/explained, with no simulated drafting. Brief service proposal follows the authorized push. |
| Agent-side question/proposal/dispute speech acts | `docs/proposals/2026-10-04-your-move-agent-speech-acts-proposal.md` | Draft only; implementation waits for a separate owner ruling. |

## Verification performed in this gate

- Proposal §7 stages 1–5 passed focused RED–GREEN checks in order; stage 6 `npm run verify` exited 0.
- Full suite results: unit **905/905**, component **182/182**, integration **150 passed / 3 skipped**,
  contract **140/140**. Lint, formatting, typechecks, build and the remaining verification commands
  also passed.
- Provenance check: **429 artifacts**, **695 ledger lines**, zero missing ledger artifacts and zero
  stale digests. The existing **131 unattributed** items remain visible in the report; this run added
  or rewrote none. Side-effect scan found zero network, credential, deployment, destructive, or paid
  operations.
- Production browser checks used an ephemeral empty log and no runner. E2E, Axe accessibility, and
  reduced-motion visual checks each passed at **1440×900** and **1280×800** (2/2 per suite). The
  preview had no console errors, page errors, or failed requests; screenshots are temporary test
  artifacts, not owner visual evidence. Keyboard focus and reduced-motion behavior were directly
  checked. Axe initially found the calm screen had no level-one heading; the page-level heading was
  corrected and both viewport checks then passed.
- No live runner/provider, W12 session, §20 comprehension run, promotion, or owner visual acceptance
  is claimed.
