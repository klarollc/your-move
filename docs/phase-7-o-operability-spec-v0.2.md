# Phase 7-O operability specification v0.2

**Status: DRAFT FOR OWNER REVIEW. Not approved for planning, tasks, or implementation.**
Authority to draft: owner rulings O-1 through O-4
(`docs/evidence/phase-7-o/decision-record-2026-09-23-operability-scope.md`) and R-1 through R-3
(`docs/evidence/phase-7-o/decision-record-2026-09-25-spec-review.md`).
Supersedes: `docs/phase-7-o-operability-spec-v0.1.md`, kept as the draft that
`docs/evidence/phase-7-o/spec-review-2026-09-25.md` assessed.
Governing: MDD §§2, 8, 9, 10, 14, 17, 18, 20 and 24; Active Phase 6 visual system `reconciliation-b-clarity`.

## Changes from v0.1

- **§3 is new.** Canonical vocabulary additions (R-1 A). v0.1 deferred the work-to-agent relation
  to the plan and did not address blocker reason or requested action.
- **§4:** auxiliary records may not supply state, condition, approval or requested-action facts.
  Freshness for a missing timestamp is `unavailable`, and replay issues block "current".
- **§5 is new.** Fixture provenance: office states are replayed event logs, with a structural
  guard (R-3).
- **§8, criterion 4, is new.** Decision sufficiency (R-2).
- **§8, criterion 7:** the answer key is hashed before the cold interval, and the operator records
  the performed marks.
- **§6:** Evidence Library opening at an item or version is stated as new behavior.

## 1. Outcome and scope

A manager selecting a person or office zone can see the recorded state, cause, freshness, blocker
or waiting condition, evidence, approval requirement, and next action needed to decide. The
manager-attention rail, office outline, scene cue, inspector, and Evidence Library draw from one
coherent read of canonical project data. Missing or conflicting data is visible as unresolved; it is
never replaced with a plausible fixture constant.

Phase 7-O covers the existing desktop graybox office, its deterministic fixture paths, the
read-model boundary that supplies it, and the additive canonical-vocabulary changes in §3. It does
not introduce high-fidelity art, a live provider call, new packages, deployment, or production reuse
of the Phase 5 fixture. It does not reopen the retired screen-reader walkthrough requirement.
Keyboard operability, accessible names, automated accessibility checks, and reduced-motion
equivalence remain in scope.

## 2. Current defect and limits of existing code

`apps/web/src/office-shell.tsx` defines `officeShellEntities` with hand-written state strings and
renders the same cause, revision, blocker, evidence, runtime and permission strings for every
selected entity. In the default fixture, `apps/web/src/office-canvas.tsx` reports
`attention_blocked_test` for the Test Engineer while the inspector says `Blocker: None recorded`. Per
O-2 this is V1.

The canonical record cannot currently answer the decision questions:

| Needed fact | Canonical source at `b83f23f` |
| --- | --- |
| Which work an agent is doing | None. `WorkItemTruth` has no assignee. Staffing maps role assignment → agent only. |
| Why work is blocked or waiting, and on whom | None. `work.transitioned` carries `workItemId`, `fromRevision`, `toState`. |
| What the manager is asked to do | None. The rail's `plainLanguage` and `requiredAction` strings are hand-written. |
| An agent's cause event and last update | Not retained. `projectOfficeScene` emits `null` for both. |
| Approval requirement | Partial: `requiredEvidenceKinds` and approval records. |
| Evidence links | Yes, per work item. |

The event envelope already carries optional `workItemId` and `roleAssignmentId`, plus `source` and
`trust`, but no projector uses them to relate work to a role assignment. The default web office
builds no canonical snapshot; its attention and library projections are hand-written.

This specification does not claim the defect was observed in a browser. It was confirmed by source
reading; browser observation belongs to the implementation evidence.

## 3. Canonical vocabulary additions (R-1)

Additive changes to `packages/contracts` and `packages/domain`. Event logs recorded before these
changes must still replay; where they lack the new facts, the projection reports the fact as
unresolved and never infers it.

### 3.1 Work-to-role-assignment relation

New events `work.assigned` and `work.released`, carrying `workItemId` and `roleAssignmentId`. The
work → agent join is then **work → role assignment → agent**, each link a canonical record.
Replay rules:

- an assignment naming an unknown work item or an inactive role assignment is a replay issue, not
  a silent drop;
- a work item may have at most one active assignment; a second assignment without a release is a
  replay issue;
- releasing a role assignment (`role.released`) leaves any work bound to it **unassigned and
  flagged**, not silently reassigned.

No join by role name, label, entity-ID string pattern, or array position is permitted anywhere.

### 3.2 Structured condition on attention-raising transitions

A `work.transitioned` event whose `toState` is `blocked`, `waiting_input` or `review_requested`
carries a `condition`:

- `reasonCode`: from a closed set defined in the contract;
- `summary`: short text written by the event's author;
- `waitingOn`: `{ kind: "manager" | "agent" | "external" | "evidence", id? }`. The `id` is required
  when the kind names a canonical record;
- `requestedAction`: one of the existing manager dispositions (`approve`, `decline`, `defer`,
  `cancel`, `redirect`) or `provide_evidence` / `answer_question`, plus a `summary`.

For logs recorded under the new vocabulary, `condition` is required for those three target states
and its absence is a validation failure. For earlier logs it is optional, and absence shows as
`No reason recorded`. The versioning mechanism (schema version bump or per-kind payload version) is
a plan decision. The requirement that old logs replay is not.

**Attribution.** `summary` text is a recorded claim, not a UI constant. The inspector shows it with
its event's `source` and `trust` (for example, "reported by the adapter"). It is never restyled as
system truth.

### 3.3 Agent presence provenance

Staffing replay retains, per agent, the `eventId` and `occurredAt` of the event that last set
presence and health. `projectOfficeScene` then emits them in place of `null`, and freshness is
computed from them.

## 4. Read-model contract

One pure, deterministic application-level projection takes a canonical project snapshot, a fixed
observation time, and optional versioned auxiliary records. It returns a single immutable office
read model. The model carries its project identifier, source event-set identity, observation time,
provenance, and replay and projection issues.

**Auxiliary records are limited to presentation and runtime metadata**: labels, layout, runtime
binding and permissions from trusted structured records. They may **not** supply state, condition,
blocker, approval, evidence or requested-action facts. Each carries its own version and source.
Fixture records are marked `fixture`, and the UI cannot present them as a live runtime session.

For each selectable entity, the model carries:

- stable entity ID, kind, label, relationship and location;
- canonical state, the related work and agent identifiers via §3.1, and the event supporting the
  state, or a machine-readable `unknown` reason;
- last recorded update and freshness: `current`, `delayed`, `unavailable`, or an explicit
  unresolved condition. A missing or unparseable timestamp is `unavailable`, never `delayed`. **Any
  replay issue in the snapshot** (including `MULTIPLE_PROJECTS`) prevents the revision being
  presented as current;
- open attention items with reason, cause event, the §3.2 condition, and the relation that makes
  each item relevant to this entity;
- linked evidence IDs and versions with lifecycle and approval status, plus an explicit empty or
  unresolved result;
- the recorded approval requirement and next action, or an explicit statement that it is not
  available;
- runtime binding and permissions only from trusted structured records. Otherwise the UI states they
  are unavailable in this fixture.

Zones use the same truth rules. A zone without a canonical state record can keep a static location
label but must identify its status as layout-only. `officeShellEntities` may remain a registry of
IDs, labels and layout; it is not an authority for workflow state. The scene adapter, outline,
attention rail and inspector consume the same read-model revision.

## 5. Fixture provenance (R-3)

- The default office and every named state (`?state=…`, `?kickoff=…`) are **versioned event logs**
  replayed through `replayProject` and the §4 projection. No state is authored as projection output.
- The logs live in the tree, are reviewed like evidence, and state which comprehension tasks and
  acceptance criteria each one serves.
- **Structural guard.** Outside test files, `apps/web` may import projectors and read-model types
  but may not construct `ManagerAttentionItem`, office read-model entity records, or inspector
  records as literals. A repository test enforces this, in the manner of
  `scripts/evidence-immutability.test.mjs`. It asserts against the real type or constructor names
  exported by the packages, not a hand-copied list.

## 6. Inspector and attention behavior

The inspector opens from both the outline and the scene with the same entity ID. Its first screenful
answers: **What is happening? Why? What needs me? What evidence supports it?** Technical identifiers
remain available on demand. Existing selection, Escape-close, focus return and keyboard navigation
must remain operable.

If an open rail item relates to the selected entity, the inspector shows that same item: reason,
cause event, condition summary with its attribution, and requested action. Dismissing a rail item
hides it from the current view only. It does not resolve the canonical condition or remove it from
inspector truth. If a rail item cannot be joined to its claimed entity, the projection reports a
conflict, and the UI does not present either surface as current and complete.

The Evidence action opens the Evidence Library at the referenced item and version. **This is new
behavior.** Today `evidence-library.tsx` accepts only `initialEvidenceKind` and selects the first
record of that kind. If the library has no matching version, show `Evidence link unavailable` with
the ID; never open a different item. Completed and approved are distinct. An approval claim requires
the matching manager approval record and exact artifact and evidence versions.

For unavailable source fields, use precise text such as `No cause event recorded`,
`No reason recorded`, `No linked evidence recorded`, or `Work is not assigned`. `None recorded` is
valid only when the source was examined and explicitly establishes absence. Stale, disconnected,
partial, and replay-conflicted data may remain inspectable but carry a persistent freshness warning.

## 7. Adversarial truth checks

The projector rejects invalid input or emits a structured unresolved condition that the UI renders
visibly. The choice for each class is deterministic and documented. Neither path may render a
plausible success state.

| Fixture contradiction | Required result |
| --- | --- |
| Progress or active presence without supporting canonical event | No active/progress cue; show missing support or refuse the projection. |
| Entity placed in a zone without a supporting transition | Do not depict the entity in that zone as canonical. |
| Completed artifact without matching approval | Present completed, never approved. |
| Rail blocker absent from the related entity or work record | Expose a conflict in rail and inspector; never show `None recorded`. |
| Stale revision or disconnected runtime labeled current | Show delayed or unavailable, with the source revision or timestamp. |
| Evidence ID or version missing from the library projection | Show an unresolved link; never substitute another version. |
| Work assigned to an inactive or unknown role assignment (§3.1) | Replay issue; entity shows the relation as unresolved. |
| Attention-raising transition without `condition` under the new vocabulary (§3.2) | Validation failure; never rendered as a condition-free blocker. |

Tests mutate the authoritative event log while holding labels and layout constant. They verify the
mutation landed, and assert against the independent contract or event record rather than a value
copied from projector output.

## 8. Acceptance evidence

1. **Two-snapshot sensitivity:** for every selectable entity, vary every available state, cause,
   condition, evidence, approval and freshness input across two event logs. Every changed fact
   changes the relevant read-model field and the rendered detail. Explicitly test fields whose input
   stays absent. The current default Test Engineer contradiction must fail in RED for the expected
   reason.
2. **Cross-surface agreement:** every open attention item joins to an entity and work record or
   produces an explicit conflict. Rail, inspector and outline agree on state, condition, cause,
   requested action and freshness for the same revision.
3. **Adversarial fixtures:** all eight classes in §7 produce the specified refusal or visible
   unresolved state.
4. **Decision sufficiency (R-2):** in the default fixture log, for every open attention item, the
   inspector for the related entity **resolves**, rather than showing as unresolved, the cause
   event, the §3.2 condition (reason and waiting-on), the requested action, and at least one
   evidence link. In addition, the named fixture states used by comprehension tasks T3, T4 and T5
   resolve the facts each task asks about. A test enforces this. It fails on an inspector that is
   truthful but empty.
5. **TDD and isolation:** RED before GREEN for every behavioral change, then refactor with behavior
   held. Preserve deterministic fixtures, provider and runtime separation, and side-effect isolation.
   `npm run verify` completes, not merely individual suites. The §5 structural guard runs inside
   `verify`.
6. **Current-build UI evidence:** exercise Chromium at 1440×900 and 1280×800 (MDD D-07). Capture
   default, selected agent, blocked item, waiting, stale/offline, missing evidence,
   completed-unapproved, unassigned work, and conflict states where affected. Inspect console and
   network, pointer and keyboard paths, focus return, zoom, reduced motion, and non-colour meaning.
   Compare against the Active Phase 6 direction; screenshot diffs alone do not approve visual
   fidelity. Record V0/V1 findings and owner disposition.
7. **Human comprehension:**
   - After at least three days without substantive UI work, the owner performs all six tasks cold
     under MDD §20 and the n=1 protocol, expressly including T3, T5 and T6.
   - Before the interval begins, align the task URLs, fixture logs and answer key to the accepted
     UI, then commit them. Record the key's SHA-256 in the run preamble so it cannot drift during
     the interval.
   - Before opening the key, record the build, viewport, actual paths opened, and exact written
     answers. The operator marks each task performed or not performed at the time; the mark is not
     reconstructed afterwards.
   - Keep the "anything I could only answer because I built it" field.
   - Score only performed tasks. An unperformed task leaves the run incomplete and neither passes
     nor fails.

The Phase 7-O gate requires the V1 contradiction resolved, V0/V1 findings cleared, criteria 1–6
complete, a complete six-task comprehension run scored under MDD §20, and explicit owner acceptance.
T3, T5 and T6 must actually be performed; a retrospective answer or waiver does not satisfy this
gate.

## 9. Approval sequence

1. Owner reviews and approves or revises this specification.
2. Write an implementation plan and seek separate approval. The plan must decide the §3.2 versioning
   mechanism and the order of the contract, domain, application and web changes.
3. Write a task checklist and seek separate approval.
4. Implement only the approved tasks, then collect §8 evidence.
5. Owner accepts or records bounded revisions for Phase 7-O. Only then may separately approved Phase
   7 high-fidelity implementation begin.

Phase 5 release review and owner Task 10 may proceed independently. Deployment, external effects,
final visual promotion and production reuse remain outside this specification.
