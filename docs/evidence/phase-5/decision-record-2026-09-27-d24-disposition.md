# D-24 production-suitability review: disposition recorded

Date: 2026-09-27, before the 2026-10-02 escalation and the 2026-10-09 due date.
Source: the owner's in-session answers, each chosen as recommended, to the brief
`docs/proposals/2026-09-27-d24-disposition-brief.md`. Record:
`docs/evidence/phase-5/d24-production-suitability-review.json`.

| Item | Ruling | What it means |
| --- | --- | --- |
| The record's first question | **Unruled deviation from D-24.** | No record authorized the fixture's code to live in production packages. Decision 5-A ruled who implements, not where the code lives; the Phase 5 plan assumed isolation; the charter's isolation was behavioural. The deviation's reach, checked 2026-09-27: one re-export from `packages/domain/src/index.ts` and the `?surface=decision-notice` and `?surface=decision-notice-capture` routes in `apps/web/src/main.tsx`; no other production module depends on it. |
| Disposition | **`reuse_concepts_only`.** | The validated behaviour and design lessons are retained: the twenty-state acceptance contract, the accessibility and state matrices, the surface and focus contracts. The fixture's code is not reused in production. |
| Reviewer | **The owner, as recorded.** | The agent roles can run again (the 2026-09-27 smoke passed), but the owner chose not to spend turns on an agent review. The record's independence limit stands: independent of the implementation, not of the governance. |

## What follows, and what does not

- The fixture leaves the production packages and bundle: the re-export and the two routes. This is
  new work under its own specification, plan and tasks. It must move or retire the four Phase 5
  browser suites that reach the fixture through those routes
  (`tests/accessibility/phase-5-decision-notice-a11y.spec.ts`,
  `tests/accessibility/phase-5-decision-notice-state-matrix.spec.ts`,
  `tests/e2e/phase-5-decision-notice-isolation.spec.ts`,
  `tests/visual/phase-5-decision-notice-states.spec.ts`). Until it lands, the deviation continues,
  recorded.
- The accepted fixture stays immutable evidence: commit `7995618`, the five pinned blobs, and the
  195-artifact evidence set by `setDigest`.
- The disposition is recorded, so D-24 no longer blocks the Phase 5 fixture initiative from closing.
  Closing it is a separate owner act.

## Authority

Rulings only. The removal is not authorized by this record.
