# Decision request — starting Phase 6 in parallel

Status: **ALL THREE RULED BY THE OWNER 2026-09-13.** Requested and ruled in the same session; recorded against `bcba1f2`.

| Decision | Ruling |
| --- | --- |
| 6-A approve the visual-reference production brief | **Approved as written**, no changes requested |
| 6-B Phase 6 parallel with Phase 5 | **Authorized**, MDD section 24 amended the same day |
| 6-C candidate production medium | **(iv) Hybrid** — generated exploration plus in-repo vector composition |

This was an explicit yes to each item, not an acknowledgement. Tasks 1-7 are authorized. Task 8 selection, Task 10 promotion, and Phase 7 are not.

On 2026-09-13 the owner instructed: *"start Phase 6's three art candidates in parallel now."* That instruction was recorded as **an instruction received rather than approval granted**, because MDD D-25 holds that silence is not agreement and because three things this project treats as owner-only were bundled inside it. Each was then put to the owner as a separate question and answered. The rulings above are those answers.

No art exists yet. `tasks/phase-6-plan.md` and `tasks/phase-6-todo.md` were committed as proposals before the rulings and are now marked authorized for Tasks 1-7. `AGENTS.md`, `README.md`, MDD §24 and MDD §27 were amended the same day so no boundary document still denies what these rulings authorize.

---

## 6-A — Approve the visual-reference production brief?

`docs/visual-reference-production-brief-v0.1.md` has read **"Proposed for owner approval"** since 2026-08-13 and has not changed since. It is complete: visual thesis, originality and provenance rules, the controlled comparison frame, the three comparative emphases, a twelve-item candidate board, the avatar contract, the golden-state sequence, a fourteen-criterion rubric, and the approval gate.

Every Phase 6 task depends on it. No amendment is proposed — the request is to approve it as written.

**Ruled 2026-09-13: approved as written.** No amendment requested. The brief's status line now records the approval and its limits.

---

## 6-B — Authorize Phase 6 in parallel with Phase 5?

MDD §24 orders Phase 6 after Phase 5. Running them in parallel departs from an approved document.

The case for it is scheduling only. Phase 6 reads no Phase 5 artifact; its inputs are the graybox composition accepted 2026-09-08 and the canonical default-office fixture, both of which exist. Phase 6 ends in a judgment only you can make, and Phase 7 cannot begin until it closes — so Phase 6 delay is added directly to the end of the schedule, while Phase 5 delay costs only itself.

The case against it is real: Phase 5 is where six live agents first run a full D-25 round, and it is the phase most likely to invalidate assumptions the art direction is built on. If Phase 5 changes what the office must show, some Phase 6 work is repeated.

**This ruling also changes MDD §24.** If parallel work is authorized, §24 is amended to say so in the same session. Leaving §24 reading one order while the project runs another is precisely the stale-boundary defect recorded against `AGENTS.md` and `tasks/phase-4-todo.md`.

**Ruled 2026-09-13: parallel Phase 6 authorized.** MDD §24 was amended in the same session so the approved document states the order the project actually runs. Sequencing changed; no gate changed. Phase 5 acceptance remains a precondition of Phase 8.

---

## 6-C — How are the three candidates produced?

The brief requires "original CuckCode compositions," permits "generated or commissioned" assets, and requires recorded provenance. It does not say which medium this project uses, and the rubric scores two things that pull in opposite directions: material and depth coherence, and feasibility in PixiJS/WebGL and DOM. This is a genuine choice, and it is yours rather than the agent's, because it sets both the provenance burden and the cost.

| Option | Material fidelity | Provenance quality | Feasibility signal | Cost and latency |
| --- | --- | --- | --- | --- |
| **(i) In-repo vector/CSS studies**, rendered at 1440×900 by the existing Playwright harness | Low — hard to judge warmth, material edges, contact shadows | Strongest: every pixel authored in-tree, fully diffable | Direct — it *is* the target stack | Lowest |
| **(ii) Generated raster art** from an image model | Highest | Weakest: training provenance cannot be enumerated the way the brief's register expects | Poor — cannot be scored for reduced motion or 1280×800 reflow | Low |
| **(iii) Commissioned illustration** | High | Strongest for originality; named creator and licence | Poor without a separate implementation study | Highest — defeats the parallelization rationale in 6-B |
| **(iv) Hybrid** — generated raster for mood, material, and avatar exploration, explicitly marked non-implementable; in-repo vector for the fixture-accurate composition that is scored on feasibility and accessibility | High where it matters | Mixed, and recorded as mixed per artifact | Direct, on the artifact that is actually scored for it | Low-moderate |

**Agent recommendation: (iv).** It is the only option that does not force a trade between the two things the rubric scores hardest. It also keeps the honest line this project already draws elsewhere: the generated pieces would be labelled exploration that no one may implement against, exactly as automated screenshot diffs are labelled as detecting change rather than approving taste. Under (ii) alone the likely failure is three beautiful candidates, one selected, and a Phase 7 that cannot build it.

**Ruled 2026-09-13: (iv), the hybrid.** Generated raster carries mood, material, and avatar exploration and is marked non-implementable; in-repo vector carries the fixture-accurate composition that Tasks 6 and 7 score for feasibility and accessibility. Each artifact records which half it came from, so the provenance register never has to describe a generated image as though it were authored in-tree.

---

## What is unblocked by what

- **6-A and 6-B** unblock Task 1, freezing the comparison fixture. That task is deterministic, in-repo, and needs no art.
- **6-C** unblocks Tasks 2–4 only.
- Nothing unblocks Task 8. Selection stays owner-run, as does promotion to Active in Task 10.

## What this request does not ask for

It does not ask to authorize Phase 5 behavior, Phase 7 implementation, visual-baseline promotion, deployment, or any external effect. All remain unauthorized.
