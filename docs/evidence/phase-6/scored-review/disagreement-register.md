# Phase 6 Task 7 — scored review and disagreement register

Status: **Both reviews performed 2026-09-13. Scores support discussion and select nothing.** Selection is the owner's at Task 8.
Runs: `docs/evidence/phase-6/scored-review/runs.json`
Transcripts: one per reviewer, in this directory.

## How the review was run

Two promoted roles, the two the brief names for this task, each in one bounded text-only turn:
`gpt-5.6-luna` at `medium` effort, read-only sandbox, `approvalPolicy: never`, no tools, no external
effect, each isolated in its own controlled Codex home carrying only its composed brief. Two provider
turns in total. Neither reviewer saw the other's output and the runs did not share a thread.

Both received the identical packet, digest `d52648c7811f13a4…`.

## The limit both reviewers were told about, and what they did with it

**Neither reviewer was shown the rendered compositions.** A bounded text-only turn cannot open an
image. They received measured data and declared intent *about* the candidates — palettes, measured
contrast, prop counts, shadow parameters, avatar specifications, state treatments, accommodation
counts, provenance gaps.

They were instructed to score only where the data genuinely supports a judgement, and to write
NOT-ASSESSABLE with what they would need to see otherwise.

**Both refused the majority of the rubric.** Each returned 9 scores and 33 refusals across
3 candidates × 14 criteria. Every perceptual criterion — office-before-dashboard clarity, glance
readability, calmness, warmth, material coherence, reciprocal legibility, collaboration clarity —
was refused by both, in all three candidates.

That is the correct outcome and it is the most useful thing this run produced. A review that scored
"warmth without toy-like character" from a palette listing would have been exactly the green run
that proves nothing.

## Disagreements, recorded rather than averaged

The rubric requires that disagreement be recorded and not reconciled by arithmetic. Four stand.

### D-1 — Criterion 7, inclusive agent expression

- **Product Designer: SCORE 5** for all three. Cited the avatar specification: varied builds, hair,
  accessories, a seated-wheelchair agent, and role signalled by work area, tools and label rather
  than body.
- **Visual QA Reviewer: NOT-ASSESSABLE** for all three. "Avatar specifications indicate varied
  builds, hair, mobility, and accessories, but the rendered legibility and treatment require visual
  inspection."

**Not resolved here.** The two roles are reading different objects: the designer is scoring the
contract, the reviewer refuses to accept a contract as rendered evidence. On this project's own
rule — never treat a state probe as visual proof — the Visual QA Reviewer has the stronger position,
and the Product Designer's 5 should be read as "the specification is sound", not "the avatars work".

### D-2 — Criterion 8, accessible contrast and focus intent

- **Product Designer: SCORE 5** for all three. All checks pass.
- **Visual QA Reviewer: SCORE 4** for all three, noting the worst state marker is "narrowly 3.02:1"
  (A), "3.01:1" (B), "3.04:1" (C).

The reviewer is reading the margin, not just the result. Both are scoring the same numbers; they
disagree about whether clearing a threshold by 0.01 deserves full marks.

### D-3 — Criterion 9, feasibility in PixiJS/WebGL and the DOM shell

- **Product Designer: NOT-ASSESSABLE** for all three. Wanted implementation and runtime evidence.
- **Visual QA Reviewer: SCORE 4 / 4 / 3.** Scored from the declared implementation parameters and
  marked Candidate C down for "the 14px plinth, 0.9px edges, depth treatment, and layered shadows".

**This is the only criterion on which the three candidates separate at all.** It is also the one
where the two roles most clearly disagree about whether declared parameters constitute evidence.

### D-4 — Criterion 11, originality and provenance quality

- **Product Designer: SCORE 4** for all three — clean provenance, reduced for the absent external
  research and the missing raster half.
- **Visual QA Reviewer: SCORE 3** for all three — same two reasons plus the typeface finding, that
  four of six named faces could not be embedded in Phase 7.

Both docked the same gaps; the reviewer weighted them harder and counted one more.

## What this review does and does not give the owner

**Gives:** independent confirmation that provenance is clean and that both roles regard the two
recorded gaps as real enough to cost marks. Confirmation that accessibility passes, with a noted
thin margin. One discriminating signal — Candidate C is the most expensive to implement.

**Does not give: any basis for choosing between the three candidates on how they look.** Every
perceptual criterion was refused by both reviewers, in all three candidates, for the same reason.

**The honest conclusion is that Task 7 cannot complete its purpose in a text-only turn.** The scored
review exists, it is independent, and it is well-founded on the data it had — and it leaves the
selection at Task 8 resting entirely on the owner looking at the compositions. Delivering these two
transcripts as though they narrowed the field would misrepresent what they say.

## What would change that

A reviewer that can see the artifact. The composition SVGs are in the repository and render in a
browser; a review conducted with rendered captures in front of a human reviewer, or by an agent with
image input, would convert most of the 33 refusals into scores. That is a scope decision for the
owner, not a defect in these runs — the runs are bounded exactly as the Task 16 packet requires, and
the bound is what produced the refusals.
