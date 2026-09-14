# Decision record — the seven ordinary-work items from the Task 9 verdict

Ruled by the owner on 2026-09-14, against the Release Reviewer's `NEEDS WORK` verdict in
`docs/evidence/phase-5/release-review/pass-3.json`.

The verdict named ten things that would change it. Three cannot be closed by an agent — C-17 needs a
human screen-reader walkthrough, C-18 needs gap 3, C-19 needs the owner's own eyes — and are not
ruled here. The other seven were posed and all seven were ruled. Nothing was implemented beforehand.

---

## 9-A, C-05 reload and storage isolation → **all three, now**

Reload restoration after acknowledge, defer **and** undo; a static scan proving the component cannot
reach `localStorage`, `sessionStorage` or IndexedDB directly; and defined behaviour for an adapter
that throws and one that returns a corrupt payload.

The corruption case is the one with real product content. A malformed persisted state is a decision
the component currently makes by accident.

## 9-B, C-08 determinism → **two full capture runs**

Run the whole forty-cell capture twice and record the digest of every artifact from each run, then
assert they match. The existing evidence — same inputs twice in one process, plus a static
unreachability scan — stays; it is not replaced.

Two complete runs exercise the path that matters: injected clock, ID source, fixture and animation
policy through an actual browser. It would catch non-determinism the in-process test cannot, such as
a date formatted against the machine's timezone.

## 9-C, C-09 zoom → **real zoom through the DevTools Protocol**

A halved viewport changes layout width without changing text size. The two are not the same test and
the reviewer was right to refuse the substitution.

Real page zoom at both D-07 viewports, asserting content, accessible structure and zero horizontal
overflow. **This also corrects the Phase 4 convention**, which has described a halved viewport as
200% zoom across two phases of evidence.

## 9-D, C-10 focus → **declare the targets, then assert against them**

The focus destination for every transition — validation, acknowledge success, defer success, save
failure, reload — goes into the surface contract as data, and the tests read it.

A test that names its own expected target proves the code agrees with the test. Reading the contract
proves it agrees with the specification. That distinction is the criterion's entire point.

## 9-E, C-11 network → **capture against a production build**

C-11 asserts "the network panel is empty". Ninety-five requests per journey were recorded, every one
to the loopback origin, every one a Vite dev-server module load. As written the criterion cannot be
satisfied by any web page, because a page has to be fetched.

Serve the built bundle, so the panel holds the app's own assets rather than ninety-five module loads,
and read the criterion as no request beyond the page's own origin and assets — stated explicitly
rather than assumed. Ninety-five entries is a panel nobody reads; the point of the requirement is
that a person can audit it.

**Knock-on:** `playwright.config.ts` currently starts the dev server. Moving the Phase 5 captures to
a preview server affects how every spec is served and must not silently change the Phase 4 evidence.

## 9-F, C-15 stored dates → **assert on the persisted state**

Every date in the persisted state — notice due date, deferral review time, every event timestamp —
matches a strict ISO-8601 UTC pattern and round-trips unchanged through save and reload.

Not the form's output alone: the event log's timestamps and any externally supplied due date are
where a non-UTC value would actually arrive from. The property is very likely already true, which is
exactly the situation where nobody notices it stopping being true.

## 9-G, C-20 journeys → **enumerate them, then cover them**

"Every journey" currently has no referent; nothing in the contract says what the journeys are.

Write the set down as data — the canonical paths a person takes through the component, including the
ones that end in a refusal — run isolation across all of them, and add a guard that fails when a
journey exists in the list and not in the record. The same fix the capture matrix needed: *every*
stops being a word and becomes a checkable set.

States are explicitly **not** journeys. A journey is a sequence, and isolation over twenty end-states
would miss a leak that only happens in transit.

---

## What this record does not authorize

C-17, C-18 or C-19. Phase 7. Any change to the twenty-one criteria other than the C-11 reading stated
above. Re-running the Task 9 verdict as though these were already done — the `NEEDS WORK` verdict
stands as the record of what the phase was on 2026-09-14, and a later verdict is a later verdict.
