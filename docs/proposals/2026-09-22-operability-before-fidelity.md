# Operability before fidelity — drill-down and adversarial fixtures

**Status: PROPOSAL. Approves nothing, amends no requirement, authorizes no implementation.**

Author: agent, 2026-09-22. Raised from the owner's standing instruction that UI work takes
priority (2026-09-08) and from comprehension finding F-3, which has had no work item since it was
recorded.

Evidence basis: everything below comes from reading source and records at `6a210e7`. **No build
was rendered, no browser or viewport was exercised, and no test was run for this proposal.**

---

## 1. The problem, in the owner's words

> "It's easy to see general stuff, but figuring out how to drill down for detail needed for
> decisions was challenging."
> — `docs/evidence/phase-4/comprehension/run-2026-09-08.md`, F-3

Both criteria that passed in that run (T1, T2) are glanceable. The one confirmed weakness needed
detail behind a state. The three criteria that would confirm or refute F-3 (T3 waiting versus
blocked, T5 evidence and next action, T6 truthfulness) were never performed, and MDD §20's debt
is still open.

MDD §2 is explicit about priority: _"If scope must be reduced, reduce scene fidelity, zone count,
or role count before reducing operability, truthfulness, or reciprocity."_

## 2. What reading the source found

The cheap check came first: before designing a better drill-down, read what the current one
shows. It explains F-3 and turns up a truthfulness problem.

### 2.1 The inspector's detail fields are constants

`apps/web/src/office-shell.tsx`, the Entity inspector (`aria-label="Entity inspector"`). For
**every one of the thirteen entities** it renders the same literals:

| Field | Rendered value | Source |
| --- | --- | --- |
| Cause | `Canonical workspace revision 42 fixture` | literal |
| Updated | `Revision 42` | literal |
| Blocker | `None recorded` | literal |
| Evidence | `Deterministic graybox fixture` | literal |
| Runtime binding | `Loopback session · simulated` | literal |
| Permissions | `Inspect and select only` | literal |
| State | per-entity string | hand-written `officeShellEntities` list |

When the owner drilled down, there was no detail to find. The only per-entity field is a
hand-written state string.

### 2.2 The rail and the inspector contradict each other

In the default office, `apps/web/src/office-canvas.tsx` puts `attention_blocked_test` at the top
of the attention rail: _"Test evidence is blocked"_, entity `agent_test_engineer`, cause
`event_test_blocked`, priority 10. Opening the inspector for the Test Engineer shows:

- State: _"Reviewing deterministic tests"_
- Blocker: _"None recorded"_

Two surfaces of the same office give opposite answers about the same agent. This is the kind of
contradiction MDD §2's truthfulness claim forbids, in the default state, and the owner saw it
during the comprehension run. **Severity is the owner's to dispose** (MDD 1133–1140). The agent's
recommendation is **V1**: the rail is correct and the inspector is wrong, so a manager who drills
down is told something false.

**Correction to an earlier claim.** Project notes from 2026-09-08 say "every fixture in
`office-canvas.tsx` is honest". That was never checked against the inspector, and it is false for
the office as rendered. The conclusion drawn from it still holds: the visual and e2e suites cannot
catch this, because they assert that the author's fixture renders, not that the surfaces agree.

### 2.3 The truthful projection already exists, and the UI doesn't call it

`packages/domain/src/office-scene.ts` exports `projectOfficeScene(snapshot, now)`. It returns,
per subject: `state`, `behavior`, `zone`, `causeEventId`, `updatedAt`, `freshness`, `approved`.
That covers the inspector's Cause, Updated and Freshness fields and T4's approval question.
`packages/domain/src/attention.ts` (`projectManagerAttention`) and `agent-projection.ts`
(`projectAgentActionableState`) sit beside it.

**`apps/web/src` references none of the three.** The domain has a tested, truthful projection
with no UI consumer. The UI has a hand-written entity list with no projection behind it. This is
the same shape as the `RuntimeAdapter` finding (C-1): the claim was unexercised, not just
untested.

So most of the fix is **UI wiring to existing domain code**, not new backend work. That fits the
UI-first instruction.

## 3. A scope question the owner has to answer first

MDD §24 defines **Phase 7 as high-fidelity implementation**: materials, lighting, avatars,
typography, props, motion and visual regression baselines. This proposal is not that. Doing Phase 7
as written first would polish and baseline an inspector that renders constants. Its golden
states and regression baselines would freeze the defect in §2.2 as the reference.

Three placements:

| Option | What changes | Cost |
| --- | --- | --- |
| **A. New phase before Phase 7 ("Phase 7-O, Operability")** | MDD §24 gains a phase; Phase 7 unchanged, gated on 7-O | One MDD amendment |
| B. Fold into Phase 7 as its first half | Phase 7's deliverables and gate are rewritten | Larger amendment; hi-fi and operability share one gate |
| C. Open-question-style side track, no phase | No §24 change | Nothing forces it ahead of hi-fi art, which is how F-3 sat for two weeks |

**Recommendation: A.** It keeps each gate about one thing and puts operability ahead of fidelity,
which is the order §2 already requires.

Phase 5 is not a precondition: per the 2026-09-13 §24 amendment, Phase 5 acceptance gates
Phase 8, not Phase 7. Closing Phase 5 first is still recommended because it is nearly done.

## 4. Proposed content

### Workstream 1 — The inspector is a projection (F-3, §2.1–2.3)

Requirements to specify, not yet designs:

1. Every inspector field is derived from the canonical snapshot through the domain projections.
   No literal may stand in for Cause, Updated, Blocker, Evidence or Freshness. Where the snapshot
   has no value, the inspector says so specifically (for example, "No cause event recorded") and
   does not render a plausible default.
2. **The rail and the inspector cannot disagree.** An entity with an open attention item shows
   that item, its cause event and its required action in the inspector.
3. Decision detail for the three questions the comprehension run could not answer:
   - **What would approving take?** (F-1 / T4): the approval requirement, read from the record.
   - **Waiting or blocked, and on whom?** (T3): blocked-by and waiting-on, with the cause event.
   - **What evidence, and what's next?** (T5): links into the Evidence Library, and the next
     required action.
4. `officeShellEntities` stops being the source of state. It may keep layout and labels.

Falsifiable acceptance, in the style of the existing guards:

- **Two-snapshot test.** Render the inspector for every entity under two canonical snapshots that
  differ in state, cause and blocker. Assert that every field whose input changed also changed in
  the output. A literal field fails this test by construction, which the current inspector would.
- **Rail/inspector agreement test.** For every entity with an attention item, the inspector's
  blocker and required action equal the rail's. RED against today's Test Engineer.

### Workstream 2 — Adversarial fixtures (truthfulness becomes falsifiable)

Fixtures that deliberately lie, with the assertion that the office **refuses them or renders them
visibly broken**, never plausibly:

| Lie | Expected behavior |
| --- | --- |
| Progress state with no supporting event | Refused at projection, or rendered as unsupported |
| Avatar in a zone that no transition put it in | Not rendered in that zone |
| Completed artifact with no approval event | Never presented as approved (T4) |
| Blocker in the rail, absent from the agent's record | The §2.2 case, caught by agreement |
| Stale revision presented as current | Freshness shows stale |

Where the refusal lives (domain validation, application projection, or the web layer) is a spec
decision. The principle from the handoff applies: each guard asserts against the definition it
guards, not a copy.

### Workstream 3 — Finish the comprehension debt, as the measure

After WS1, perform T3, T5 and T6 under the MDD §20 n=1 protocol, with the per-task
performed/not-performed mark. Owner-run and cheap. It is the only instrument in the project that
measures whether drill-down got better for its one user, which no automated suite can do.

### Explicitly out of scope

High-fidelity art (Phase 7 proper). Any live provider run. New backend packages. Screen-reader
work (retired 2026-09-18). C-1's F3/F4/F6, which stay in the housekeeping queue.

## 5. Decisions requested

| ID | Question | Agent recommendation |
| --- | --- | --- |
| O-1 | Placement: A, B or C (§3) | A |
| O-2 | Severity of the §2.2 rail/inspector contradiction | V1 |
| O-3 | Authorize a specification (not a plan, not implementation) for WS1 + WS2 | Yes |
| O-4 | Is performing T3/T5/T6 part of the new phase's gate? | Yes, with "unperformed is never a failure" preserved |

If O-3 is approved, the next artifact is the spec, then a plan and a task list, each with its own
approval, per `AGENTS.md`.

## 6. What this proposal does not establish

- That the inspector renders as described in a browser. This was read from source, not observed.
- That wiring `projectOfficeScene` into the shell is small. The domain function takes a
  `CanonicalProjectSnapshot`, and the web layer currently builds no such snapshot for the default
  office. How the fixture becomes a snapshot is the first design question in the spec.
- That F-3 is fully explained by §2.1. The constants explain why drill-down had nothing to show.
  Whether layout and discoverability also contributed can only be answered by WS3.
