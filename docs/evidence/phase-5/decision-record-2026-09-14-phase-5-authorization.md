# Decision record — Phase 5 authorization, charter, and the ten evidence gaps

Status: **OWNER RULED 2026-09-14.** Recorded against `825db72`.

The owner ruled eight items put to him directly. Six further gaps are answered here from documents
the owner has already approved, and are marked as such rather than as fresh rulings — an approved
document answering a question is not the same as the owner answering it again, and conflating the two
is how a record starts asserting authority it was never given.

---

## Ruled by the owner

### Charter disposition → **approved, with the ten gaps as blocking conditions**

The Task 17 synthesis becomes the versioned charter. Each of the ten evidence gaps must be answered
before any criterion depending on it can be satisfied. The four `amend` revisions fold in.

This is the disposition the agents themselves argued for: the Delivery Lead's amendment asked that
every unresolved gap carry a named owner and block implementation, and the Release Reviewer affirmed
on exactly that condition. The owner's ruling matches the round's own recommendation rather than
overriding it.

### 5-A, who implements → **hybrid**

Agents own the surface contract, the test strategy, the visual-QA annotation and the independent
release verdict. Implementation is driven conventionally against their contract.

**This is a departure from the literal MDD §24 run**, which assigns implementation to the
Implementation Engineer. The departure is recorded rather than glossed: Phase 5 will therefore *not*
prove that agents can write the code, and the Phase 5 packet must say so. What it proves is narrower
and still substantial — that six bounded roles can govern real work to a standard an independent
reviewer accepts.

One benefit is structural rather than economic: with a human implementing and an agent reviewing,
**reviewer independence is guaranteed by construction** rather than by policy. That answers gap 9.

### 5-B, budget → **60 turns, stop and report**

Roughly four to five times the kickoff. The run stops at 60 and reports what was reached. It does not
negotiate, extend, or ask for more mid-run.

### 5-D, MDD §19/§20 → **repeat the gate properly**

Phase 5 builds a real accessible component, which is where the walkthrough that Phase 4 waived can
actually be performed. **Coverage: one screen reader — NVDA or Narrator on Windows — one walkthrough,
genuinely performed**, recorded with what was exercised and what was not.

The waiver exists because zero walkthroughs were run, not because one was judged too few. One
performed walkthrough closes the debt; a second would strengthen the claim but would also widen the
approved D-07 browser matrix, which is a separate decision nobody has made.

### Gap 4, acknowledge and defer → **mutually exclusive, defer requires a date and a reason, both reversible**

One decision is acknowledged *or* deferred, never both. Defer requires a future date and a non-empty
reason, both validated. Either action can be undone, and **the undo is itself an event** rather than
a mutation that erases what happened.

### Gap 5, severity and dates → **three levels, ISO-8601 UTC, explicit unknown and malformed states**

Severity is `routine`, `significant`, `critical`. Dates are stored ISO-8601 UTC and rendered in the
viewer's locale. Unknown severity and a malformed date each render as a **named explicit state**,
never blank and never guessed — the truthfulness invariant the project enforces everywhere else.

### Gap 6, evidence links → **local fixture artifacts, resolved and verified in-session**

Links point at artifacts inside the fixture. Present links resolve; missing, invalid and unavailable
links each render a named state. **Nothing external is ever fetched**, so the no-network constraint
holds while the failure paths stay real and testable.

---

## Answered from already-approved documents, not newly ruled

### Gap 1 — the approving manager and owner

Both are the project owner. The project has a single operator; MDD Amendment D already records
single-operator verification and owner waivers as the working model.

### Gap 2 — viewports, browser matrix, accessibility standard

Settled by **D-07**: desktop Chromium at 1440×900 and 1280×800. The accessibility standard is **WCAG
2.2 AA minimum**, from `.ui-craft/tokens.md`. Only the assistive-technology coverage was genuinely
open, and the owner ruled it above.

### Gap 3 — fixture schema, provenance, retention, superseded artifacts

Design work inside Phase 5 Task 2, not an owner decision. It must follow the existing content-address
and evidence-immutability patterns already built in Phase 2.

### Gap 7 — art direction and state inventory

The art direction is the **Active visual system promoted in Phase 6**, `reconciliation-b-clarity`.
The state inventory is design work in Task 3 and must cover every state the acceptance contract names.

### Gap 8 — failure evidence, console and network capture, isolation verification

The patterns exist from Phase 4: deterministic failure fixtures, clean console and network checks,
and fixture isolation already have machine-checked precedent in this repository. Task 6 reuses them.

### Gap 10 — the apparent ordering paradox

The agents noticed that "no implementation before charter approval" and "current-build visual
evidence" appear to conflict. They do not: the constraints are sequential. Charter → acceptance
contract → surface contract → RED → implementation → **then** current-build capture. Visual evidence
is captured from a build that exists because the charter authorized it.

Worth recording that the round caught this at all. It is a genuine reading of the constraints as
written, and it is the sort of thing that produces a stalled phase when nobody notices it in advance.

---

## What this record does not authorize

Phase 7, high-fidelity implementation beyond the Active system, deployment, external effects, or any
production reuse of fixture code. Task 10 owner acceptance remains owner-run. The 60-turn budget is a
ceiling, not a target.
