# Your Move design-document amendment

**Status:** approved by the owner on 2026-10-04. Approval response: “Approve + bind digest.” This
amendment authorizes the scoped implementation plan and checklist; it does not authorize out-of-scope
workflow writes, live sessions, promotion, push, or external effects.

## Proposed amendment

Add an owner amendment to `docs/master-design-document-v0.1.md` recording that the approved
`docs/your-move/reference/surface-b-ui-spec.md` governs the primary Surface B presentation and
interaction details. In that scope:

- The product label is **Your Move**; CuckCode remains the repository and code name.
- The Dusk palette, typography, signal meaning, calm screen, global attention rail, status groups,
  detail panel, failure states, log time travel, journey motion, and Round 7 behaviors are those in
  the approved UI spec and its named round references.
- The UI package supersedes conflicting Surface B palette and composition guidance in the MDD and
  earlier Surface B work. Office work remains shelved and its visual contract is not changed.
- Workflow truth remains the canonical event log reduced by `replayProject`; all writes remain on
  `executeWorkCommand`. Any unsupported behavior follows the normal workflow-proof process before
  its event or command semantics are added.
- The supplied prototype and round HTML are design inputs. Their demo controls, in-memory event
  store, generic tasks and synthetic clock are not production behavior.

This is a scoped Surface B amendment. It does not amend unrelated MDD requirements, authorize a
live run, or constitute visual acceptance.

## Approval evidence

Owner decision: approve the amendment, implementation plan, and task breakdown; bind a measured
worktree content digest into relevant recorded evidence through the normal workflow-proof process.
The MDD, HANDOFF, position record, plan and checklist now record this ruling. The digest recommendation
is approved for proposal and implementation planning; changing the canonical event contract still
requires the workflow-proof gate in Task 7.
