# D-24 production-suitability review — disposition brief

**Status: RULED 2026-09-27** as recommended: unruled deviation; `reuse_concepts_only`; the owner
as reviewer. Recorded in `docs/evidence/phase-5/decision-record-2026-09-27-d24-disposition.md`.

Author: agent, 2026-09-27. Governing: MDD D-24 (§3 table, "Fixture isolation and guaranteed
production review"), the review record `docs/evidence/phase-5/d24-production-suitability-review.json`
and `docs/evidence/phase-5/decision-record-2026-09-25-task-10-owner-acceptance.md`.

## The clock

Owner acceptance 2026-09-25. **Escalation 2026-10-02** (five business days left), **due 2026-10-09**
(America/Los_Angeles, Monday to Friday, no holidays: the record's own calendar). Nothing in the code
tracks this; this brief and the record are the whole mechanism. `defer_until` needs a new date, a
dependency, an owner and a risk, and stays open.

## Facts, checked 2026-09-27 against `hermes/phase-4-task-15-evidence`

- **The accepted fixture is unchanged.** Four of the five accepted files are byte-identical to
  commit `7995618` (same git blobs). `apps/web/src/main.tsx` changed once since
  (`f300a06`, Phase 7-O Task 9b): an office `fixtureId` URL parameter, not the decision notice.
- **Nothing new depends on it.** No production module outside the fixture's own files imports
  the decision-notice domain module or components. It is reachable only through the domain
  package's re-export (`packages/domain/src/index.ts`) and the `?surface=decision-notice` and
  `?surface=decision-notice-capture` routes in `main.tsx`. (Two same-named types elsewhere,
  `EvidenceLink` and `Clock`, are local definitions, not imports.)
- **`fixtures/decision-notice` holds only `export {}`**, as it has since the Phase 0 scaffold.
- **The agent roles can run again.** The record names the owner as Delivery Lead and as
  independent reviewer because both agent roles "cannot run" (DF-021). That was fixed by the Codex
  currency work: a `release-reviewer` smoke turn passed on 2026-09-27 under the pinned 0.157.1
  with the feature policy on.

## The first question the record poses

Is the fixture sitting in production packages already a D-24 breach, or an accepted consequence
of Decision 5-A?

What the record set says:

- D-24: "Direct copying or importing of fixture code into production is blocked until
  `promote_candidate` is followed by" the listed approvals.
- Decision 5-A (hybrid implementation) decided **who** implements. It says nothing about **where**
  the code lives.
- The Phase 5 plan's risk table names the risk "Phase 5 quietly becomes production work" and
  answers it with "The fixture is isolated by D-23 and reuse is a separate D-24 scope."
- The charter's "isolation" (rule 5, gap 8) is **behavioural** isolation (no external effect, no
  network), which Task 6 and C-11 proved. That is not code-location isolation.
- Task 9-E moved the captures to the production bundle, for C-11, under its own remediation
  record. That ruled on capture, not on where the fixture's source lives.

**Reading, not a ruling:** no record decides that the fixture's code may live in production
packages, and the plan assumed it would not. On the text, it is an **unruled deviation from D-24**
rather than an accepted consequence of 5-A. Its reach is narrow: one re-export and two URL routes.

## The four dispositions, and what each sets in motion

| Disposition | What it means | Work it creates |
| --- | --- | --- |
| `promote_candidate` | The component is a candidate for real product use. | A separately scoped production architecture review and RED–GREEN–REFACTOR cycle (architecture, security, accessibility, dependency, maintainability, production tests) before any reuse. The code may stay where it is meanwhile, but only as a candidate. |
| `reuse_concepts_only` | Keep the validated behaviour and design lessons (the twenty-state contract, the accessibility matrix, the surface contract); do not reuse the code. | Take the fixture out of the production packages and bundle (the re-export and the two routes), leaving the accepted commit as immutable evidence. A small, separately planned task. |
| `do_not_promote` | Archive the fixture as acceptance evidence, with rationale. | The same removal from production as above. |
| `defer_until` | A new date, with a dependency, owner and risk. | None now. The fixture keeps shipping in the production bundle until then, which is the deviation continuing. |

Any disposition except `promote_candidate` implies the fixture should leave the production
packages, because D-24 blocks production import without it. That removal is not one line: the Phase 5
browser suites that run in every `verify` (`tests/*/phase-5-*`) reach the fixture through the
`?surface=` routes, so they must move with it to a fixture-only entry point or be retired as
historical, and the removal needs its own plan. Removing it does not touch the
evidence: the accepted version is commit `7995618` and the 195-artifact evidence set is pinned by
digest (`setDigest f9ff6a9b…`).

## Recommendation

**Rule the first question as an unruled deviation, and dispose `reuse_concepts_only`,** with the
removal from the production bundle planned as its own small task.

Why: the component was built as an acceptance fixture under a hybrid process whose stated purpose
was to prove governance, not to produce product code (5-A: "Phase 5 will therefore *not* prove
that agents can write the code"). What proved valuable is the contract and its verification, not
the implementation. The production approval surfaces the office will need (principle 5, explicit
human authority) are better built from that contract inside the production architecture than by
promoting fixture code into it.

What would change this: a product decision that the decision notice itself, as built, is the
production approval surface. Then `promote_candidate` is the right door, and it opens a larger,
separately scoped review. If the Phase 7-O and Phase 7 sequence should settle that first,
`defer_until` with that dependency is the honest alternative, at the cost of the deviation
continuing.

## Who reviews

The record names the owner as reviewer because the agents could not run. They can now. Two
options, both honest:

- **Keep the owner as reviewer** (as recorded). No spend; independence is from the
  implementation, not the governance, as the record already says.
- **Ask the `release-reviewer` agent for an independent review** of this brief and the evidence
  set before the ruling. A bounded spend (the Phase 5 ledger has 41 of 60 turns left; which ledger
  pays would itself need a ruling). The ruling stays the owner's.

## What the owner is asked

1. The first question: unruled deviation, or accepted consequence of 5-A?
2. The disposition, by 2026-10-09 (escalation 2026-10-02).
3. The reviewer: the owner as recorded, or an agent review first.
