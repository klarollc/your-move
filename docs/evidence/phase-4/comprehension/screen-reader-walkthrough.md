# Manual screen-reader walkthrough script

Status: **Script only. Not yet run.**
Required by MDD §19 and the Task 15 gate. Automated axe scans are evidence, not certification;
this walkthrough is the part axe cannot perform.

## Environment to record

```
Screen reader and version:        (NVDA or Narrator on Windows)
Browser and version:
Viewport:                          1440x900 or 1280x800
Build (git rev-parse --short HEAD):
Date:
```

## Rule

Record what was **announced**, not what is on screen. If an element is visible but silent, that is
a finding. If an announcement is technically present but unintelligible in context, that is also a
finding. Do not repair anything mid-run; note it and continue.

## W1 — Entry and structure

Load `/`. Tab once.

- Is a skip link announced, and does it name its destination?
- Is the main landmark announced with a name?
- Navigate by landmark. Are the project bar, office scene, office outline, and any open overlay
  each announced as distinct named regions?
- Navigate by heading. Does the heading order describe the office without gaps?

## W2 — The office outline as an equivalent interface

MDD §10 requires the outline to be an equivalent primary interface, not a degraded fallback.

- Move through the outline. Are all seven zones announced?
- Are all six people announced, each with a state and a relationship?
- Is the canvas announced as secondary, or does it interrupt?
- **Judgement to record:** could you operate the office from the outline alone, without sight of
  the scene? Answer yes or no in one sentence, and say what made the difference.

## W3 — Selection and inspector

Activate an entity trigger.

- Is the inspector announced on open, with the entity named?
- Are state, cause, freshness, current work, blocker, and evidence each announced as label and
  value rather than as loose text?
- Close it. Is focus returned to the trigger, and is the return announced?

## W4 — Attention

Open the manager attention rail.

- Is the item count announced?
- For each item: is the plain-language cause announced, and the required action?
- Dismiss one. **Is it announced in a way that could be mistaken for approval?** Dismissal is
  explicitly not approval; if the announcement is ambiguous, that is a V1 finding.

## W5 — Collaborative kickoff

Open `/?kickoff=revision`, reach the kickoff from the collaboration table.

- Is the panel announced as a named region?
- Is the briefing version announced?
- Are the six contributions announced with both role and agent?
- Is the disagreement register announced with attribution to the Release Reviewer?
- **Is an unanswered role announced as "No response recorded"?** If it is announced in any way
  that could be heard as agreement, that is a V0 finding — silence must never read as assent.
- Is the decision impact announced, and does it state that no work is authorised?
- Close the panel. Is focus returned to the trigger?

## W6 — Failure states

Load `/?state=offline`, then `/?state=permission-denied`.

- Is the degraded state announced, or must it be discovered visually?
- Is the cause announced in plain language?
- Is the recovery action announced and reachable?
- **Is anything announced that implies work is progressing?** If so, that is a V0 finding.

## W7 — Reduced motion

Enable the operating system's reduce-motion setting and reload `/`.

- Is the same information announced as without it?
- Is any announcement lost that was previously carried only by motion?

## Findings

Record each finding with a severity from MDD §1133–1140.

```
ID    Step  Severity  What was announced        What should have been announced
```

V0 and V1 findings block the graybox gate. V2 findings require an explicit owner disposition.
An empty findings table is a valid result only if every step above was actually performed;
record any step that was skipped and why.
