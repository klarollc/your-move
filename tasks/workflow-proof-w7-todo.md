# Workflow-proof W7 — Surface B primary list

Status: **superseded by the Your Move package on 2026-10-04 — not failed.** This checklist is
historical; conforming implementation may be carried forward under `tasks/your-move-plan.md`.
RED–GREEN–REFACTOR remains required. No live provider run, promotion, push, or visual owner
acceptance is authorized by this historical checklist.

Implementation note — 2026-10-04: the Surface B list, shared command actions, and server-owned
runner-start endpoint are implemented. Focused component, projection, runner, API, launch, route,
boundary, typecheck, and production-build checks pass. Browser captures were reviewed at 1440×900
and 1280×800 against the current production build; keyboard focus was exercised through create and
back to its trigger. The fake-log preview had no captured console warnings/errors or failed requests;
reduced-motion emulation produced no animations or transitions. The runner was unavailable in this
fake-log browser session. The owner reports starting a runner separately; this W7 verification did
not connect to it or submit a command. This task was in progress pending owner review before it was
superseded. The temporary screenshots are not owner acceptance evidence.

- [ ] Task 7 — Surface B primary list and execution path
  - RED: tests prove `/` renders the list by default, partial records are called partial, and the
    list module imports no office canvas, scene adapter, or isometric UI primitives.
  - GREEN: fetch the session and canonical event log, call `replayProject`, and project posture,
    evidence, assignment, and review state from the canonical log.
  - RED/GREEN: each manager action uses `/api/commands` with the latest revision and the shared
    `executeWorkCommand` server path. Stale revisions refresh rather than silently retry.
  - RED/GREEN: the execute action sends only a work item id. Trusted server configuration supplies
    worktree, model, reasoning effort, context paths, and explicit live opt-in; the child starts
    without a shell. Server tests cover authorization, assigned-only starts, duplicate starts,
    log-lock handoff, and busy-state read/write refusal with an injected fake runner.
  - Done when: create → assign → execute → evidence → review is operable from Surface B; focused
    tests/build pass; W7 verification submits no live work; viewport, console/network, keyboard and
    reduced-motion checks are directly exercised and prepared for owner review.
