# AGENTS.md — CuckCode

## Authority

Read these files before proposing or making changes:

1. `docs/master-design-document-v0.1.md`
2. `.ui-craft/brief.md`
3. `.ui-craft/tokens.md`
4. The latest approved task plan, when one exists

If implementation and documentation disagree, stop. Update and approve the design document before changing behavior.

## Current boundary

Phases 0, 1, and 2 were owner-accepted on 2026-08-13. Phase 3 specification and planning are authorized; Phase 3 implementation is not authorized until the owner approves `docs/phase-3-runtime-and-onboarding-spec-v0.1.md`, `tasks/plan.md`, and `tasks/todo.md`.

Phase 3 is limited to the provider-neutral runtime contract, pinned local Codex App Server stdio adapter, process supervision, normalized runtime events and approvals, stable runtime bindings, Candidate onboarding, controlled Agency Agents role-template import, universal and six role-specific qualification suites, staffing truth, and one explicitly supervised local live contract run. Do not add production UI, begin the collaborative kickoff, promote high-fidelity art, deploy, or begin Phase 4 behavior.

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

