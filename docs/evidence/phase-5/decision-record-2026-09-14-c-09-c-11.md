# Decision record — close C-09 and C-11

Date: 2026-09-14
Ruled by: owner
Follows: release review pass 4, which returned NEEDS WORK with C-09, C-11 and C-17 outstanding

## The question put

Release review pass 4 named three outstanding criteria. C-17 was already waived. The owner ruled the
other two closed as ordinary work.

## C-09 — "preserve" is a comparison, not a property

The criterion: *"At both D-07 viewports, reduced motion and 200% zoom each preserve every state's
accessible name and structure, with no horizontal overflow and no content lost."*

What existed was one state under zoom and nine under axe. The reviewer refused it in those words.

`tests/accessibility/phase-5-decision-notice-state-matrix.spec.ts` measures all twenty contract
states three times each — unconstrained, under reduced motion, under real device-metrics zoom — at
both viewports, and requires the two constrained readings to **equal the baseline**. A test that only
asked "is the name non-empty under zoom" would pass on a build that silently renamed everything.

The states are read from the surface contract rather than listed in the spec, which is decision
9-G's shape: "every state" is only a claim when the set is written down where a test can read it.

### What the mutants found

Three mutants, and the first one exposed a real weakness rather than confirming a strength.

- **A label hidden at the zoom width survived.** The measurement read `textContent`, which returns
  text CSS has hidden. A `@media (max-width: 800px) { display: none }` on the severity label — a rule
  that bites at exactly the width 200% zoom produces — passed the check. The measurement now counts
  only elements that actually render. This is the recurring defect again: a guard exact inside a
  boundary nobody examined.
- **A zoom that does not zoom fails.** Replacing the device-metrics override with `setPageScaleFactor`
  is caught by the `devicePixelRatio` assertion, which is decision 9-C's guard holding.
- **An animation under reduced motion fails** — but only once the global `!important` reset was
  removed. The first attempt at this mutant was not a mutant at all: the app already defends against
  it, and the test correctly reported no animation. Recorded because a mutant that "survives" for
  that reason is evidence about the app, not about the test.

## C-11 — a journey speaks only for the path it walked

The criterion asks for no network, credential, deployment, destructive or paid side effects. The
behavioral evidence was never in doubt: nine contract journeys, zero external requests, zero writes,
zero credential-shaped output. The reviewer refused it anyway and was right to — those records say
nothing about a path no journey took, and a path nobody walked is exactly where such an effect would
live.

`scripts/phase5-side-effect-review.ts` walks the import graph from three declared entry points — the
component as the browser loads it, the capture surface, and the pure core beneath both — and reads
every reachable first-party module. **36 modules, zero findings in all five categories.** External
packages reached by that graph: `react` and `zod`, whose internals are not walked and which the
artifact says so.

The entry points are declared rather than implied, because "all reachable code" means nothing without
saying reachable *from where*, and a reader can disagree with a list they can see.

### Two silent failures, caught before the artifact was believed

Both produced a clean, passing, wrong result:

- The resolver rewrote NodeNext `.js` specifiers to `.ts` and stopped. The component is `.tsx`, so it
  fell out of its own import graph. **Three modules, clean.**
- The import pattern could not cross a newline, so the component's eighteen-line named-import block
  was invisible. **Three modules, clean, again** — for a different reason.

A scan that resolves nothing finds nothing. Both are now unit-tested by name.

Three mutants against the live tree: a `fetch` deep in the reachable graph fires; a `document.cookie`
in the component fires; the same `fetch` in a module **not** reachable from the entry points does not
— which is the scope boundary working, not a miss.

## What neither of these establishes

The static review cannot see through dynamic dispatch, computed member access or `eval`, and does not
walk external package internals. The matrix measures what a browser renders, not what a screen reader
announces — C-17 remains waived and unperformed. Both artifacts state their own limits.

The static and behavioral halves of C-11 are independent evidence of the same criterion. Both are
required and neither substitutes for the other.
