# Decision record — the announcement channel republishes a repeated message

Date: 2026-09-18
Ruled by: the owner, in session, after the RED was demonstrated
Touches: C-10. Related: DF-019, C-08.

## What was found

The surface has one spoken channel, a single `aria-live="polite"` paragraph whose text is replaced.
Writing an identical string to the same text node is not a DOM mutation, so the same refusal twice
announces once. An empty deferral reason submitted twice produces a correction, then silence.

The visible `role="alert"` channel has the same defect: it already holds that exact text, so the
second submit changes nothing on screen either. This is not screen-reader-specific.

## The ruling

The announcement state carries a sequence number which keys the rendered child, so React replaces
the node on every publication and the mutation is real.

Rejected: clearing the region and re-setting it on a tick, the usual remedy, because C-08's static
scan asserts this component's source cannot reach `setTimeout`, `requestAnimationFrame` or any
timer, and that scan is inside the gate. Also rejected: an alternating zero-width space, which
leaves an invisible character in the announced text and reads as inexplicable to the next person;
and two alternating regions, which is more DOM for the same effect.

## Evidence

**RED, recorded and not re-run after GREEN.** `C-10: the same refusal twice publishes twice, so it
can be heard twice` failed with `expected 1 to be greater than 1` — the second identical refusal
produced zero mutations, observed through a `MutationObserver` on the region. The companion
characterization test, `a transient announcement is always followed by a settled one`, passed on
arrival and is **labelled a guard rather than TDD evidence**, per the rule that a test which never
failed for the right reason is not TDD evidence.

Seven `setAnnouncement` call sites are unchanged; only the state shape and the rendered child moved.

## The limit, stated plainly

**Necessary, not shown to be sufficient.** The test asserts a DOM mutation occurred. Whether a node
replacement inside a polite live region actually makes a screen reader speak is real-browser
behaviour that no suite here can observe — jsdom has no assistive technology and neither does
Playwright. This lands as *the channel republishes*, never as *the person hears it*. Queued for the
next human walkthrough with the unresolved C17-SR-01 re-walk.

## Recorded and unruled

The visible `role="alert"` channel still produces no change on a repeated identical refusal. The
same remedy applies; it was not authorized here.

The owner has separately indicated that screen-reader behaviour may be out of scope for a
single-user tool. If that is ruled, it should amend C-17 and MDD section 19 rather than leave them
asserted and unenforced, or the next release review will again refuse to certify against a
criterion nobody intends to satisfy.
