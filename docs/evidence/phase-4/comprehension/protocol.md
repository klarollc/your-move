# Phase 4 comprehension protocol — single operator

Status: **Protocol only. Not yet run.**
Authority: MDD §20 comprehension-study success criteria. The MDD states that thresholds are
"provisional until the owner approves the study design"; this design was approved on 2026-08-18.

## Why this design

MDD §20 specifies five representative non-technical evaluators with a 4-of-5 threshold. CuckCode
is a single-operator personal tool, so the population under test is one person and n=1 is the
correct sample.

That substitution has a known weakness and it is recorded rather than hidden: **the operator
designed the interface.** The §20 criteria measure whether the office can be read *without*
having built it. Run immediately, this protocol measures recall, not comprehension.

The control is delay. Run this cold, after a deliberate gap — **days, not hours** — without
re-reading the design documents first. The gap is the only thing standing in for evaluator
naivety, so a rushed run produces no evidence and should be recorded as void rather than as a pass.

## Rules

1. Do not open `docs/`, `.ui-craft/`, or the source before or during the run.
2. Do not open `answer-key.md` until every response is written down.
3. Answer from the interface alone. If you cannot answer, write "cannot tell" — that is a real
   result and more useful than a reconstructed one.
4. Record the date of the last substantive work on this interface, and the date of this run. If
   the gap is under three days, mark the run **void**.

## Setup

```powershell
cd C:\Users\nater\CuckCode
npm.cmd run dev:web
```

Use one approved viewport for the whole run: 1440×900 or 1280×800. Record which.

## Tasks

Each task names a URL and a question. Write the answer before moving on.

### T1 — Assignment and state (§20: identify each agent's assignment and state)

Open `/`. Without clicking anything, write down what each of the six people is doing.
Then write: which one is furthest from needing you?

### T2 — Attention (§20: locate the item needing manager attention)

Still on `/`. What needs your attention right now, and what is the system asking you to do
about it? Write the action you would take.

### T3 — Waiting versus blocked (§20: distinguish waiting from blocked)

Open `/?state=permission-denied`, then `/?state=offline`.
For each: is work stopped because something is *missing*, or because someone is *waiting on you*?
Write which, and what told you.

### T4 — Completed versus approved (§20: distinguish completed from approved)

Open `/`, locate the Delivery area, and open its evidence.
Write: has anything been approved? How do you know? What would approving it require?

### T5 — Evidence and next action (§20: inspect evidence and take the correct next action)

Open `/?kickoff=revision`, reach the collaborative kickoff, and read it.
Write: what has the team proposed, who disagreed and with what, who has not responded, and what
is the next thing you must do before any work can start?

### T6 — Truthfulness (§20: explain that the office represents real state, not simulated productivity)

Open `/?kickoff=round`.
Write: is the team currently working? What in the interface tells you whether the office is
showing real recorded state rather than an animation of activity?

## Response sheet

Copy this block into `run-<date>.md` and fill it in before opening the answer key.

```
Date of last substantive interface work:
Date of this run:
Gap (days):                       Void if under 3.
Viewport:
Build (git rev-parse --short HEAD):

T1 assignments and states:
T1 furthest from needing me:
T2 what needs attention / action:
T3 permission-denied — missing or waiting, and why:
T3 offline — missing or waiting, and why:
T4 approved? how do I know? what would approval require:
T5 proposal / dissent / non-responders / next required action:
T6 working now? what shows this is real state:

Anything the interface made me guess at:
Anything I could only answer because I built it:
```

The last two lines matter more than the score. A criterion passed by recall is a criterion the
interface did not carry.

## Scoring

Six criteria, each pass or fail against `answer-key.md`. A criterion passes only if the written
answer is correct **and** the operator did not note that it was answered from memory of building
it.

- 6 of 6 — criterion met.
- 5 of 6 — met, with the failed criterion recorded as a named Task 15 finding.
- 4 or fewer — **not met.** The graybox gate does not pass on comprehension. Record which criteria
  failed and what the interface did not carry.

A failed run is a result, not an obstacle. The point of running it cold is that it can fail.
