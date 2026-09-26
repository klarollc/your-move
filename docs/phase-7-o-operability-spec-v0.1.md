# Phase 7-O operability specification v0.1

**Status: DRAFT FOR OWNER REVIEW. Not approved for planning, tasks, or implementation.**
Authority to draft: owner rulings O-1 through O-4, `docs/evidence/phase-7-o/decision-record-2026-09-23-operability-scope.md`.
Governing: MDD §§2, 8, 9, 10, 14, 17, 18, 20 and 24; Active Phase 6 visual system `reconciliation-b-clarity`.

## 1. Outcome and scope

A manager selecting a person or office zone can see the recorded state, cause, freshness, blocker or waiting condition, evidence, approval requirement, and next action needed to decide. The manager-attention rail, office outline, scene cue, inspector, and Evidence Library draw from one coherent read of canonical project data. Missing or conflicting data is visible as unresolved; it is never replaced with a plausible fixture constant.

Phase 7-O covers the existing desktop graybox office, its deterministic fixture paths and the read-model boundary that supplies it. It does not introduce high-fidelity art, a live provider call, new backend packages, deployment, or production reuse of the Phase 5 fixture. It does not reopen the retired screen-reader walkthrough requirement. Keyboard operability, accessible names, automated accessibility checks, and reduced-motion equivalence remain in scope.

## 2. Current defect and limits of existing code

`apps/web/src/office-shell.tsx` defines `officeShellEntities` with hand-written state strings and renders the same cause, revision, blocker, evidence, runtime and permission strings for every selected entity. In the default fixture, `apps/web/src/office-canvas.tsx` reports `attention_blocked_test` for the Test Engineer while the inspector says `Blocker: None recorded`. Per O-2 this is V1.

`replayProject` supplies a `CanonicalProjectSnapshot`; `projectOfficeScene` describes work, agent and collaboration state; `projectManagerAttention` describes attention for work and questions. They do not by themselves supply a complete inspector. In particular, `projectOfficeScene` sets agent cause and updated time to null and does not carry blocker or evidence links, while `WorkItemTruth` contains no assignee field. The default web office currently supplies hard-coded attention and library projections instead of a shared snapshot. The implementation plan must name how work, agent, evidence, and event identifiers are joined from authoritative records. A missing join must remain unresolved, not inferred from names or screen position.

This specification does not claim the defect was observed in a browser. It was confirmed by source reading; browser observation belongs to the implementation evidence.

## 3. Read-model contract

One pure, deterministic application-level projection takes a canonical project snapshot, a fixed observation time, and only versioned auxiliary records needed for facts the snapshot does not contain. The web receives a single immutable office read model. The read model carries its project identifier, source revision or event-set identity, observation time, provenance, and replay/projection issues. Fixture records must be explicitly marked `fixture`; the UI cannot present them as a live runtime session.

For each selectable entity, the model carries:

- stable entity ID, kind, label, relationship and location;
- canonical state, work or agent identifier where known, and the event supporting the state or a machine-readable `unknown` reason;
- last recorded update and freshness (`current`, `delayed`, `unavailable` or an explicit unresolved condition), calculated from a fixed clock and the relevant source timestamp;
- open attention items with reason, cause event, requested action and the entity/work relation that makes each item relevant;
- blocker or waiting-on detail, including the responsible party only when a record identifies one;
- linked evidence IDs and versions with lifecycle and approval status, plus an explicit empty or unresolved result;
- the exact recorded requirement for approval and next action, or an explicit statement that the requirement is not available;
- runtime binding and permissions only when supplied by trusted structured records. Otherwise the UI says that they are unavailable in this fixture.

Zones use the same truth rules. A zone without a canonical state record can retain a static location label but must identify its status as layout-only, not as a current operational state. `officeShellEntities` may remain a registry of IDs, labels, and layout relationships; it is not an authority for workflow state. The scene adapter, outline, attention rail, and inspector must consume the same read-model revision. No component may independently create a more reassuring state from a hard-coded string.

The projection does not invent an assignment relation. If existing canonical events do not establish which work belongs to an agent, the model emits an unresolved relation and the UI displays it. Adding a persisted assignment fact or event kind, if necessary, is a separate design choice to be justified in the implementation plan and approved within this spec's boundary before coding. No role-name matching or array-position joining is allowed.

## 4. Inspector and attention behavior

The inspector opens from both the outline and the scene with the same entity ID. Its first screenful answers: **What is happening? Why? What needs me? What evidence supports it?** Technical identifiers remain available on demand. Existing selection, Escape-close, focus return, and keyboard navigation must remain operable.

If an open rail item is associated with the selected entity, the inspector shows that same item, reason, cause event, and required action. Dismissing a rail item hides it from the current view only; it does not resolve the canonical blocker or remove it from inspector truth. If a rail item cannot be joined to its claimed entity, the projection reports a conflict and the UI does not present either surface as current and complete.

The Evidence action opens the existing Evidence Library at the referenced item/version when resolvable. If the library has no matching version, show `Evidence link unavailable` with the ID; do not silently open a different item. Completed and approved are distinct states. An approval claim requires the matching manager approval record and exact artifact/evidence versions. A `review_requested` or `completed` state alone cannot be labeled approved.

For unavailable source fields, use precise text such as `No cause event recorded`, `No linked evidence recorded`, or `Work-to-agent relation unavailable`. `None recorded` is valid only when the source was examined and explicitly establishes absence. Stale, disconnected, partial, and replay-conflicted data may remain inspectable but carry a persistent freshness warning; no control can imply that the displayed revision is current.

## 5. Adversarial truth checks

The projector rejects invalid input or emits a structured unresolved condition that the UI renders visibly. The choice for each class must be deterministic and documented; neither path may render a plausible success state.

| Fixture contradiction | Required result |
| --- | --- |
| Progress or active presence without supporting canonical event | No active/progress cue; show missing support or refuse the projection. |
| Entity placed in a zone without a supporting transition | Do not depict the entity in that zone as canonical. |
| Completed artifact without matching approval | Present completed, never approved. |
| Rail blocker absent from the related entity/work record | Expose a conflict in rail and inspector; never show `None recorded` in the inspector. |
| Stale revision or disconnected runtime labeled current | Show delayed/unavailable and the source revision or timestamp. |
| Evidence ID or version missing from the library projection | Show an unresolved link, never substitute another version. |

Tests must mutate the authoritative input while holding labels and layout constant. They must verify the mutation landed and assert against the independent contract or event record, not against an expected value copied from the projector output.

## 6. Acceptance evidence

1. **Two-snapshot sensitivity:** for every selectable entity, vary all available state, cause, blocker, evidence, approval and freshness inputs across two canonical snapshots. Every changed fact must change the relevant read-model field and rendered detail. Explicitly test fields whose input remains absent. At least the current default Test Engineer contradiction must fail in RED for the expected reason.
2. **Cross-surface agreement:** every open attention item joins to an entity/work record or produces an explicit conflict. Rail, inspector and outline agree on state, blocker, cause, required action and freshness for the same revision. No independent hard-coded status list passes this test.
3. **Adversarial fixtures:** all six classes in §5 produce the specified refusal or visible unresolved state. The tests verify no false activity, zone, approval, currentness or evidence version reaches the scene or inspector.
4. **TDD and isolation:** record RED before GREEN for every behavioral change, then refactor with behavior held. Preserve deterministic fixtures, provider/runtime separation and side-effect isolation. `npm run verify` must complete, not merely individual suites.
5. **Current-build UI evidence:** exercise Chromium at 1440×900 and 1280×800. Capture default, selected agent, blocked item, waiting, stale/offline, missing evidence, completed-unapproved, and conflict states where affected. Inspect console and network, pointer and keyboard paths, focus return, zoom, reduced motion, and non-colour meaning. Compare against the Active Phase 6 direction; screenshot diffs alone do not approve visual fidelity. Record V0/V1 findings and owner disposition.
6. **Human comprehension:** after at least three days from substantive UI work, the owner performs all six tasks cold under MDD §20 and the approved n=1 protocol, expressly including the previously unperformed T3, T5 and T6. Record the build, viewport, actual paths opened, exact written answers, and performed/not-performed for each task before opening the answer key. Score only performed tasks. An unperformed task leaves the run incomplete and does not pass or fail. Align the task URLs, fixtures and answer key to the accepted UI before the cold interval begins, with changes documented rather than rewriting the earlier study.

The Phase 7-O gate requires the V1 contradiction resolved, V0/V1 findings cleared, complete machine and browser evidence, a complete six-task comprehension run scored under MDD §20, and explicit owner acceptance. T3, T5 and T6 must be actually performed; a retrospective answer or waiver does not satisfy this gate.

## 7. Approval sequence

1. Owner reviews and approves or revises this specification.
2. Write an implementation plan and seek separate approval.
3. Write a task checklist and seek separate approval.
4. Implement only the approved tasks, then collect §6 evidence.
5. Owner accepts or records bounded revisions for Phase 7-O. Only then may separately approved Phase 7 high-fidelity implementation begin.

Phase 5 release review and owner Task 10 may proceed independently. Deployment, external effects, final visual promotion and production reuse remain outside this specification.
