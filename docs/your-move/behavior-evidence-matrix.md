# Your Move behavior-to-evidence matrix

**Status:** implementation in progress; this matrix distinguishes projected behavior from actions
that cannot yet be written through the approved core. Evidence is from the current `workflow-proof`
worktree and is not owner visual acceptance.

| Approved behavior | Current evidence | Status and remaining gap |
|---|---|---|
| One log projection through `replayProject`; source, trust, revision, missing provenance, partial and damaged reads | `apps/web/src/work-list-model.ts`; `work-list-model.unit.test.ts` | Implemented; focused projection tests pass. |
| Fresh empty, all clear, calm on every landing, global unfiltered rail | Browser at 1440×900 (fresh empty) and 1280×800 (all clear); `work-list.tsx` | Implemented; directly inspected. The rail is above the list at 390×844. |
| Filtered-empty explanation, fractional counts, session collapse, deterministic group ordering | `work-list.tsx`; `work-list-model.ts` | Implemented in the projection/view; broader ordering and filter coverage still needed. |
| Disconnect age, stale master lamp, damaged/gapped log and log-versus-revision disagreement | `work-list-model.unit.test.ts`; `ReadHealth` projection and disabled actions | Implemented and covered at model level; current browser session used a healthy log. |
| Failed evidence is a blocker; verified, recorded-not-checked, claimed, and missing stay distinct | `work-list-model.unit.test.ts`; `work-list.component.test.tsx` | Implemented; tests cover failed evidence and the evidence-state distinctions. |
| Detail replaces the list column, retains the rail, shows agreement/evidence/risk/trail | `work-list.component.test.tsx`; browser accessibility tree at 390×844 | Implemented. Risk and downstream-blocked links are truthfully named as absent. The core does not carry enough links to name dependent work. |
| Defer reason/resurface point; accept, accept-anyway, send-back, and receipts | Current UI disables ruling buttons; workflow-core proposal in `docs/proposals/2026-10-04-your-move-workflow-core-proposal.md` | Blocked on owner approval of the new core event/command semantics. |
| Master lamp and full-log time travel with past writes disabled | `work-list-page.component.test.tsx` | Implemented; test covers whole-projection replay and disabled past actions. |
| Two-sided journey only after confirmed append; reduced-motion behavior | `work-list-page.tsx`, `work-list.tsx`; component test for reduced motion; browser emulation confirms `prefers-reduced-motion: reduce` is observed | Reduced-motion cancellation is covered. A current browser journey was not produced; no real attention ruling command is available yet. |
| Ruling session, skip/requeue, arrivals, progress and tally | `work-list.component.test.tsx` | Read-only session and skip are implemented. Actual rulings remain disabled; new-arrival and final-tally coverage is incomplete. |
| Away digest grouped from log, including “nothing happened” | `work-list.component.test.tsx`; browser log-derived digest | Implemented. A regression now scopes last-seen revision by project and resets a baseline ahead of the log. |
| Quiet suggestions >3 days; one per work item; send, snooze and dismiss | `work-list.component.test.tsx`; disabled controls | Suggestions are projected. Persisted nudge/snooze/dismiss is blocked on core approval; no message delivery exists, so the UI cannot claim notification. |
| Attested acceptance; assignee lens; ruling receipts | Attestation and assignee tests; detail panel states `approval.recorded` is only an artifact binding | Attestation and lens are read-only projections. A true ruling receipt waits on the ruling command/event; existing artifact approvals are described narrowly. |
| Turn-budget counts, grants, re-scope and close-incomplete | Workflow-core proposal; current D-26 contract has no numeric budget | Not implemented; missing budget is not inferred. Core proposal defines a budget and derived exhaustion. |
| Agent-authored create draft before `work.created` | New work view explains the missing draft service and sends no command; page test verifies no `/api/commands` call | Not implemented. No provider or fake draft is used. Needs a separately scoped real draft capability before a truthful create flow. |
| Worktree digest bound into recorded evidence | Current projection shows missing/present evidence and posture digests; proposal defines collector and canonical policy | UI display exists; event/collector binding awaits workflow-proof approval. |
| Product title “Your Move” | `apps/web/index.html`; `scripts/your-move-name.test.mjs` | Implemented; RED assertion failed against the old title, then GREEN passed. |

## Verification performed

- `npm run build` passed after the project-scoped away-digest fix; it runs `npm run typecheck` first.
- Focused model tests: 8 passed. Focused component tests: 14 passed. Position and product-title
  tests: 8 passed. The title test first failed against the old name, then passed after the fix.
- Prettier check passed for every changed implementation, test, status, proposal, matrix, and
  reference file in scope.
- The isolated browser used a disposable temp log. Its item was created by `executeWorkCommand` and
  appended with the existing `appendEventLog`; the configured runner reported unavailable. No
  project event log or live runner was used.
- At the captured 1280×800 browser load, `/api/session`, `/api/workflow/status`, and `/api/log`
  returned 200 and the console had no warnings/errors. A prior `/api/session` request was canceled by
  an explicit reload; the replacement request succeeded. The 390×844 page had no horizontal
  overflow (`scrollWidth` 390) and retained the rail.
- No owner visual acceptance, W12 work session, §20 comprehension run, or live-provider result is
  claimed.
