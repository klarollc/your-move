# AGENTS.md — CuckCode

## Authority

Read these files before proposing or making changes:

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

Task 17 authorization is narrow: one bounded, text-only, no-tool, no-external-effect live kickoff under the Task 16 packet's preflight and turn-budget limits. It does not authorize Phase 5 behavior, high-fidelity art, final visual tokens/assets, visual-baseline promotion, deployment, or any external effect, all of which remain unauthorized pending separate explicit approval. It does not by itself authorize role composition or promotion — 17c-2b (role composition) and 17c-2 (the promotion CLI) are open owner decisions in the 2026-09-12 packet. The live kickoff cannot run yet regardless of authorization: role composition, the promotion CLI, `collectHandshakeFacts`, and the kickoff harness do not exist.

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

