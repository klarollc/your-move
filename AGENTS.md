# AGENTS.md — CuckCode

## Authority

Read these files before proposing or making changes:

0. `docs/HANDOFF.md` — live state, the immediate next action, open debts, and the defects that cost
   real time. Read it first; it is the only document that says what is happening *right now*.
1. `docs/master-design-document-v0.1.md`
2. `.ui-craft/brief.md`
3. `.ui-craft/tokens.md`
4. The latest approved task plan, when one exists

If implementation and documentation disagree, stop. Update and approve the design document before changing behavior.

## Current boundary

Phases 0 through 3 were owner-accepted on 2026-08-13. The owner approved `docs/phase-4-graybox-office-and-kickoff-spec-v0.1.md`, `.ui-craft/spec.md`, `tasks/phase-4-plan.md`, and `tasks/phase-4-todo.md` for Phase 4 Tasks 1–15 on 2026-08-13.

Phase 4 authority is limited to deterministic graybox office composition and behavior, the accessible DOM equivalent, loopback application boundary, simulator-driven collaboration/kickoff workflow, strict rendered graybox QA, manual accessibility, and the five-person comprehension study. Stop at the owner graybox gate.

The owner approved the Task 16 preflight packet on 2026-09-08 (`docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md`). Approval authorized Task 17 — one bounded live kickoff — conditional on the packet's §7 work existing: machine-enforced preflight and promotion checks, with no partial promotion on drift or a failed precondition. Commit `e994188` completed that work.

On 2026-09-12 the owner ruled, Decision 0(a) in `docs/evidence/phase-4/live-kickoff/decision-packet-2026-09-12-composition-and-exercise.md` §0, that the packet governs, that Task 17's §7 condition is satisfied, and that this document was stale on that point. **Correction, amended 2026-09-12 under that ruling** — the line this replaces read Tasks 16–17 as unauthorized; `tasks/phase-4-todo.md` is amended the same day for the same reason.

Task 17 authorization is narrow: one bounded, text-only, no-tool, no-external-effect live kickoff under the Task 16 packet's preflight and turn-budget limits. It does not authorize Phase 5 behavior, high-fidelity art, final visual tokens/assets, visual-baseline promotion, deployment, or any external effect, all of which remain unauthorized pending separate explicit approval. Role composition and the owner-gated promotion CLI now exist (`35596d8` through `1c6f620`). **Amended 2026-09-13:** `collectHandshakeFacts` and the kickoff harness now exist, and all six authored-role exercises performed under `bcba1f2` after the controlled home was fixed to provision the runtime credential it had been withholding. Promotion remains owner-run and has not been run; `roles:promotion:status` reports an empty promoted set. Owner transcript review and a fresh go/no-go are still required before the one live kickoff run.

**Phase 4 is complete and Phase 5 is authorized as of 2026-09-14.** The bounded live D-25 round ran
its full thirteen turns (Task 17) and the Phase 4 evidence packet is delivered (Task 18); the Phase 4
owner gate is open. The owner approved the charter produced by that round, with its ten evidence gaps
as blocking conditions, and authorized Phase 5 under four rulings recorded in
`docs/evidence/phase-5/decision-record-2026-09-14-phase-5-authorization.md`: **5-A hybrid** — agents
own design, review and verdict while implementation is driven conventionally, a recorded departure
from the literal MDD §24 run; **5-B a 60-turn budget** that stops rather than negotiates; **5-D the
MDD §19/§20 gate repeated properly**, with one screen-reader walkthrough actually performed. The
charter is `docs/evidence/phase-5/approved-charter-v1.md`. Phase 5 Task 10 owner acceptance remains
owner-run, and **Phase 7, deployment, external effects and production reuse of fixture code remain
unauthorized.**

**Amended 2026-09-18:** the owner ruled C-17 **met** after the bounded NVDA screen-reader
walkthrough was performed and recorded in `docs/evidence/phase-5/screen-reader-walkthrough-2026-09-18.md`.
The owner disposition is `docs/evidence/phase-5/c-17-owner-acceptance.json`; the prior waiver remains
historical. The walkthrough's V0/V1 findings and environment omissions remain open, and this ruling
does not replace an independent release-review refresh or authorize code, deployment, or production
reuse changes.

**Phase 6 is complete as of 2026-09-14.** `reconciliation-b-clarity` is the Active visual system,
promoted by owner execution under the Phase 6 gate. Phase 7 high-fidelity implementation remains
unauthorized.

**Phase 6 was authorized as of 2026-09-13, Tasks 1-7 only.** The owner approved `docs/visual-reference-production-brief-v0.1.md` as written (6-A) and authorized Phase 6 running in parallel with Phase 5 (6-B), amending MDD section 24 accordingly; the candidate production medium is the hybrid of generated exploration plus in-repo vector composition (6-C). All three rulings are recorded in `docs/evidence/phase-6/decision-request-2026-09-13-phase-6-parallel-start.md`. Candidate art produced under this authority stays Candidate: Task 8 selection and Task 10 promotion to Active are owner-run, and Phase 7 high-fidelity implementation, final tokens and assets, visual-baseline promotion, Phase 5 behavior, deployment, and any external effect remain unauthorized.

## Required delivery method

- Use specification-driven development with explicit human approval between specification, plan, tasks, and implementation.
- Use RED–GREEN–REFACTOR for every behavioral change.
- A test that did not first fail for the expected reason is not TDD evidence.
- Prefer deterministic state reducers and recorded event fixtures over live-provider calls in tests.
- Keep provider/runtime adapters separate from role templates and office-scene projection.
- Never treat a build, unit-test result, DOM snapshot, or state probe as visual proof.

## Visual acceptance

- Every UI change requires current-build browser screenshots at approved viewports, a clean console/network check, keyboard and reduced-motion verification, and comparison to the approved art-direction contract.
- Automated screenshot diffs detect change; they do not approve taste or art-direction fidelity.
- Final visual acceptance requires explicit owner approval recorded against named evidence.
- Never claim a viewport, browser, device class, or interaction was tested unless it was directly exercised.

## Agency Agents imports

- Treat Agency Agents content as versioned upstream input under the MIT License, not as CuckCode runtime architecture.
- Record upstream repository URL, commit or release, source path, original role ID, and license metadata for every imported role.
- Preserve upstream text separately from CuckCode overlays so updates can be diffed and attribution retained.
- Never auto-update role definitions into production. Import, validate, review, then promote.
- Connected agents fill CuckCode roles through capability contracts; role identity must not assume a specific model provider.

## Safety and scope

- Never expose credentials, hidden prompts, or private chain-of-thought in the office UI or audit log.
- Require explicit approval for destructive operations, external publishing, production deployment, financial transactions, or changes outside the active project.
- Preserve audit events and artifacts; do not rewrite history to make a run appear successful.
