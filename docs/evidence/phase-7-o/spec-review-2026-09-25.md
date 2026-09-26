# Review — Phase 7-O operability specification v0.1

Date: 2026-09-25. Reviewer: agent (Cowork session), at the owner's request.
Subject: `docs/phase-7-o-operability-spec-v0.1.md` (uncommitted draft, dated 2026-09-24).
Basis: source read at working tree over `6a210e7`. **No build, browser or test was run.**

**Recommendation: revise before approval.** The spec is careful and correct about truthfulness.
But as written it can pass every machine criterion while giving the owner no more decision detail
than today. It would make the inspector honest by filling it with "unavailable". The one finding
that motivated Phase 7-O, F-3, would then only be caught by the cold comprehension run at the very
end, after a three-day wait.

## Verified claims

Checked against source. All hold:

- `projectOfficeScene` sets agent `causeEventId` and `updatedAt` to `null` and freshness to
  `unavailable` (`packages/domain/src/office-scene.ts`).
- `WorkItemTruth` has no assignee (`packages/domain/src/work-truth.ts`). Staffing assignments map
  role → agent, never work → agent (`staffing-truth.ts`).
- `projectManagerAttention` derives items from work state and open questions only.
- The default office builds no canonical snapshot. Its attention items and library projection are
  hand-written in `apps/web/src/office-canvas.tsx`.
- Approved viewports 1440×900 and 1280×800 (MDD D-07); cold gap of at least three days (MDD §20).

The spec also corrects an overstatement in the 2026-09-22 proposal. That proposal said
`projectOfficeScene` covers the inspector's Cause and Updated fields. It does for work items and
collaborations, but not for agents, and agents are what the owner clicks on.

## Finding 1 — High: the canonical record cannot answer the decision questions, and the spec does not decide what to do about it

The event vocabulary (`packages/contracts/src/events.ts`) has no field for most of what §3 asks the
inspector to show:

| §3 field | Canonical source today |
| --- | --- |
| Work ↔ agent relation | **None.** No event links a work item to an agent. |
| Blocker / waiting-on detail, responsible party | **None.** `work.transitioned` carries `workItemId`, `fromRevision`, `toState` only. There is no reason, no waiting-on, no requester. |
| Required action wording | **None.** The rail's `plainLanguage` and `requiredAction` strings are hand-written in `office-canvas.tsx`. |
| Agent cause event / last update | **Not retained.** Presence events are applied without keeping their event id or time. |
| Approval requirement | Partial: `requiredEvidenceKinds` and approval records exist. |
| Evidence links | Yes, per work item. |

So the Test Engineer contradiction (§2) cannot be resolved *truthfully and usefully* from existing
events. Built on today's vocabulary, the honest result for the Test Engineer is "Work-to-agent
relation unavailable". The rail item "Test evidence is blocked" loses its explanation too, because
that text has no canonical source.

The spec notices only the assignment gap. It defers that to the implementation plan as "a separate
design choice", and does not mention the blocker-reason and required-action gaps at all. **This is
a contract and domain change, not a plan detail.** It is the main scope decision of the phase and
belongs in the spec, where the owner approves it. Options:

- **A. Extend the canonical vocabulary.** Add a work → agent assignment event. Add a structured
  reason, waiting-on and requested action to transitions into `blocked`, `waiting_input` and
  `review_requested`. Retain the event id and time on agent presence changes. These are additive
  changes to `contracts` and `domain` under existing packages, so they stay within "no new backend
  packages". **Recommended.** It is the only option under which drill-down can show real detail.
- **B. Accept "unavailable" for agents.** Make work items the drill-down subject and show agents
  only as presence. Cheaper, and honest. But the owner's comprehension tasks are phrased around
  people, so T1, T3 and T6 likely get worse.
- **C. Use the spec's "versioned auxiliary records".** Not recommended as the answer. An auxiliary
  record carrying the explanatory text is the hard-coded string again, in a different file. If §3
  keeps this escape hatch, it needs a rule that auxiliary records must carry their own canonical
  cause event and cannot supply state, blocker or approval facts.

## Finding 2 — High: every machine criterion passes on an all-"unavailable" inspector

§6.1 (sensitivity), §6.2 (agreement) and §6.3 (adversarial) all test that the UI never says
something false. None tests that it says something useful. An inspector that renders "unavailable"
for every field satisfies all three. Only §6.6, the cold human run, would catch that, and it runs
last.

Add a **decision-sufficiency criterion** checked by machine before the human run. In the default
fixture, for each open attention item, the inspector for the related entity must *resolve*
(not unresolved) the cause event, the blocker or waiting condition, the required action, and at
least one evidence link. Also name the fixture states that must resolve for T3, T4 and T5. This
turns F-3 into a failing test now instead of a finding three days after implementation.

## Finding 3 — Medium: the default fixture's provenance is unspecified

Today the default office is hand-written projection output. The spec requires a canonical snapshot,
but it never says the default office becomes an **event log replayed through `replayProject`**, or
who authors that log. This is the "honest fixture written by its own author" problem again, one
level down. Specify that:

- default and named states are event logs, versioned and reviewed like evidence;
- the web layer never constructs projection output directly, which a structural guard can check:
  `apps/web` may import projectors but not construct `ManagerAttentionItem` or inspector records.

## Finding 4 — Medium: freshness semantics disagree with the projector

§3 lists `current | delayed | unavailable | unresolved`. `projectOfficeScene`'s `freshness()`
returns `delayed` for an unparseable or missing timestamp. It should be `unavailable`, since a
missing time is not a late time. Name which one the spec intends and require a test.

`replayProject` also silently selects the first project id when a log contains several. It records
`MULTIPLE_PROJECTS` as an issue, but the spec's read model should state that any replay issue
blocks presenting the revision as current.

## Finding 5 — Low: the Evidence Library cannot open at an item or version today

`evidence-library.tsx` accepts only `initialEvidenceKind` and picks the first record of that kind.
§4's "opens at the referenced item/version" is new behavior. Fine to require, but the plan should
list it as such, not as existing behavior.

## Finding 6 — Low: comprehension-run hygiene

§6.6 says to align the task URLs and answer key "before the cold interval begins". Add that:

- the key is committed and hashed before the interval, so it cannot drift during it;
- the "anything I could only answer because I built it" field is kept, since the owner will have
  reviewed this spec and the UI;
- the per-task performed mark is recorded by the operator, not reconstructed afterwards (F-4 of the
  2026-09-08 run).

## What is good and should stay

- "`None recorded` is valid only when the source was examined and explicitly establishes absence."
  This is the right rule and fixes the literal at the heart of the V1.
- Dismissing a rail item never resolves the blocker in inspector truth.
- The ban on role-name and array-position joins.
- Tests must mutate authoritative input and verify the mutation landed. This matches the handoff's
  "a mutation that fails to apply" lesson.
- Completed ≠ approved, with approval bound to exact artifact and evidence versions.

## Suggested owner decisions before approval

| ID | Question | Recommendation |
| --- | --- | --- |
| R-1 | Finding 1: extend the canonical vocabulary (A), accept agent-level "unavailable" (B), or use auxiliary records (C) | A |
| R-2 | Add the decision-sufficiency machine criterion (Finding 2) | Yes |
| R-3 | Default and named office states become replayed event logs; `apps/web` may not construct projection output (Finding 3) | Yes |
