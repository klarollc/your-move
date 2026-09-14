# Phase 5 Task 9 — the Release Reviewer's independent verdict

Run 2026-09-14 by the promoted `release-reviewer`. **Verdict: NEEDS WORK.** Eleven of twenty-one
criteria satisfied, zero overclaims, eight artifact versions cited by content address. Ledger 10 of
60.

This is a verdict, not an approval. Task 10 is owner-run.

---

## The verdict

> Certification is blocked by unmet criteria C-05, C-08, C-09, C-10, C-11, C-15, C-17, C-18, C-19 and
> C-20. In particular, the required human screen-reader walkthrough and owner fidelity acceptance do
> not exist, provenance remains blocked on gap 3, and several deterministic, persistence, focus,
> zoom, date-storage and isolation assertions lack complete evidence. The green suite and other
> reviewers' conclusions do not close these obligations.

**The reviewer is not the implementer.** Under Decision 5-A the implementation was written
conventionally; this role has never seen the working tree and was given the contract, the evidence
and what is outstanding. Its cross-check is deliberately one-sided: a refusal needs no defending, but
an eligibility claim made while the reviewer's own answer names unmet criteria is a contradiction
inside one document.

Its sharpest objections are ones no automated check in this repository makes:

- **A halved viewport is not 200% browser zoom.** The Phase 4 convention this project inherited
  emulates zoom by halving the viewport, and the reviewer declines to accept that as evidence for
  C-09. It is right, and the convention is now a known approximation rather than an unexamined one.
- **C-08 has no two-run byte-identical artifact.** Determinism is asserted by a test that runs twice
  in one process; nothing records two complete runs producing identical output.
- **C-15 never establishes that stored dates are normalised to ISO-8601 UTC** — only that they
  render correctly by locale.
- **Five journeys are not every journey** for C-11 and C-20.

---

## Three verdicts were run, and the first two were my fault

The first release verdict reported **four** of twenty-one satisfied. The third reports **eleven**. The
implementation did not change between them. What changed is that the brief stopped lying.

| Pass | Satisfied | What the brief was wrong about |
| --- | --- | --- |
| 1 | 4 / 21 | Cited verification pass 2 as current. It was authored fourteen minutes before the commit that closed three of the gaps it named. |
| 2 | 11 / 21 | Read the latest pass, but the evidence inventory omitted the credential and storage-write scans. |
| 3 | 11 / 21 | Nothing found. Every remaining reservation is substantive. |

Pass 1's reservations for C-04 and C-12 describe gaps that had already been closed. The reviewer was
reasoning, accurately, from a description of code that no longer existed.

The same defect had already produced two bad verification passes. Pass 3 of the verification marked
C-09 and C-20 `none` while the browser captures, accessibility runs and isolation records all existed
— because the verification brief still carried the sentence *"there are no browser or end-to-end
runs, no visual captures, no axe or accessibility runs"*, which was true the day it was written.
Pass 4, given the evidence, returned **ten full, eight partial, three none** against pass 3's three,
twelve and six.

**The phase was materially further along than its own records said, and the only reason the records
said otherwise is that the briefs withheld evidence that existed.** Recorded as DF-015.

---

## What was built so it cannot happen again

- **`scripts/phase5-evidence-inventory.ts`** reads `docs/evidence/phase-5` and reports what is there.
  No brief states what evidence exists any more; they ask this. It names the isolation record's
  actual fields rather than summarising them, which is what the third pass needed.
- **The verification runner records `assessedVersions`** — the content digest of every file the
  assessment covers. A coverage assessment is a statement about a particular build, and this is what
  lets a later reader ask whether it still describes anything.
- **The release brief finds the latest verification pass** rather than naming one, checks its
  recorded digests against the files on disk, and tells the reviewer plainly when the pass no longer
  describes the build.
- **`scripts/phase5-release-crosscheck.ts`** is extracted and unit-tested before its first use,
  because the Visual QA cross-check was not and spent its first outing accusing an honest annotation
  of dishonesty.

---

## What would change the verdict

The reviewer was required to say, and did:

1. Reload restoration after every action, and proof the injected adapter is the only persistence
   path (C-05).
2. Two complete runs with byte-identical output under the same injected inputs (C-08).
3. Real-browser 200% zoom at both D-07 viewports, not a halved viewport (C-09).
4. Focus checked against targets declared in advance, including after acknowledge success and reload
   (C-10).
5. Every journey, not five, for the isolation record (C-11, C-20).
6. Evidence that every stored date is normalised to ISO-8601 UTC (C-15).
7. A genuine screen-reader walkthrough naming the screen reader, build, exercised and untested paths
   (C-17).
8. Gap 3's provenance schema applied to every evidence artifact (C-18).
9. Direct inspection of all forty current-build images, and owner fidelity acceptance (C-19).
10. A refreshed independent release review tied to the completed evidence versions.

Items 1 through 6 are ordinary work nobody has authorized yet. Item 7 is what Decision 5-D committed
this phase to and has not done. Items 8 and 9 cannot be closed by an agent at all.
