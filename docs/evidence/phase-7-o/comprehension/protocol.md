# Phase 7-O comprehension protocol — single operator, cold

Status: **Prepared 2026-09-28 (Task 10). Not yet run.**
Authority: MDD §20 comprehension criteria and n=1 protocol; Phase 7-O spec §8.7;
`tasks/phase-7-o-todo.md` Tasks 10 and 11.

## Preamble

Answer key: `docs/evidence/phase-7-o/comprehension/answer-key.md`
Answer key SHA-256: `e7a18da9445bc52db9b0790b1bd085e08b1201c391c2eaacd9b85dfd725a93fc`

`scripts/comprehension-preamble.test.mjs` checks this digest against the committed key inside
`verify`, and `tests/e2e/phase-7o-comprehension-key.spec.ts` checks every fact in the key against
the rendered interface. **Do not open either file, or the key, before the run.**

The three-day interval starts from the commit that adds this file. Record it before starting:

```powershell
git log -1 --format="%h %ci" -- docs/evidence/phase-7-o/comprehension/answer-key.md
```

If any file under `apps/web/src/` or `packages/ui-system/src/` changed after that commit, the
interval restarted at that change.

## Rules

1. Do not open `docs/`, `.ui-craft/`, `tests/`, `output/`, `node_modules/.cache/` or the source
   before or during the run. This file is the only exception.
2. Do not open `answer-key.md` until every answer below is written down.
3. Answer from the interface alone. If you cannot answer, write "cannot tell": that is a real
   result.
4. Mark each task **performed** or **not performed** when you finish it, not afterwards. A task
   not performed is never scored.
5. If the gap since the last substantive interface work is under three days, the run is **void**.

## Setup

```powershell
cd C:\Users\nater\CuckCode
npm.cmd run preview:web
```

This builds and serves the production bundle at `http://127.0.0.1:4174`, the build the Task 9
captures used. Use one approved viewport for the whole run, 1440×900 or 1280×800, and record it.

## Tasks

Each task names the paths to open. Write the answer before moving on. Open anything else the
interface offers; record the paths you actually opened.

### T1 — Assignment and state

Open `/`. Write down what each of the six people is doing: their state, and the work they hold, if
any. Then write: which one is furthest from needing you?

### T2 — Attention

Still on `/`. What needs your attention right now, and what is the system asking you to do about
it? Write the action you would take.

### T3 — Missing versus waiting on you

Open `/?state=stale`, then `/?state=permission-denied`, then `/?state=partial`. For each: is work
stopped because something is _missing_, or because someone is _waiting on you_? Write which, and
what told you.

### T4 — Completed versus approved

Open `/`, locate the Delivery area, and open its evidence. Write: has anything been approved? How
do you know? What would approving it require?

### T5 — Evidence and next action

Open `/?kickoff=revision`, reach the collaborative kickoff, and read it. Write: what has the team
proposed, who disagreed and with what, who has not responded, and what is the next thing you must
do before any work can start?

### T6 — Truthfulness

Open `/?kickoff=round`, then `/`. Write: is the team currently working? What in the interface tells
you whether the office is showing real recorded state rather than an animation of activity?

## Response sheet

Copy this block into `run-<date>.md` in this folder and fill it in before opening the answer key.

```
Interval start (commit and date, from the preamble command):
Last substantive interface work, if later:
Date and time of this run:
Gap (days):                       Void if under 3.
Viewport:
Build (git rev-parse --short HEAD):

T1  performed / not performed:
    paths opened:
    states and work:
    furthest from needing me:
    answered from memory of building it?  yes / no
T2  performed / not performed:
    paths opened:
    what needs attention, and the action:
    answered from memory?  yes / no
T3  performed / not performed:
    paths opened:
    stale — missing or waiting, and why:
    permission-denied — missing or waiting, and why:
    partial — missing or waiting, and why:
    answered from memory?  yes / no
T4  performed / not performed:
    paths opened:
    approved? how do I know? what would approval require:
    answered from memory?  yes / no
T5  performed / not performed:
    paths opened:
    proposal / dissent / non-responders / next required action:
    answered from memory?  yes / no
T6  performed / not performed:
    paths opened:
    working now? what shows this is real state:
    answered from memory?  yes / no

Anything the interface made me guess at:
Anything I could only answer because I built it:
```

## Scoring

After every answer is written, open `answer-key.md` and score each **performed** task pass or fail.
A criterion passes only if the answer is correct and not marked as answered from memory.

- 6 of 6 — met.
- 5 of 6 — met, with the failed criterion recorded as a named finding.
- 4 or fewer — **not met.** Record which criteria failed and what the interface did not carry.
- Any task not performed — the run is **incomplete**: neither a pass nor a failure.

A failed run is a result. The point of running it cold is that it can fail.
