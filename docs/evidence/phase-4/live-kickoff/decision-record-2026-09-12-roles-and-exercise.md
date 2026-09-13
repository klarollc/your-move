# Decision record — roles, composition, and the exercise gate

Status: **OWNER DECISIONS RECORDED 2026-09-12.** Recorded against `04fcd42`.

The owner ruled on sixteen open items on 2026-09-12, delegating to the agent's recommendations.
This record states each ruling, what it authorizes, and — for one item — why delegation was not
accepted at face value.

---

## How this record treats the delegation

The owner's instruction was "go with your recommendations on all of them." Fifteen items are
recorded as ruled. **Q4 is not**, and the reason is recorded in §Q4 below rather than resolved by
the agent's own preference. MDD D-25's rule that silence is not agreement applies with more force,
not less, when an agent is asked to ratify its own work.

---

## Roles and provenance

### Q1 — the six imported candidate roles → **(a) marked superseded**

They were never promoted, so nothing is revoked. `status: candidate` now asserts an intent that no
longer exists, so each entry is marked `superseded` with a dated reason referencing Decision A(ii).
`roles/upstream/` bytes and their digests stay in tree; MIT attribution survives regardless of
whether the content is ever used.

### Q2 — where authored roles live → **(a) `roles/authored/<id>.json`, digest-pinned**

Authored roles are promoted through the existing `planPromotion` shapes. All-or-nothing promotion,
drift refusal by digest, and the revoke path are sound independent of where content originates, and
retaining them means the promoted set stays derived on every read rather than trusted once.

`sourceSha256` no longer applies. An authored role carries one digest over its own content.

---

## Composition

### Q3 — competence-brief schema → **approved**

`mandate` / `context` / `standards` / `evidence` / `refusals` / `boundaries`, with the §3 exclusions
binding: no identity statement, no tone or persona direction, no mandatory step-by-step process, no
claim of memory the session does not have, no stack assumptions.

### Q4 — the six briefs → **NOT RULED. Proceeding as drafted, marked owner-unreviewed.**

The owner delegated this to the agent's recommendation. The agent's recommendation was that the
owner mark them up, because the briefs describe the owner's own professional practice, reconstructed
from repository artifacts and project memory by an agent that has never observed that practice
directly. An agent approving its own reconstruction of a person's judgement is not a review.

**Resolution:** the briefs proceed as drafted and each carries `ownerReviewed: false`. Their review
is routed through the exercise gate (Q10–Q12): a brief that misdescribes the work will produce a
transcript that reads wrong, which is a concrete review surface rather than an abstract one. The
flag clears only on an explicit owner statement, never by an agent's assessment.

This is the §9 weakness of `2026-09-12-roles-as-competence-briefs.md` carried forward rather than
closed.

### Q5 — channel split → **approved**

Composed role → controlled Codex home `AGENTS.md` (identity, stable across turns). Turn contract and
briefing → `thread/start` `baseInstructions` (task). Identity and task do not share a channel.

Previously marked "noted" by the owner; now explicitly approved.

### Q6 — differentiation → **(a) B + C, with D as the check**

- **B** — competence briefs supply the content.
- **C** — each role receives a different slice of project state, so divergence is structural rather
  than a property of prompt wording.
- **D** — each role's contribution is judged against what that role is accountable for, which
  measures whether B and C worked.

C is the load-bearing one: it applies the project's own rule — give the guard nothing it can get
wrong — to differentiation. A role that cannot see another role's evidence cannot produce that
role's answer.

### Q7 — what each role sees → **its own proposal; does not block composition**

The evidence-diet design is a real design question and is opened as a separate proposal. Composition
and evidence-routing are separable: `composeRole` produces role identity, and what a role is shown
is a property of the kickoff briefing. Work on composition proceeds now.

### Q8 — manifest incompatibility → **Option 3 destination, Option 1 bridge**

Authored roles cannot carry stack incompatibility, so the field guards nothing for them. Under
A(ii) the import pipeline survives for a future import, and a future import still needs somewhere to
record a suitability assessment — so a required `compatibility` field is added for imported roles
only, with a `planPromotion` refusal when unassessed.

Required, not optional. A required field forces the next import to answer rather than inherit
silence.

### Q9 — MDD amendment → **(c) amend only if a brief changes a role's accountability**

Whether any brief does so is a factual question about the MDD, not a matter of preference, and is
being checked rather than assumed. If any brief contradicts or extends a role's MDD-defined
accountability, an amendment is proposed before that brief is used.

The six role *names* remain locked by D-16 and are not renamed.

---

## The exercise gate

### Q10 — exercise required before promotion → **approved**

A role may not be promoted until it has been exercised once against the real runtime and the result
recorded. `planPromotion` refuses a role with no recorded exercise under a named code. Structural,
not procedural — a refusal code survives a busy afternoon in a way a prose rule does not.

Previously marked "noted" by the owner; now explicitly approved.

### Q11 — exercise shape → **approved**

One bounded, text-only turn per role, in a controlled Codex home containing only that role's composed
instruction, under the sandbox and approval settings a kickoff turn will use. One standard prompt,
identical for all roles. Four mechanical assertions: the turn completed; no external effect was
observed; reported model, effort and protocol match what was approved; `instructionSources` contains
exactly the composed role file.

Every record marks **performed or not performed**. A waived exercise reads as a waiver, never as a
pass.

### Q12 — exercise the authored roles → **approved**

The six authored roles are exercised before their first promotion. An authored role has had no
upstream review of any kind, so the live turn is the only check between it and first use. This also
serves as the owner's practical review of the Q4 briefs.

---

## Live-kickoff path

### Q13 — DF-010 → **(a) controlled Codex home**

Kickoff threads point at a controlled Codex home so no unpinned instruction source loads at all.
The 17c-1b probe established that `CODEX_HOME` replaces the default instruction sources entirely.

This closes DF-010 rather than documenting it, and makes Q11's fourth assertion checkable.

The contents of the owner's `~/.codex/AGENTS.md` remain unexamined and no claim is made about them.

### Q14 — 17c sequence → **approved as written, 17c-3 deferred**

The spec flags the protocol-version pin as deferrable and it does not block the run. Deferred with
the risk recorded: a protocol bump today would silently desync two of three copies.

### Q15 — promotion is owner-run → **confirmed**

The agent writes `roles/promotion-request.json` and the promotion command. The owner executes
promotion. The agent does not promote.

### Q16 — model-unreported fallback → **refuse by default; "unobserved" only as a recorded waiver**

If a path genuinely never reports a model, the binding is refused rather than recorded as
"unobserved." Recording an unverified model as an observed fact is the vacuous-guard shape this
project has now caught three times.

"Unobserved" is permitted only as an explicit, owner-waived, recorded state — the same
performed/not-performed discipline as Q11.

---

## What this authorizes

Implementation of `composeRole` under RED–GREEN TDD, the `roles/authored/` layout, the manifest
`compatibility` field and its promotion refusal, the exercise record and its refusal code, and the
controlled Codex home for kickoff threads.

It does not authorize promotion (owner-run, Q15), the live kickoff run itself, Phase 5,
high-fidelity art, visual-baseline promotion, deployment, or any external effect.

## Carried weakness

Q4 is unresolved by design. Six role briefs describing the owner's professional practice are
proceeding without the owner having read them, on the strength of a delegation that did not
distinguish this item from the other fifteen. The mitigation is the exercise gate; the flag is
`ownerReviewed: false`; and this paragraph exists so the gap is not discovered later as a finding.
