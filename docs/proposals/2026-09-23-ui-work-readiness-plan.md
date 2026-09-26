# UI work readiness — proposed sequence

**Status: PROPOSED.** This is a review and implementation sequence, not an approved Phase 7 plan or authorization to change behavior. Evidence was read from the checkout at `6a210e7` with the working tree described below. No build, browser session, or test was run for this review.

## Current position

- Phases 0–4 and 6 are complete. The owner promoted `reconciliation-b-clarity` with five golden states and ten viewport references. Phase 7 has no specification, approved plan, task list, or implementation authority.
- Phase 5 Tasks 1–9 are done. Task 10 and the overall acceptance gate remain owner-run. Pass 5 is the latest complete release verdict: `NEEDS WORK`, 20/21 under the then-current scope. The later C-17 exclusion is **out of scope, not met**. Attempts 6–9 produced no verdict; pass 9 stopped at `NOTIFICATION_TIMEOUT`. A fresh independent verdict is still needed before the owner can assess Task 10.
- The comprehension study left T3, T5, and T6 unperformed. MDD §20 still requires an actual cold operator run; this is a product measure, not something the automated suite can satisfy.
- The current office's inspector uses fixed cause, revision, blocker, evidence, binding, and permission text. Its Test Engineer says `None recorded` for blocker while the default attention rail says test evidence is blocked. The source supports this contradiction; this review did not observe it in a browser. The 2026-09-22 operability proposal already records the issue and requests owner decisions O-1 through O-4.
- The domain has useful projectors, but `projectOfficeScene` gives agents null cause and updated time and has no blocker or evidence field. A web snapshot and the joins from work, attention, evidence, and agent identity must be designed. Treating the change as a direct call to an existing projector would overstate readiness.
- `.ui-craft/brief.md` still says detailed art is pending, and `.ui-craft/tokens.md` says numeric values and promotion are unapproved. Those descriptions need reconciliation with the Phase 6 Active record when a UI specification is approved. The Active visual system and its approved golden states remain the authority; do not invent numeric tokens or embed fonts without a recorded decision and licence review.
- Working tree at review: branch `hermes/phase-4-task-15-evidence`, two commits ahead of its remote; modified `docs/evidence/phase-5/turn-ledger.json`; untracked pass 9 and 2026-09-22 operability proposal. Preserve these records and do not rewrite historical evidence.

## Recommended path

### 1. Rule the operability placement and scope

Owner decides O-1 through O-4 in `2026-09-22-operability-before-fidelity.md`. Recommend its Option A: a bounded operability phase before high-fidelity Phase 7, with the rail/inspector contradiction treated as V1, a specification for truthful inspector and adversarial fixtures, and T3/T5/T6 in the new gate. This places truth and decision detail ahead of visual polish, as MDD §2 requires. A different placement is viable if the MDD sequencing and gate are amended explicitly.

**Gate:** record the owner ruling, then align MDD §24, `AGENTS.md`, `README.md`, `docs/HANDOFF.md`, and the relevant checklist in the same pass. The ruling authorizes specification only unless it explicitly says more.

### 2. Specify operability before implementation

Write a versioned spec for the canonical snapshot supplied to the web office; the mapping of work, agent, attention, evidence, approval, freshness, runtime, and permission facts to every inspector field; rail/inspector agreement; absence and stale-state wording; and deterministic fixture boundaries. Include entity and event identifiers for drill-down and Evidence Library links. Decide where contradictory or unsupported data is refused or shown as unresolved. Keep all fixture data visibly labeled as fixture data.

**Gate:** owner approves the spec. Then write a separate implementation plan and task checklist for approval. Record the approved UI contract in `.ui-craft/brief.md` and `.ui-craft/tokens.md` without asserting numeric decisions that have not been made.

### 3. Implement the operability slice under RED–GREEN–REFACTOR

Start with two-snapshot tests proving changed canonical facts change the inspector; a test for every rail item to agree with its inspector detail; and adversarial fixtures for unsupported progress, wrong zone, unapproved completion, absent blocker, and stale revision. Confirm each RED fails for the expected reason before changing behavior. Build the application-to-web read model, wire the inspector and rail to the same facts, then refactor without changing behavior. Preserve provider and side-effect isolation.

**Gate:** full `npm run verify`; current-build Chromium screenshots at 1440×900 and 1280×800; console and network inspection; pointer, keyboard, reduced-motion, zoom, and non-color state checks; comparison to the Active visual contract. A green suite alone is insufficient visual evidence. Owner reviews any V0/V1 disposition.

### 4. Measure the result with the operator

After at least three days without substantive UI work, run the MDD §20 comprehension protocol cold. Actually exercise T3, T5, and T6 and record performed/not-performed, exact responses, the answer-key comparison, and any new findings. Do not score an unperformed task. Resolve findings that prevent the operability gate; preserve the original run and its waiver as history.

**Gate:** owner accepts the operability evidence and closes its phase. If the study is incomplete or the inspector remains contradictory, the gate stays open.

### 5. Prepare and execute Phase 7 high-fidelity UI work

Create the Phase 7 specification against the Active `reconciliation-b-clarity` system and its five golden states, now including the accepted operability read model. Resolve the numeric primitive, semantic, and component tokens; font families, fallback and embedding licences; materials, lighting, avatar assets, props, motion and reduced-motion equivalents; and the approved capture matrix. Address the three Phase 6 provenance gaps explicitly without pretending the generated exploration or external references occurred. Then submit the Phase 7 spec, plan, and tasks for separate owner approvals before implementation.

Implement in bounded surfaces with RED–GREEN–REFACTOR for behavior. For every UI change, collect current-build browser evidence at both approved viewports, inspect console/network, exercise keyboard and reduced motion, and compare to the approved references. Baseline promotion and final visual acceptance remain owner-run. Phase 7 closes only on its MDD §24 rendered evidence, V0/V1 clearance, V2 disposition, and explicit owner visual approval.

### Parallel Phase 5 closure

Treat Phase 5 as a parallel acceptance track, because the MDD makes it a Phase 8 precondition, not a Phase 7 precondition. Do not spend more reviewer turns until the live runtime connection is reliable. Then produce a fresh, complete release review that applies the current C-17 scope overlay and cites current evidence; preserve pass 5 and failed attempts. Present the new verdict and exact fixture/evidence versions for owner-run Task 10. An eligibility verdict would permit the owner to decide; it would not itself accept the fixture. Keep production reuse and deployment outside this plan.

## Earliest useful start

The first authorized artifact after the O-1 through O-4 ruling is the operability specification. The first UI code change follows approval of that specification, its implementation plan, and its task list. Phase 7 fidelity work follows a separate Phase 7 specification, plan, and approval. The current Phase 6 Active system supplies the visual target throughout.
