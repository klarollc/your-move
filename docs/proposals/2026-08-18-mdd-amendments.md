# Proposed MDD amendments — 2026-08-18

Status: **PROPOSED. Not applied. Requires owner approval before any document is edited.**
Author: Claude (Cowork), at owner request on 2026-08-18.
Evidence: `docs/competitive-landscape.md`, `docs/evidence/defect-register.md`.

Two amendments are proposed. They are independent; either may be approved without the other.

---

## Amendment A — Differentiation statement in §2 Confirmed intent

### Problem

MDD §2 currently states the Outcome as:

> Create a visual multi-agent orchestration product that presents real agent work as a familiar,
> interactive office environment.

As of 2026-08-18 that sentence describes Pixel Agents (~8.9k stars), Munder Difflin, and
Agents in the Office. It is an accurate description of an existing product category rather than
a statement of what CuckCode uniquely claims. See `docs/competitive-landscape.md` F-1 and F-2.

The document's actual differentiators — the binding truthfulness constraint and D-26 reciprocal
usability — appear later in §2, §4, and §9, but not in the Outcome. This matters operationally.
The Outcome is what a reader protects when scope is cut under pressure. As written, it protects
the metaphor. The metaphor is the commodity part.

### Proposed replacement for the §2 Outcome block

> ### Outcome
>
> Create a visual multi-agent orchestration product in which a familiar office environment is the
> primary surface through which a non-technical manager directs real agent work.
>
> ### Differentiation
>
> Rendering agents as office workers is an existing product category, not CuckCode's claim
> (`docs/competitive-landscape.md`). CuckCode's claim is narrower and harder:
>
> 1. **The office is operable, not observational.** Comparable products render what agents are
>    doing. CuckCode's office is where the manager assigns outcomes, answers escalations,
>    inspects evidence, and approves or redirects deliverables. No observed competitor makes the
>    scene a control surface.
> 2. **The office is truthful.** Every meaningful visual behavior is backed by an inspectable
>    canonical event. Simulated or fallback animation is a V0 defect, not a shortcut. At least one
>    competitor currently ships synthetic avatar motion where real event hooks are unavailable.
> 3. **Both participants are first-class.** Human and agent interfaces are equal projections of
>    the same canonical state (D-26). Human simplicity is never purchased with agent complexity.
>
> If scope must be reduced, reduce scene fidelity, zone count, or role count before reducing
> operability, truthfulness, or reciprocity. Those three are the product.

### Consequential updates if approved

- `README.md` opening paragraph — same commodity framing.
- `.ui-craft/brief.md` §1 "Product identity" — same commodity framing.
- Both are descriptive restatements of §2 and should follow it, not lead it.

### Argument against this amendment

The current Outcome is not wrong, and §4's principles already carry the differentiators. A reader
who reads the whole document reaches the right conclusion. If you believe scope pressure will
never force a triage decision, this amendment is unnecessary ceremony.

---

## Amendment B — New decision gate D-28: event rate and presentation-queue bound

### Problem

Phase 4 Task 12 established that canonical revision is applied before presentation, that one
transition leads while later transitions queue deterministically, and that semantic travel runs
a single 480ms non-looping transition at a named checkpoint.

No document records the expected rate of canonical state transitions per role during real agent
work. Without that figure, the presentation queue has no sizing basis, and two failure modes are
unbounded:

1. **Strobing.** If real transitions arrive faster than 480ms per role, the office animates
   continuously and the calm-command intent (brief §3, principle 6) fails.
2. **Trailing presentation.** If the queue absorbs the excess, the visual scene lags canonical
   state by queue depth × transition duration. A scene that is behind is a scene that is showing
   a state the system knows is no longer true. Under §8's truthfulness invariant that is a V0
   condition, and it is currently invisible because nothing measures or bounds queue lag.

Phase 4's fixtures are deterministic and hand-sized, so neither mode can appear before Phase 5.
Phase 5 is the six-role acceptance project against a live runtime — where both appear at once,
after the renderer is built.

Recording this as a gate does not assert the problem exists. It asserts that the answer is
currently unknown and must be measured before it becomes expensive.

### Proposed §3 table row

> | D-28 | **Open:** the deterministic presentation queue can represent real agent event rates
> without strobing or trailing canonical state | Measure canonical transitions per role per
> minute during a supervised live runtime run; set a maximum acceptable presentation lag and a
> truthful degradation behavior when it is exceeded | Phase 5 live office |

### Proposed degradation requirement, for §9 or §21

> When queued presentation would exceed the approved maximum lag behind canonical state, the
> office must collapse or skip intermediate transitions and place avatars at current canonical
> position, rather than continue playing a backlog. A scene that is behind canonical state must
> disclose that it is behind. Presentation backlog is never allowed to become the displayed
> account of work.

### Cheapest way to close it

The Phase 3 supervised live Codex run already exists. Instrumenting it to count normalized events
and derived role-state transitions per minute would produce the missing figure without new
infrastructure and without touching Phase 4 scope.

### Argument against this amendment

Role-level states (idle, active, handoff, collaboration, waiting, blocked, reviewing, completed,
disconnected) change far less often than raw tool events, so the real transition rate may be
low enough that this is a non-issue. If a cheap measurement confirms that, the gate closes
immediately and costs one instrumented run. That is also the argument *for* measuring rather
than assuming.

---

## Amendment C — §20 comprehension study for a single operator

### Status

Design approved by the owner on 2026-08-18. The MDD text itself still requires amendment, because
§20 currently specifies a population this project does not have.

### Problem

§20 requires "at least 4 of 5 representative non-technical evaluators" to satisfy six criteria.
The owner confirmed on 2026-08-18 that CuckCode is a personal tool with a single operator. The
population under test is one person, so a five-evaluator panel measures a population that does
not exist and cannot be assembled without inventing one.

§20 already anticipates this: "Thresholds are provisional until the owner approves the study
design."

### Proposed replacement for the §20 threshold paragraph

> With no more than a short orientation, the single operator must satisfy every criterion below,
> answering from the interface alone.
>
> The operator designed the interface, so an immediate run measures recall rather than
> comprehension. The study is therefore run **cold, after a deliberate gap of at least three days**
> from the last substantive work on the interface, without re-reading the design documents. A run
> inside that window is recorded as void, not as a pass.
>
> A criterion passes only if the written answer is correct **and** the operator does not record
> that it was answered from memory of having built the interface. Six of six is met. Five of six
> is met with the failure recorded as a named finding. Four or fewer does not pass the graybox
> comprehension gate.
>
> Protocol, answer key, and response sheet: `docs/evidence/phase-4/comprehension/`.

### What this preserves and what it gives up

Preserved: the six criteria are unchanged, the study can still fail, and failure still blocks the
gate. The delay requirement and the "answered from memory" disqualifier are added precisely so
that a single-operator study is not automatically self-passing.

Given up: genuine evaluator naivety. A three-day gap is a weaker control than a person who has
never seen the product, and no amount of protocol design closes that fully. If the tool ever
acquires a second user, the original five-evaluator design is the better instrument and this
amendment should be revisited rather than treated as settled.

### Argument against this amendment

A study the subject cannot fail honestly is worse than no study, because it produces a signed
artifact that looks like evidence. If the delay is not actually observed, or if the operator
scores generously, this becomes ceremony with an owner signature attached. The alternative —
deleting the study and resting the gate on accessibility evidence alone — is more honest than a
study run badly. The protocol's void condition and its "answered from memory" line exist to make
that failure mode visible, but they depend on the operator reporting against his own interest.

---

## Not proposed here

The owner declined, deferred, or did not select the following on 2026-08-18. Recorded so the
options are not silently lost:

- Splitting the §20 comprehension study into an appeal study and an operability study.
  Superseded by Amendment C above, which replaces the panel with an n=1 delayed protocol.
- Adding an executable-governance rule to `AGENTS.md` requiring that any governance requirement
  expressible as a test become one.
- Adding a standing D-26 reciprocal-parity harness to `docs/test-plan-v0.1.md`.
