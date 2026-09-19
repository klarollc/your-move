# Decision record — a non-actionable control keeps its place in the tab order

Date: 2026-09-18
Ruled by: the owner, in session, after the half-implementation was demonstrated from the source
Amends: Decision 7-C (`decision-record-2026-09-14-task-7-findings.md`). Touches C-10.
Findings addressed: C17-SR-03 and C17-SR-04 from
`screen-reader-walkthrough-2026-09-18.md`, both reclassified from "open" by this ruling.

## What was found

Decision 7-C ruled that action controls are rendered disabled rather than removed, and gave the
reason in as many words: *"removal also drops focus: a person who activates Acknowledge is standing
on a button that disappears underneath them."*

It was implemented with the native `disabled` attribute. A natively disabled button is not focusable
and is not in the tab order, so for a keyboard user the control is still not there. 7-C moved the
failure from *removed from the DOM* to *removed from the tab order*, which is the same experience it
was ruled to fix, and no test in the repository could see the difference.

Seven controls were affected: Acknowledge, Defer, Submit deferral, and the four evidence controls.

This is the mechanism behind two of the walkthrough's five findings, and it is why they are one fix
rather than two investigations:

- **C17-SR-04**, evidence rows reported silent. Their controls are disabled, so tabbing never
  reaches them. The row text is ordinary content and remains readable in NVDA's browse mode, so the
  defect is *unreachable by keyboard*, not *unreadable* — stated narrowly, because the two have
  different fixes.
- **C17-SR-03**, Defer neither spoken nor activatable. Same cause. An earlier reading in this
  session leaned toward an observation artifact on the grounds that Acknowledge and Defer are
  identically disabled. That was withdrawn: the asymmetry between the two is still unexplained, but
  the unreachability is real and in the source.

## The ruling

A control that cannot be actioned keeps its place in the tab order, announces that it is
unavailable through `aria-disabled`, and refuses activation. Reachable and inert, never absent.

Rejected: keeping the native attribute and recording keyboard unreachability as an open limit. It
would have left 7-C's stated rationale unsatisfied while appearing to satisfy it, which is the
condition that let this sit unnoticed since 2026-09-14.

## Evidence

**RED, recorded as an observation and not re-run after GREEN.** Four assertions over the three
non-actionable statuses and every unresolved evidence control: `aria-disabled` present, the native
attribute absent, and the control able to take focus. First attempt was discarded rather than
recorded: two of the four failed on `Found multiple elements with the role button` because
`afterEach(cleanup)` was registered inside one `describe` and never applied to a sibling block, so
renders accumulated across iterations and one case rendered a DOM the previous test had left behind.
A test that fails to resolve its query has not tested anything. The cleanup was hoisted to module
scope and the clean RED is 25 passed, 4 failed, every failure on
`expect(element).toHaveAttribute("aria-disabled", "true")` with `Received: null`.

**GREEN.** 29 in the file, 71 across the component suite. Full `npm run verify` green, including
e2e 50, a11y 46 and visual 62 — the C-09 state matrix and every axe scan pass, so the pattern
raises no detectable violation.

**Ten existing assertions moved with the ruling**, six in the component suite and four in the visual
spec, from `toBeDisabled()` to asserting `aria-disabled` explicitly. jest-dom's matcher does not
recognise `aria-disabled` and Playwright's handling of it is version-dependent; asserting the
attribute says what the criterion cares about rather than relying on a matcher's interpretation.
The intent of each — the control is present and non-actionable — is preserved, not weakened, and
the 7-C test's title now says *inert* rather than *disabled*.

**Appearance is unchanged, proven rather than asserted.** The four `:disabled` selectors in
`decision-notice.css` were widened to match `[aria-disabled="true"]` with byte-identical
declarations. All forty committed plates, twenty states at both viewports, were byte-compared
against the output of the run that carried this change: **forty identical, zero differing.** C-19's
owner fidelity acceptance of 2026-09-14 therefore still holds and no new fidelity look is required.

## The behavioural change to know about

These controls can now take the focus ring, which they could not before. That is the point of the
ruling. It also means any future capture taken with focus resting on a non-actionable control will
differ from its predecessor — none of the current forty do.

## What this does not close

The walkthrough's other three findings. C17-SR-01 remains unresolved pending a re-walk with the
surface recorded; C17-SR-02 and C17-SR-05 remain reclassified as artifacts of entering a state
directly rather than transitioning into it. See
`correction-2026-09-18-walkthrough-surface-provenance.json`, which is left as written: it was
accurate when recorded, and this ruling supersedes its status for SR-03 and SR-04 rather than
rewriting it to look as though it had always known.

Nor does it establish that a screen reader announces any of this. No suite in the repository can:
jsdom has no assistive technology and neither does Playwright. The tab order is now asserted; what
a person hears is not, and that gap is the subject of the announcement-sequence work that follows.
