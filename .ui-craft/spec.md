# CuckCode composition specification

Status: **Owner-approved for Phase 4 Tasks 1–15 on 2026-08-13**
Date: 2026-08-13

## Surface: Graybox office workspace

### Composition

**Recipe:** Custom spatial operations workspace; dashboard recipes are explicitly inapplicable.
**Why:** The durable brief requires the office to carry primary comprehension and excludes persistent card grids, metric panels, dashboard widgets, and dense status sidebars.

**Craft Read:** *isometric office workspace for non-technical managers and participating agents, product language, neutral graybox with non-promotable functional cues, variance 5, signature bet: every spatial state has a synchronized inspectable DOM twin.*

### Layout skeleton

1440×900 canonical reset:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Project / outcome          runtime health          session / Reset view     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌ reception ┐       ┌──── team work area: six role stations ───────────┐   │
│  │ Candidate │       │ Delivery  Design  Implementation  Test  VQA  RR   │   │
│  └───────────┘       └───────────────────────────────────────────────────┘   │
│                                                                              │
│       ┌ Project Library ┐   ┌ collaboration table ┐   ┌ review station ┐    │
│       └─────────────────┘   └─────────────────────┘   └────────────────┘    │
│                                                                              │
│  ┌ manager desk / current priority ┐                ┌ delivery area ┐       │
│  └─────────────────────────────────┘                └───────────────┘       │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Office outline is reachable before the canvas and mirrors its current state │
└──────────────────────────────────────────────────────────────────────────────┘
```

Deterministic overlays:

```text
Attention rail open: scene resizes from one side; selected target remains visible.
Inspector open: scene resizes from the opposite side; focus returns on close.
Both open: authored minimum scene bounds preserve all six roles and Reset view.
1280×800: same orientation and hierarchy, fit zoom reduced within approved stop.
```

No mobile composition is specified or claimed.

### Component inventory

| Region | Component | Contract |
| --- | --- | --- |
| application | Skip link and workspace landmark | Native DOM; reaches Office outline first |
| project bar | Project identity, current outcome, runtime health, session controls, Reset view | Canonical read model and typed camera intent |
| office | PixiJS graybox scene | Immutable scene descriptors; no workflow truth |
| outline | Office outline tree/list | Equivalent people, zones, state, relationships, and actions |
| attention | Collapsible manager-attention rail | Derived ordered attention items; never a second task store |
| inspector | Contextual inspector | State, cause, freshness, work, blocker, evidence, runtime, permissions, history |
| evidence | Focused evidence view | Named artifacts, tests, visual evidence, release findings |
| kickoff | Briefing, role round, synthesis, disagreements, revisions, manager decision | Canonical D-25 collaboration objects |
| feedback | Live region and inline status | Semantic changes only; no ambient narration |
| fallback | Canvas unavailable/context-lost notice | Office outline remains fully operable |

### State lattice

| State | Requirement | Workspace behavior |
| --- | --- | --- |
| idle | Required | Stable office and obvious current priority; no fake activity |
| loading | Required | Project bar and outline remain; scene-shaped placeholder after 200 ms |
| empty | Required | Explain missing project/team and provide valid next action |
| partial | Required | Preserve available office/outline data; label missing subjects and freshness |
| error | Required | Specific cause, stable error ID, recovery action, no false working state |
| conflict | Required | Preserve both contributions/conclusions and route to disposition |
| offline | Required | Mark runtime unavailable; keep inspectable persisted state and recovery path |
| stale | Required | Show last update and uncertainty; no active animation |
| success | Required | Persist result in context; never rely on a transient toast |
| reduced motion | Required | Immediate placement, persistent cues, focus and announcements; no travel/parallax |
| canvas unavailable | Required | DOM Office outline becomes the usable primary interface |

### Acceptance bar

- [ ] All required zones and six role locations appear at canonical reset in both approved viewports.
- [ ] Office comprehension precedes inspector use; persistent chrome remains limited to the approved structures.
- [ ] DOM and canvas share stable IDs, selection, focus, state, relationships, and actions.
- [ ] Every semantic visual answers state, cause, update time, and freshness in the inspector.
- [ ] No semantic motion occurs without a canonical transition; no ambient loop ships.
- [ ] Reset, pan, zoom, cutaway, depth order, and hit regions are deterministic and keyboard-equivalent.
- [ ] Attention rail and inspector cannot permanently hide current attention, six roles, or Reset view.
- [ ] Loading, empty, partial, error, conflict, offline, stale, and canvas-loss states have truthful recovery.
- [ ] Complete and approved remain distinct in scene, outline, inspector, and manager actions.
- [ ] Reduced motion preserves all semantic meaning without travel or camera interpolation.
- [ ] Both Chromium viewport journeys have clean console/network evidence and current-build screenshots.
- [ ] Keyboard, axe, screen-reader, and 200% zoom evidence is recorded.
- [ ] Five-person comprehension threshold is met.
- [ ] Owner accepts graybox behavior/composition without promoting art fidelity.

## Surface: Collaborative kickoff

### Composition

**Recipe:** Focused decision workflow spatially anchored to the collaboration table and manager desk.
**Why:** The kickoff must preserve six attributable voices and disagreement without becoming a chat transcript or dashboard.

### Layout skeleton

```text
Office scene                            On-demand inspector
┌─────────────────────────────┐         ┌──────────────────────────────┐
│ collaboration table anchors │────────▶│ Shared briefing version      │
│ six participating agents    │         │ Six attributable entries     │
│ unresolved conflict markers │         │ Delivery Lead synthesis      │
│ manager desk decision path  │         │ Disagreement register        │
└─────────────────────────────┘         │ One revision per role        │
                                      │ Manager decision and charter │
                                      └──────────────────────────────┘
```

### Component inventory

| Region | Component | Contract |
| --- | --- | --- |
| collaboration table | Participation and disagreement projection | Active collaboration records only |
| inspector | Shared briefing and contributions | Equal versioned briefing; attributable role entries |
| synthesis | Candidate charter and disagreement register | No silent merge or consensus inference |
| revision | One bounded response per role | Affirm, amend, or challenge |
| manager desk | Select, edit, redirect, or reject | Explicit manager event; silence is not approval |
| charter | Versioned approved outcome contract | Required before any work becomes active |

### State lattice

| State | Requirement | Kickoff behavior |
| --- | --- | --- |
| briefing incomplete | Required | Block contribution and identify missing/shared-version mismatch |
| role round open | Required | Show six named slots and exact participation status |
| synthesis blocked | Required | Name missing contribution or malformed evidence; do not infer consensus |
| disagreement | Required | Preserve minority view and unresolved evidence gap |
| revision open | Required | Enforce one response per role and remaining boundary |
| redirected | Required | Close the round and create a newly bounded round |
| rejected | Required | Retain evidence; create no charter |
| approved | Required | Create exact charter version and manager approval reference |
| provider disconnected | Required | Stop live round, preserve received entries, create no synthetic response |

### Acceptance bar

- [ ] Every role receives the same shared briefing version and contributes exactly once in the initial round.
- [ ] Contributions remain attributable and machine-readable; agents cannot overwrite one another.
- [ ] Delivery Lead synthesis preserves disagreements, uncertainty, dependencies, and evidence gaps.
- [ ] Each role gets at most one explicit revision; silence is never agreement.
- [ ] Manager can select, edit, redirect, or reject with accessible forms and exact receipts.
- [ ] No active implementation state exists before an approved charter.
- [ ] Human and agent projections expose equivalent outcome, scope, evidence, permissions, conflicts, and dispositions.
- [ ] Deterministic fixture passes before any live kickoff.
- [ ] Live role promotion and provider execution remain separately owner-gated.
- [ ] A passing live kickoff produces a versioned charter but does not authorize Phase 5 execution.
