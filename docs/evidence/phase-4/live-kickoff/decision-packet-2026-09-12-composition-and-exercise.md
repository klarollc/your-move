# Decision packet — role composition, promotion exercise, and the authorization contradiction

Status: **DECISION PACKET. Nothing implemented. No provider call made. Nothing promoted.**
Prepared 2026-09-12 against `2b4fb4d` plus the uncommitted working tree.
Prepared by an orchestrating agent from three independent read-only audits. Not owner-approved.

This packet does not request approval for new work. It consolidates decisions already requested by
two uncommitted proposals, corrects three factual defects found in them before the owner rules on
them, and raises one contradiction in the authorization record that no proposal raised.

---

## 0. Read this first — the authorization record contradicts itself

Three documents disagree about whether Task 17 is authorized.

| Document | What it says |
|---|---|
| `docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md:12` | "Approving this packet authorizes Task 17: one bounded live kickoff." Marked **APPROVED BY THE OWNER 2026-09-08**. |
| `AGENTS.md:20` | "Tasks 16–17, executable role promotion, any live kickoff ... remain unauthorized pending separate explicit approval." |
| `tasks/phase-4-todo.md:105` | "Task 17: Bounded live kickoff and manager charter. **UNAUTHORIZED**." |

The packet grants Task 17 conditionally: §7 states that approval "does not make the run possible"
and that the remaining Task 16 work — machine-enforced promotion and preflight checks — must exist
first. Commit `e994188` is titled *"check live kickoff binding preconditions, completing Task 16"*,
which asserts that condition is now met.

`AGENTS.md` has not been modified since `ca957dd`. Neither boundary document was updated when the
packet was approved, nor when Task 16 was completed.

**This is not a documentation nit.** `AGENTS.md` opens by instructing every agent to read it as
authority and to stop if implementation and documentation disagree. They disagree. Every
"unauthorized" judgement made downstream — including the three proposals' own status lines and this
packet's restraint — rests on a boundary statement that the owner's own approved packet appears to
have superseded four days before the proposals were written.

**Decision 0 (blocking, and prior to every other decision below):**
Which document governs?

- **(a)** The packet governs. Task 17 is authorized, its §7 condition is satisfied by `e994188`, and
  `AGENTS.md` + `phase-4-todo.md` are stale and must be amended to match.
- **(b)** `AGENTS.md` governs. The packet's authorization was conditional on §7 work the owner has
  not personally accepted as complete, Task 17 remains closed, and the packet's line 12 must be
  amended to say so.
- **(c)** Something between: Task 17 is authorized in principle but a named further gate remains.

Nothing below should be implemented until this is answered, because (a) and (b) place the same work
on opposite sides of the boundary.

---

## 1. Corrections applied to the uncommitted drafts

Three factual defects were found by independent audit against the tree. All three were in text the
owner would have read as evidence. Each has been corrected **in place with a visible correction
note**, not silently amended.

### 1.1 The stack-assumption count was wrong — "four of six", actually two

Occurrences of `laravel|livewire|fluxui|alpine` per upstream file at commit `ebe9c99`:

| Count | File | Role |
|---|---|---|
| 22 | `engineering-senior-developer.md` | implementation-engineer |
| 8 | `project-manager-senior.md` | delivery-lead |
| 1 | `testing-reality-checker.md` | release-reviewer |
| 0 | `design-ui-designer.md` | product-designer |
| 0 | `testing-test-automation-engineer.md` | test-engineer |
| 0 | `testing-evidence-collector.md` | visual-qa-reviewer |

The single hit in `testing-reality-checker.md` reads "Verify what was actually built (Laravel or
Simple stack)" — a conditional, not an assumption.

Verified count: **two** files substantively assume the stack, one incidental mention, three none.

Corrected in `docs/proposals/2026-09-13-task-17c-2b-role-composition.md` (§2b heading and §7.4),
`docs/proposals/2026-09-13-exercise-before-promotion.md` (§2), and
`docs/evidence/dogfood-register.md` (DF-011, with a dated correction note).

The finding is unaffected — two of six is still disqualifying for those two roles. The figure was
simply wrong, and it had already propagated from the proposal into the evidence register.

### 1.2 An unsupported content claim, withdrawn

`2026-09-13-task-17c-2b-role-composition.md` §5 stated:

> "The probe found the owner's own `AGENTS.md` instructing an agent to ask questions before acting
> and to wait for approval before executing."

No probe established this. The probe recorded the *path* `C:\Users\nater\.codex\AGENTS.md` in
`instructionSources` and nothing further. Both
`docs/evidence/phase-4/live-kickoff/probe-2026-09-11-codex-facts.md` ("contents have not been
examined") and DF-010 ("The file has not been read") state explicitly that the contents were never
examined.

This is the DF-009 shape — a claim attributed to evidence that does not support it — appearing
inside the document arguing for better provenance. **Claim struck**, with the structural point
(an unpinned instruction source of *unknown* content loads into every thread) preserved.

### 1.3 Overlay thinness understated

"one or two responsibilities" is wrong: `responsibilities` is **exactly one** for all six overlays,
without exception. Skills are 2–3, deliverables exactly 2. The overlays are thinner than the
proposal claimed, which strengthens rather than weakens its §7.2 limitation.

### 1.4 Not a defect — dates

The drafts are dated 2026-09-13 while the commits read `2026-09-12 18:08 -0700`. That is
`2026-09-13 01:08` UTC. This is a timezone artifact, not future-dated evidence. **Left alone
deliberately**; "correcting" it would introduce an error.

---

## 2. Verified baseline

`hermes/phase-4-task-15-evidence`, working tree unmodified except the drafts under discussion.

| Check | Result |
|---|---|
| `npm run typecheck` | PASS (incremental; `.tsbuildinfo` pre-existing, not a cold build) |
| `npm run lint` | PASS, zero warnings at `--max-warnings 0` |
| unit / component / integration / contract | **343 passed, 3 skipped, 0 failed** across 67 files |
| `npm run build` | PASS |

The 3 skipped are the live-Codex probes, each gated `CUCKCODE_LIVE_CODEX === "1"`. They were
correctly not run. Playwright e2e/a11y/visual were not exercised — they require a dev server — so
**no visual or accessibility claim in this packet is evidence-backed**, per the AGENTS.md rule that
a build or unit result is never visual proof.

---

## 3. Task 17c sub-task ledger

Numbering per `docs/proposals/2026-09-10-task-17c-live-kickoff.md` §3.

| Sub-task | Purpose | Status |
|---|---|---|
| 17c-1 | Live probe: does anything report the model / enumerate tools | **Committed** (`96cbf74`). Model *is* reported at `thread/start`; tool surface is *not* enumerated anywhere. |
| 17c-1b | Confirm `CODEX_HOME` is honoured (unplanned addendum) | **Committed** (`96cbf74`). It is; `instructionSources` then contains only the controlled file. |
| 17c-2 *(as specified)* | Freeze promotion request; ship a `roles:promote` write command | **Not implemented.** No `roles/promotion-request.json`; only the read-only `roles:promotion:status` exists. |
| "17c-2a" *(as shipped)* | Binding report records `reasoningEffort`, `toolIds`, `sandboxPosture` | **Committed** (`2b4fb4d`). **Naming drift:** this is *not* the spec's 17c-2. It is unrelated work never numbered in the approved sequence, and the spec was not amended. |
| 17c-2b | Role composition — promoted role → instruction text | **Proposed, unapproved, uncommitted.** No `composeRole` exists. |
| 17c-3 | Collapse the protocol-version pin from three copies into one | **Not implemented.** |
| 17c-4 | `collectHandshakeFacts` from an observed live session | **Not implemented.** Type exists; nothing populates it from a live session. |
| 17c-5 | The kickoff harness | **Not implemented.** `npm run kickoff:live` does not exist. |
| 17c-6 | The supervised run itself | **Not run.** |

---

## 4. The blocking chain

In dependency order to reach a first supervised live kickoff:

1. **Decision 0** (§0) — which document governs. Everything else is downstream.
2. **17c-2b role composition.** Verified: nothing in `packages/` or `scripts/` turns a promoted role
   into instruction text. `kickoff-preflight.ts:32` formats digests into a version string; that is
   the closest thing that exists. A run built on today's tree would give six agents identical
   instructions. MDD D-25 requires "each agent submits one concise proposal or critique **from its
   assigned responsibility**" and a Delivery Lead synthesis "preserving disagreements" — six
   identically-instructed agents cannot exercise that clause. The proposal's "green run that proves
   nothing" argument is supported by the tree and by D-25.
3. **Exercise-before-promotion**, if adopted, sits *upstream of promotion itself* — it adds a
   refusal to `planPromotion`, so even 17c-2's promotion CLI could not succeed for these six roles
   until each is exercised.
4. **17c-2** (promotion freeze + CLI) — still entirely unbuilt.
5. **17c-4** `collectHandshakeFacts` — blocked on an unresolved *contract* question, not just code:
   17c-1 established the runtime does not enumerate a tool surface, so `toolIds` and
   `permissionCeiling` have no honest source. Sandbox bounds are not tool exposures.
6. **17c-5** the harness, then **17c-6** the run.

**Also blocking, raised by no proposal:**

- **DF-010 is unruled.** Every thread loads an unpinned instruction file of unknown content from a
  directory that also holds provider credentials. 17c-1b showed a controlled `CODEX_HOME` fixes this
  mechanically, but the *decision* to require it is open and the file has still not been read.
- **DF-009 is unfixed.** Verification results have no provenance. By the register's own admission
  every RED/GREEN claim in this chain is potentially unattributable to the tree state it ran
  against — including the evidence for `2b4fb4d`.
- **Six concurrent sessions are untested.** Named in the 17c spec's risk list, still untested.

---

## 5. Open owner decisions

Decision 0 (§0) first. Then:

**Role composition** (`2026-09-13-task-17c-2b-role-composition.md` §7)
1. Compose from **overlay fields only**, never upstream markdown, with `sourceSha256` re-scoped to
   pin provenance/attribution rather than injected content? *(yes/no)*
2. Accept that first-run role differentiation will be thin — one responsibility, 2–3 skills, 2
   deliverables per role — recorded as a stated limitation up front rather than a post-hoc finding?
   *(yes/no)*
3. Channel split: composed role → controlled Codex home `AGENTS.md` (identity); turn contract and
   briefing → `thread/start` `baseInstructions` (task)? *(yes/no)*
4. Should `roles/manifest.json` record stack-incompatibility separately from `status: candidate`?
   All six are currently `candidate`, which records only "faithfully imported, not yet promoted" —
   it cannot express "describes a stack this project does not use." *(yes/no; if yes, what field)*

**Exercise before promotion** (`2026-09-13-exercise-before-promotion.md` §8)
5. Require every role to be exercised once against the real runtime before promotion, refused by a
   named code when absent? *(yes/no)*
6. Approve the exercise shape: one bounded text-only turn per role, identical standard prompt, four
   mechanical assertions, transcript read by the owner, marked performed/not-performed? *(yes/no)*
7. Exercise the six existing roles before any promotion, as the gate's first use? *(yes/no)*

**Carried forward, still unruled**
8. **DF-010** — three-way choice, open since 2026-09-11: (a) controlled Codex home so no unpinned
   instruction loads; (b) digest whatever `instructionSources` reports and fold it into the material
   fingerprint; (c) accept and document as a known uncontrolled input.
9. **17c sequence scope** — approve §3 as written or a named cut; the spec flags 17c-3 as deferrable.
10. **Promotion is owner-run** — confirm the agent writes `promotion-request.json` and the command,
    but the owner runs promotion. *(yes/no)*
11. **Model-unreported fallback** (reserved by the 17c spec, not yet live): if some path genuinely
    never reports a model, should the binding say "unobserved" or be refused outright?

### These are not independent

**Decisions 1/3 and 5/6 are a package.** The exercise's fourth mechanical assertion —
"`instructionSources` contains exactly the composed role file" — presupposes `composeRole` exists
and is approved. Approving the exercise gate without composition leaves it nothing to exercise.
Approving composition without the exercise gate reintroduces DF-011 exactly: a composed but
unexercised role can still fail in ways only a live turn reveals, which is that proposal's thesis.
They arrived as two documents and should be ruled on as one.

---

## 6. What can proceed without a ruling

Honestly: **almost nothing.**

Every remaining substantive step — 17c-2, 17c-2b, 17c-3, 17c-4, 17c-5, and the exercise gate — is
either a behavioral change requiring its own RED/GREEN cycle under a proposal whose own first line
says "not approved", or is gated behind a decision above. Writing any of it now would repeat the
pattern the register diagnosed three times running (DF-009, DF-010, DF-011): work done inside a
boundary nobody has drawn yet.

Two exceptions, both documentation:

- **Commit the pending drafts** (two proposals, the DF-011 entry, this packet). Pure record-keeping;
  AGENTS.md already requires preserving audit artifacts. Closes the gap between what the tree
  records and what actually happened, which is a precondition for ruling on §5 with accurate
  information.
- **Amend whichever boundary document Decision 0 deems stale.** Cannot be done before Decision 0,
  because the answer determines which document is wrong.

---

## 7. Named weakness carried into this gate

This packet was assembled by agents, and two of its three inputs were audits *of documents written
by an agent*, which found a wrong count propagated into the evidence register and one claim
attributed to a probe that did not support it. Both were caught by reading the tree rather than by
any test. That is the same lesson DF-010 and DF-011 record, now observed a third time at one more
level of remove — and it is the argument for the exercise gate restated: the thing that finds these
problems is cheap contact with reality, not another guard written inside the same boundary.

No visual, accessibility, or live-runtime claim in this packet is evidence-backed. The baseline in
§2 is unit-level only.
