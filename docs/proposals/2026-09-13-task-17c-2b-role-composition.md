# Task 17c-2b — Role composition

**Status: APPROVED AND IMPLEMENTED. Corrected 2026-09-13** — this line read "proposed, not approved. Nothing implemented" after the owner had ruled Q3 in `docs/evidence/phase-4/live-kickoff/decision-record-2026-09-12-roles-and-exercise.md` and `composeRole` had shipped (`7f1b748`, `packages/domain/src/role-composition.ts`). Section 1's claim that no code path turns a promoted role into an instruction is no longer true, and the six distinct exercise transcripts of 2026-09-13 are the evidence.

Author: agent, 2026-09-13.

## 1. The gap

There is no code path that turns a promoted role into something an agent runs under.

A `git grep` for `overlay` across `packages/` and `scripts/` returns digests, field validation and
digest comparison, and nothing else. `check-agency-agents.mjs` hashes the overlay and checks its
field shapes. `promote-roles.mjs` compares hashes. `kickoff-preflight.ts` formats the pair into a
version string. Nothing reads the upstream source markdown's content. Nothing produces text.

Six roles are imported, digested, field-validated, promotable, drift-checked and joinable against
qualifications. None of that produces an instruction.

**Consequence for Task 17c:** a live kickoff run today would be six identical agents with no role
identity. The round would complete, the orchestrator would behave correctly, the bindings would
verify, and the evidence would prove nothing about D-25. Six anonymous agents agreeing is not a
Delivery Lead synthesising five distinct perspectives. That is a green run that means nothing, which
is the specific failure this project's governance exists to prevent.

## 2. What the existing artifacts already decide

The design space is narrower than it looks, because two decisions are already recorded.

### The overlay states the authority relationship

Every overlay carries these disclosures verbatim:

- Upstream text is attributed reference input, not executable instruction.
- CuckCode project scope, permissions, TDD, evidence, and manager decisions override upstream
  examples.
- This overlay narrows authority and cannot grant tools, credentials, deployment, publishing,
  spending, or role activation.

### The manifest already names a "normalized role"

`implementation-engineer` carries:

```json
"quarantinedSegments": [
  { "sha256": "29b191b6...", "treatment": "excluded_from_normalized_role" }
]
```

This matters more than it first appears. At import time, a decision was recorded that a specific
segment of upstream text is **excluded from the normalized role** — which presupposes a normalized
role that upstream text otherwise enters. An exclusion is only meaningful against an inclusion.

So the tempting simplification — compose only from overlay fields and never touch the upstream
markdown — contradicts a decision already in the manifest. It would also make `sourceSha256` a pin
on a file that never reaches the agent: half the promotion guarantee guarding nothing, while reading
as though it guarded something.

**That was my reading before I had read the upstream files. Having read them, it is wrong.**
See §2b.

## 2b. What the upstream files actually contain

Read 2026-09-13, all six, at commit `ebe9c99`. They total roughly 56KB. They are not role
descriptions: they are **agent personality prompts written to be executed**, with headings like
"🚨 Critical Rules You Must Follow", "🚨 Your Mandatory Process", and "🧠 Your Identity & Memory".

Three findings make verbatim inclusion actively harmful rather than merely risky.

### Two of the six roles are instructed to run shell commands as their first action

`testing-evidence-collector.md` opens its process with:

> ### STEP 1: Reality Check Commands (ALWAYS RUN FIRST)
> ```bash
> ./qa-playwright-capture.sh http://localhost:8000 public/qa-screenshots
> ls -la resources/views/ || ls -la *.html
> grep -r "luxury\|premium\|glass\|morphism" . --include="*.html" ...
> cat public/qa-screenshots/test-results.json
> ```

`testing-reality-checker.md` carries a near-identical block headed "STEP 1: Reality Check Commands
(NEVER SKIP)".

The kickoff is text-only, and `EXTERNAL_EFFECT_KINDS` stops the **whole run** on any observed
`runtime.command`. Handing two of six roles an instruction to always run commands first is close to
arranging for the run to abort — and it would abort at the role that obeyed, not at the role that
caused the problem.

### Two of six assume a stack CuckCode does not have

> **Corrected 2026-09-12 by independent audit.** This section originally read "Four of six." The
> verified count is two. Occurrences of `laravel|livewire|fluxui|alpine` per upstream file at
> commit `ebe9c99`: `engineering-senior-developer.md` 22, `project-manager-senior.md` 8,
> `testing-reality-checker.md` 1, and zero in the remaining three. The single hit in
> `testing-reality-checker.md` is "Verify what was actually built (Laravel or Simple stack)" — a
> conditional, not a stack assumption. So two files substantively assume the stack, one mentions it
> incidentally, three do not mention it at all. The argument is unaffected; the figure was wrong.

`engineering-senior-developer.md` requires FluxUI component mastery, says Alpine.js comes bundled
with Livewire, references `ai/system/component-library.md`, links to `fluxui.dev` for the current
API, and marks a light/dark theme toggle **MANDATORY** on every site. CuckCode is React 19, PixiJS,
Vite and vitest. The referenced file does not exist here and the linked docs are unreachable from a
sandbox with `networkAccess: false`.

A role given this contributes advice about software that is not the software under discussion.

### They claim capabilities the session does not have

Every file has a "Your Identity & Memory" section implying persistence across sessions. Kickoff
threads are ephemeral. `engineering-senior-developer.md` also says "Read task list from PM agent",
assuming an inter-agent protocol that is not D-25's.

### What this does to §2's conclusion

The manifest's `excluded_from_normalized_role` still shows that inclusion was *intended*. But the
content shows that intent was formed without weighing these files against the constraints they would
run under — and that quarantining one segment of one file addresses a fraction of a pervasive
problem.

**Revised recommendation: compose from the overlay only.** The overlay is CuckCode-authored,
accurate, stack-neutral, and already states the authority relationship. `sourceSha256` then pins
provenance and attribution rather than injected content — which remains meaningful, and which the
MIT licence requires regardless.

**The cost of this, stated in advance rather than discovered in the write-up:** overlay fields are
thin — exactly one responsibility, two or three skills and exactly two deliverables per role
(verified across all six overlays, 2026-09-12; responsibilities is 1 for every role without
exception, which is thinner than this sentence originally claimed). Six agents
composed from them will be differentiated, but modestly. The first live run will therefore test the
*mechanism* more strongly than it tests D-25's claim that six roles produce genuinely distinct
perspectives. Enriching the overlays is a normal governed change and can follow.

## 3. The real design problem

Stating "upstream text is reference, not instruction" inside a file that a model reads as its
instructions is a claim that may not survive contact with the model.

An upstream role description written for humans will contain imperatives — do this, always that,
never the other. A model reading them in its `AGENTS.md`, under a preamble saying they are merely
reference, may well follow them anyway. If it does, the overlay's authority narrowing is decorative
and a role could act on upstream examples that CuckCode never approved.

This is the whole difficulty of the task. Everything else is mechanical.

Two sub-problems follow:

- **Ordering and framing.** Whether the overlay's authority statement precedes or follows the
  upstream text, and how emphatically the boundary is drawn, is a prompt-design decision with real
  consequences. It should be made deliberately and recorded, not improvised.
- **What upstream actually contains.** No upstream source file has been read in this work. Their
  length, their imperative density, and whether they reference tools or capabilities the overlay
  forbids are unknown, and they determine how hard the framing problem is.

This section was written before the files were read. §2b answers it: they are long, imperative, and
aimed at a different stack, which is why the recommendation is now to keep them out of the composed
role entirely rather than to frame them carefully.

## 4. What can and cannot be machine-checked

A composed instruction is text. The project's habit is to make guards executable, so it is worth
being precise about which properties survive that treatment.

**Testable:**

- **Determinism.** The same source and overlay produce byte-identical output.
- **Completeness.** Every overlay field — responsibilities, skills, deliverables, disclosures —
  appears in the output.
- **Exclusion.** No quarantined segment appears. This is checkable by digest against the manifest's
  recorded `sha256`, not by substring guesswork.
- **Attribution.** The output names the upstream repository, commit and path.
- **Authority.** The disclosures appear verbatim, not paraphrased.
- **Provenance join.** Composition refuses unless the source and overlay digests match the
  *promoted* pair, not merely the manifest. Same join shape as the promoted set and the
  qualification version check.
- **No secrets, no granted capability.** Reuse the existing rejection used elsewhere in contracts.

**Not testable, and it must be said plainly:** whether a model actually treats the upstream text as
reference rather than instruction. No unit test establishes that. It is answerable only by running a
role and reading what comes back, which makes it one of the things the first live kickoff is
genuinely for — and a reason to read that run's transcripts for authority leakage rather than only
for whether the round completed.

## 5. Proposed shape

- **`composeRole({ source, overlay, manifestEntry })` in `@cuckcode/domain`**, returning the
  composed text and its digest, or a typed refusal. Pure, deterministic, no filesystem.
- **Two instruction channels, with distinct jobs.** The composed role goes in the controlled Codex
  home as `AGENTS.md` — it is role identity, stable across turns. The kickoff framing goes in
  `thread/start`'s `baseInstructions` — briefing, turn contract, and for the synthesis turn the
  requirement to preserve disagreements. Identity and task are not the same thing and should not
  share a channel.
- **The turn contract belongs in the framing, not the role.** ~~The probe found the owner's own
  `AGENTS.md` instructing an agent to ask questions before acting and to wait for approval
  before executing~~ — **claim withdrawn 2026-09-12 by independent audit. It is unsupported and
  contradicts this project's own record.** The probe reported the *path*
  `C:\Users\nater\.codex\AGENTS.md` in `instructionSources` and nothing more; both
  `docs/evidence/dogfood-register.md` (DF-010, "The file has not been read") and
  `docs/evidence/phase-4/live-kickoff/probe-2026-09-11-codex-facts.md` ("contents have not been
  examined") state explicitly that its contents were never examined. No probe established what
  that file instructs. Attributing a content finding to a probe that did not look is the DF-009
  shape — evidence without provenance — occurring inside the document that argues for provenance.
  The structural point survives without it: an unpinned instruction source of *unknown* content is
  loaded into every thread, a controlled home removes it, and anything about *how this turn works*
  belongs to the turn. Whether that file in fact under-fills a round is unknown and must not be
  asserted until DF-010's open question is ruled on and the file actually read.
- **Composed files are written per-role at run time and removed after.** They are derived, not
  authored, so they are not committed. Determinism is what makes that safe.

## 6. What this unblocks

17c-2a gave the binding report somewhere to put the truth. Composition is what produces the truth
to put in it: with it, `instructionSources` can be asserted to contain exactly the composed file,
its digest checked against composing the promoted pair, and DF-010 closed rather than documented.

Without it, 17c-3 through 17c-5 can all be built and would run — which is the danger. They would
produce a complete, green, attributable record of six agents that were never given a role.

## 7. Approval requested

1. That composition uses **overlay fields only**, per §2b, with `sourceSha256` restated as a pin on
   provenance and attribution rather than on injected instruction text.
2. Acceptance that role differentiation in the first live run will be thin as a result, and that
   this is a stated limitation of that run rather than a finding to be reported afterwards.
3. The channel split in §5: identity in the composed role, turn contract in `baseInstructions`.
4. Whether the incompatibility found in §2b should be recorded against the roles themselves — the
   import marked them `status: candidate`, and nothing in that status yet reflects that two of six
   describe a stack this project does not use.

## 8. The simplest fix for each problem

Judged against what this project already does, rather than against what would be most thorough.

### Incompatible upstream text — narrow the input, do not add a check

`composeRole` takes the overlay and the manifest's attribution fields. It does not take the upstream
source text as an argument at all. "No shell command leaks into a role" then stops being a test that
could regress and becomes a fact about what the function can see.

The single test worth writing is that the composed digest is unchanged when the upstream file
changes — which demonstrates the independence rather than asserting it.

This is the C-1 F2 rule inverted. Rather than a guard carrying its own copy of what it guards,
give the guard nothing it can get wrong.

### A role that cannot be described as unsuitable — one required field

The DF-005 through DF-008 family, so the DF-007 fix applies: required, not optional. One per-role
field in `roles/manifest.json`, validated in `check-agency-agents.mjs` beside the existing field
shape checks, and one refusal in `planPromotion` for a role not marked compatible.

Required is the load-bearing part. It forces the next import to answer the question rather than
inherit silence, which is the difference between a record that says "unknown" and one that cannot
say anything.

### DF-010 — one comparison against an observed fact

Half of this shipped in 17c-2a: the supervisor takes a `codexHome`, and the 17c-1b probe showed
`CODEX_HOME` replaces the default instruction sources entirely.

The other half is a single equality: `instructionSources` must contain exactly the composed role
file, refused as `INSTRUCTION_SOURCE_DRIFT` otherwise. A join check against a fact the runtime
volunteers, the same shape as the promoted set and the qualification version check.

### Thin overlays — do not fix this yet

Enriching the overlays now would be work against a problem that has not been observed. Run the
kickoff with what exists. If six agents produce near-identical contributions, that is a measurement
and enrichment follows it; overlays are digest-pinned, so enriching them is an ordinary governed
change. If they do not, the work was never needed.

The only thing required now is the limitation already stated in §2b: run one tests the mechanism
more strongly than it tests D-25's distinct-perspectives claim.

### The recurring boundary shape — not in this proposal

DF-010 and DF-011 share a shape that no guard here can address, because a guard would be written
inside the same boundary as the one that failed. That belongs to the promotion gate rather than to
composition, and is proposed separately in
`docs/proposals/2026-09-13-exercise-before-promotion.md`.
