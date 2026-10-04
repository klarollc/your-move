# Workflow proof — owner task approvals

Date: 2026-10-04
Source: the owner's direction in session, 2026-10-04: “both approved, go on w6”.

## Ruling

The owner approved the task breakdowns:

- W6 canonical posture projection, `tasks/workflow-proof-w6-todo-draft.md`.
- DF-047 streamed-effect classification, `tasks/df-047-todo-draft.md`.

W6 implementation is authorized to proceed. DF-047 is approved but deferred until W6 reaches its
owner-accepted gate. No live run or external effect is authorized.

## Required evidence sequence

W6 begins with the owner-run focused RED test. The implementation must not begin until the owner
confirms that the new assertions fail for the expected missing-projection behavior. Then complete
GREEN, typecheck, and the clean-tree owner-run verification required by the approved W6 task.
