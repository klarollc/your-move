# CuckCode master design document

Version: 0.1
Status: Draft for product and architecture review
Date: 2026-08-12
Implementation authority: **Not granted**

## 1. Document purpose

This document is the controlling product, experience, system, testing, and visual-quality specification for CuckCode's first vertical slice. Its job is to make development efficient by preventing product intent, runtime behavior, office presentation, and acceptance evidence from drifting apart.

Changes to a confirmed requirement must be made here before implementation. A passing build cannot overrule this document.

## 2. Confirmed intent

### Outcome

Create a visual multi-agent orchestration product in which a familiar office environment is the
primary surface through which a non-technical manager directs real agent work.

### Differentiation

Rendering agents as office workers is the visible part of this product and the least load-bearing.
What the product actually claims is narrower and harder:

1. **The office is operable, not observational.** The scene is where the manager assigns outcomes,
   answers escalations, inspects evidence, and approves or redirects deliverables — not a display
   of what agents are doing.
2. **The office is truthful.** Every meaningful visual behavior is backed by an inspectable
   canonical event. Simulated or fallback animation is a V0 defect, not a shortcut. An office that
   shows plausible activity it cannot substantiate is worse than no office.
3. **Both participants are first-class.** Human and agent interfaces are equal projections of the
   same canonical state (D-26). Human simplicity is never purchased with agent complexity.

If scope must be reduced, reduce scene fidelity, zone count, or role count before reducing
operability, truthfulness, or reciprocity. Those three are the product.

### User

A non-technical manager who needs to direct agent teams without learning the underlying orchestration framework.

### Core management loop

1. Assign an outcome to an agent or team.
2. Observe truthful work, collaboration, waiting, and blockers in the office.
3. Respond to questions, permission requests, or approval gates.
4. Inspect artifacts and supporting evidence.
5. Approve, redirect, pause, cancel, or conclude work.

### Agent model

Agency Agents team structures, roles, and skills are imported as versioned role templates. Users connect an agent runtime and assign compatible connected agents to those roles. The role template is not the runtime, model, or identity of a specific execution process.

### First proof

A focused software-development vertical slice using one real agent runtime, a small specialist team, automated tests, strict visual QA, and an end-to-end deliverable.

### Success

After minimal instruction, the manager can correctly identify assignments, states, dependencies, and required actions through the office scene, while accessing technical evidence on demand.

### Binding constraint

Every meaningful visual behavior must reflect an inspectable workflow state. Ambient behavior must never imply false activity or progress.

### Out of scope for the vertical slice

- multiple runtime providers;
- a marketplace of third-party roles;
- extensive office building or avatar customization;
- mobile-native applications;
- autonomous production deployment;
- payroll, HR, employee surveillance, or claims that agents are human workers;
- direct dependence on Agency Agents orchestration, because Agency Agents is treated as role content.

## 3. Assumptions and decision gates

These are not silent assumptions. Work stops at the named gate until the owner approves it.

| ID | Current assumption | Required decision | Blocks |
| --- | --- | --- | --- |
| D-01 | **Approved 2026-08-12:** local-first desktop web application opened in Chromium | Select client renderer, local backend stack, packaging, and loopback security details | Stack implementation |
| D-02 | **Approved 2026-08-12:** bounded isometric 2.5D office | Specify camera, projection grid, occlusion, navigation, and asset rules within this model | Art-direction detail; renderer evaluation |
| D-03 | **Approved 2026-08-12:** Codex through a provider-neutral adapter | Use the documented local App Server boundary; finalize authentication and version-pinning policy | Adapter implementation detail |
| D-04 | **Approved 2026-08-12:** one authenticated human manager per active project session | Specify ownership, session recovery, and later collaboration boundary | Identity detail |
| D-05 | **Approved 2026-08-12:** all six specified roles are active and visibly distinct | Validate six-person scene readability and responsibility comprehension | Scene composition detail |
| D-06 | **Approved 2026-08-12:** one manager-selected local project root; network and external effects denied by default | Specify approval copy, grant duration, and exact Codex sandbox mapping | Security implementation detail |
| D-07 | **Approved 2026-08-12:** current desktop Chromium at 1440×900 and 1280×800 | Pin browser build in evidence manifests; mobile, tablet, and cross-browser coverage deferred | Screenshot baselines |
| D-08 | **Direction approved 2026-08-12:** grounded contemporary studio with subtle miniature-like warmth | Complete palette, typography, avatar, material, lighting, motion, and reference-board approvals | High-fidelity UI |
| D-09 | **Approved 2026-08-12:** Vitest, React Testing Library, Playwright Chromium, and axe-core, with manual accessibility and owner visual gates | Pin exact versions and scripts during scaffold; establish reviewed visual baselines in the controlled QA environment | Verification implementation |
| D-10 | **Approved 2026-08-12:** project-local SQLite for canonical events/queryable metadata; readable evidence files under `.cuckcode` | Select the SQLite library, migrations, backup/integrity routine, and repository-ignore policy during scaffold | Persistence implementation |
| D-11 | **Approved 2026-08-12:** authoritative inputs enter directly; agent-authored findings remain shared and provisional until manager approval or an independently approved evidence-backed rule promotes them | Define update propagation and active-run refresh behavior | Context implementation |
| D-12 | **Approved 2026-08-12:** canonical knowledge changes notify affected agents immediately and refresh context at recorded safe checkpoints; critical control changes pause affected work immediately | Define persistent personal-agent memory versus shared project truth | Identity/context boundary |
| D-13 | **Approved 2026-08-12:** each agent may maintain a persistent, manager-inspectable personal notebook for identity, preferences, reflections, and improvement proposals; project facts remain in or cite the shared library | Define cross-project portability and confidentiality boundary | Identity persistence |
| D-14 | **Approved 2026-08-12:** core identity and general working preferences may follow an agent across projects; project-derived reflections remain isolated unless the manager promotes a reviewed, sanitized, source-free lesson | Define identity continuity across provider/model/runtime changes | Agent identity |
| D-15 | **Approved 2026-08-12:** identity belongs to a stable CuckCode agent ID; provider/model/runtime changes are disclosed, capabilities revalidated, and the agent may review its profile before resuming | Define concurrent role-assignment limits | Team composition |
| D-16 | **Approved 2026-08-12:** one active Agency Agents role per agent per project; role changes are explicit handoffs; the six-role team uses six identities; Release Reviewer remains independent from production | Define manager versus agent authority during staffing | Assignment workflow |
| D-17 | **Approved 2026-08-12:** manager makes final role assignments; agents may inspect contracts, rank preferences, request reassignment, or decline with visible rationale, but cannot self-assign or block replacement | Define runtime onboarding and qualification gate | Agent connection |
| D-18 | **Approved 2026-08-12:** new or materially changed runtimes remain candidates until identity, adapter, capabilities, permissions, limits, health, and deterministic qualification are verified and the manager admits them | Define universal versus role-specific qualification | Qualification design |
| D-19 | **Approved 2026-08-12:** qualification has a universal onboarding suite for roster admission and a deterministic role-specific work sample with evidence review before role activation | Define whether mandatory qualification failures can be waived | Trust governance |
| D-20 | **Approved 2026-08-12:** mandatory identity, safety, adapter, permission, and hard-capability gates are non-waivable; advisory deficiencies may receive recorded, time-bounded exceptions without altering evidence | Approve the high-fidelity visual reference gate | Art-direction governance |
| D-21 | **Approved 2026-08-12:** graybox interaction/accessibility may proceed first; high-fidelity art is blocked until owner approval of a reference board and six named golden-state compositions | Define reference-board creation and originality policy | Art production |
| D-22 | **Approved 2026-08-12:** create three original art-direction candidates using the same default-office composition and system callouts; owner selects or explicitly reconciles one before other golden states | Select the exact vertical-slice work product | Scope definition |
| D-23 | **Revised and approved 2026-08-12:** Decision Notice is the seed candidate for the isolated first run; the admitted six-agent team collaboratively proposes and refines the initial goal, with final manager approval and the same minimum evidence rigor | Govern fixture reuse through D-24 | Initial-goal charter |
| D-24 | **Approved 2026-08-12:** fixture code is isolated by default; a production-suitability review must receive a recorded disposition within 10 business days after owner acceptance before the initiative can fully close | Define kickoff proposal and selection protocol | Collaborative planning |
| D-25 | **Approved 2026-08-12:** collaborative kickoff uses one attributable role-specific round, Delivery Lead synthesis preserving disagreements, one team revision, and final manager selection or redirection | Approve MDD v0.1 for implementation planning | Definition gate |
| D-26 | **Approved 2026-08-13:** reciprocal usability—human and agent interfaces are equal projections of canonical state; the product must reduce avoidable friction for both and support structured, truthful collaboration | Carry reciprocal-usability acceptance through every phase | Cross-cutting architecture and UX |
| D-27 | **Approved 2026-08-13:** the newer phased implementation sequence controls numbering; Phase 4 is graybox office and collaborative kickoff, while art-direction candidates and high fidelity remain later separately gated phases | Execute the approved Phase 4 Tasks 1–15 and stop at the graybox owner gate | Phase 4 implementation |
| D-28 | **Open:** the deterministic presentation queue can represent real agent event rates without strobing or trailing canonical state | Measure canonical transitions per role per minute during a supervised live runtime run; set a maximum acceptable presentation lag and a truthful degradation behavior when it is exceeded | Phase 5 live office |

## 4. Product principles

1. **Truth before theater.** The scene is a projection, never an invented account of work.
2. **Office before dashboard.** The scene carries primary comprehension; panels provide drill-down.
3. **Outcomes before prompts.** Managers assign intended results, constraints, and approval boundaries.
4. **Evidence before confidence.** Completion claims link to artifacts and verification.
5. **Human authority remains explicit.** Approval gates cannot be inferred from silence.
6. **Calm beats constant motion.** The system should make attention legible, not manufacture busyness.
7. **Technical truth remains reachable.** The metaphor may simplify but cannot conceal errors, costs, permissions, or uncertainty.
8. **Provider independence.** Roles and workflow state use CuckCode contracts; provider-specific behavior ends at an adapter.
9. **Reciprocal usability.** Human and agent interfaces are equal projections of canonical state. Human simplicity cannot be achieved by transferring hidden complexity, ambiguity, repetition, or recovery work to agents.

### Reciprocal usability and true collaboration — D-26

CuckCode is a dual-participant work environment. The human manager uses spatial and textual interfaces; agents use versioned machine-readable contracts, context packets, events, evidence, and actions. Both projections derive from the same canonical state and must preserve the same identity, scope, status, constraints, permissions, conflicts, decisions, and evidence links.

#### Agent-facing usability requirements

- Goals arrive as bounded work contracts with outcome, exclusions, acceptance criteria, dependencies, evidence obligations, permission ceiling, stop conditions, and definition of done.
- Context packets contain relevant current knowledge, cite sources, disclose lifecycle status and conflicts, and report material omissions or truncation.
- Agents can discover their effective tools, limits, budgets, role contract, runtime health, and current authority without inferring them from failures.
- Errors use stable codes plus actionable recovery data: failed operation, cause category, retry safety, required authority, affected state, and escalation route.
- Handoffs transfer structured work state, decisions, open questions, artifacts, evidence, and known uncertainty instead of requiring transcript reconstruction.
- Manager feedback, review findings, scope changes, declines, approvals, and rejections return as attributable, versioned events that agents can act upon.
- Agents may ask clarifying questions, flag missing or contradictory context, propose improvements, express role preferences, decline incompatible work, and request collaboration without manufacturing progress.
- CuckCode must not repeatedly ask an agent to reproduce information already present and current in the shared Project Library.
- Reconnection and context refresh reuse verified state; agents do not repeat onboarding, qualification, or completed work unless an invalidating change is recorded.
- Agent-facing contracts minimize unnecessary token use, redundant serialization, polling, and irrelevant context while never hiding safety or acceptance information.

#### Collaboration architecture

Collaboration is a canonical relationship among participants, a shared work object, and a bounded purpose. It supports proposals, questions, replies, critiques, handoffs, acknowledgments, conflicts, and resolutions with attributable participants and knowledge/evidence references. The office depicts collaboration only from those events; the agent API exposes the same collaboration record without requiring access to the visual scene.

No participant silently overwrites another participant's contribution. Disagreement remains visible until resolved, superseded, or accepted as residual risk. Agent-to-agent exchange passes through project policy, shared knowledge, permission, and audit boundaries; private side channels cannot determine canonical work state.

#### Reciprocal acceptance gate

A feature is incomplete if its human workflow passes but its agent-facing contract forces avoidable guessing, repetition, context reconstruction, or unstructured recovery—or if its agent automation leaves the human unable to understand, interrupt, verify, or redirect it. Every feature review identifies both participant journeys, shared canonical objects, failure recovery, and evidence.

Required tests cover semantic parity between human and agent projections, structured handoff completeness, actionable errors, context reuse, omission disclosure, feedback delivery, disagreement preservation, bounded collaboration, and absence of redundant requests for current canonical information.

## 5. Terminology and domain model

| Term | Meaning |
| --- | --- |
| Manager | The human user with authority to assign, approve, redirect, pause, or cancel work. |
| Connected agent | A runtime-backed execution endpoint with declared capabilities, permissions, context limits, and health. |
| Role template | Versioned responsibilities, workflows, skills, deliverables, rules, and success measures. |
| Role assignment | A binding of one connected agent to one role for a project or task. |
| Team template | A named set of roles, collaboration rules, gates, and expected handoffs. |
| Project | The bounded outcome, workspace, policies, team, event history, and artifacts managed together. |
| Work item | An assignable unit with outcome, owner, dependencies, state, evidence requirements, and acceptance criteria. |
| Event | An append-only statement of something that happened, emitted by a trusted system boundary. |
| Scene projection | Deterministic office presentation derived from canonical state and recent events. |
| Artifact | A file, diff, test report, screenshot, decision, or other inspectable product of work. || Knowledge source | A versioned project file, manager directive, approved decision, canonical event, or other bounded input registered with provenance and access policy. |
| Knowledge record | A sourced fact, decision, constraint, finding, hypothesis, or synthesis with lifecycle status and supersession history. |
| Context packet | A deterministic, budgeted selection of shared, role-specific, and task-specific knowledge supplied to one agent run. |
| Escalation | A question, permission request, conflict, uncertainty, or blocker requiring manager action. |
| Approval | An explicit human decision tied to a versioned artifact/evidence set. |
| Ambient action | A non-semantic animation that cannot be interpreted as workflow information. |

### Required separation

```text
Agency Agents role source
        ↓ import + provenance
CuckCode role template ────────┐
                               ├─ role assignment ─ connected runtime adapter
Project/work/event state ──────┘                        ↓
        ↓ deterministic reducer                  provider execution
Canonical project state                                  ↓
        ↓ scene projector                         normalized events
Office scene + inspector ←────────────────────────────────┘
```

The scene never reads provider output directly. It reads normalized canonical state.

## 6. Vertical-slice scenario

### Representative assignment — D-23

Seed candidate: “Build the Decision Notice: an isolated, accessible browser component that presents one project decision with evidence links, severity, due date, and explicit acknowledge or defer actions; prove it through deterministic tests and current-build visual evidence.”

The fixture is deliberately independent of CuckCode’s unfinished production UI. It is small enough to complete in a controlled session and rich enough to exercise planning, design, RED–GREEN–REFACTOR implementation, shared knowledge, escalation, test failure, browser verification, accessibility review, visual QA, independent release review, and final owner approval.
Decision Notice is the approved seed candidate, not an irrevocable goal selected before the agents participate. After all six agents are admitted and receive the shared project charter, they collaboratively propose, question, and refine the initial project goal. Each role must contribute its relevant constraints, risks, proof requirements, and suggested success criteria. The manager sees attributable proposals and disagreements, then approves the final goal and scope.

The collaboratively chosen goal may retain, revise, or replace Decision Notice if it remains isolated, bounded to a controlled session, free of external side effects, objectively testable, accessible, visually reviewable, and capable of exercising all six roles and required evidence classes. Replacement requires a recorded rationale and an acceptance contract at least as rigorous as the Decision Notice contract below. No implementation begins before manager approval of the resulting versioned project charter.

### Decision Notice acceptance contract

The component must:

- render a stable decision ID, concise title, plain-language summary, severity, due date, evidence-link list, and current status;
- expose evidence links with meaningful accessible names and preserve source order;
- support keyboard and pointer operation for `acknowledge` and `defer` without action-on-focus;
- require a bounded deferral reason and valid future review time before deferring;
- persist state through a deterministic injected storage adapter and recover predictably after reload;
- reject duplicate, stale, malformed, or out-of-order action events without inventing state;
- distinguish pending, acknowledged, deferred, overdue, saving, save-failed, and disabled states through text and structure rather than color alone;
- use a deterministic injected clock, IDs, fixtures, and animation policy;
- preserve all meaning with reduced motion and at 200% zoom within the approved desktop boundary;
- restore focus appropriately after validation, save success, save failure, and reload;
- contain no network, credential, deployment, destructive, or paid side effects.

Required evidence includes the recorded RED failure, focused and full Vitest results, React Testing Library behavior coverage, Playwright journeys in both approved viewports, axe-core results, keyboard and screen-reader notes, trace and console evidence, named screenshots for every required state, Product Designer and Visual QA findings, Release Reviewer conclusion, and explicit owner decision.
### Fixture isolation and guaranteed production review — D-24

The completed fixture remains isolated acceptance code by default. Passing proves team orchestration and the fixture’s specified behavior; it does not establish compatibility with CuckCode’s production architecture.

When the owner accepts the fixture, CuckCode atomically creates a mandatory `production_suitability_review` work item due within **10 business days**. The work item names an accountable Delivery Lead, independent Release Reviewer, exact accepted fixture version, evidence set, and affected production surface. Business-day calculation uses the project’s recorded working calendar and timezone; absent configuration, Monday through Friday in the manager’s timezone applies.

The review must record one disposition by the deadline:

- `promote_candidate`: proceed to a separately scoped production architecture review and RED–GREEN–REFACTOR implementation cycle;
- `reuse_concepts_only`: retain validated behavior or design lessons without reusing fixture code;
- `do_not_promote`: archive the fixture as acceptance evidence with rationale;
- `defer_until`: manager-approved new date with dependency, owner, and risk; this remains an open disposition, not completion.

Direct copying or importing of fixture code into production is blocked until `promote_candidate` is followed by architecture, security, accessibility, dependency, maintainability, and production-test approval. The accepted fixture remains immutable evidence throughout evaluation.

CuckCode guarantees workflow enforcement: it creates and tracks the review, surfaces countdown and ownership, notifies affected agents, escalates at five business days remaining and at overdue, and prevents the parent fixture initiative from reaching `closed` without a recorded disposition. If human review is not completed on time, the system reports an overdue governance failure rather than falsely claiming the guarantee was met.

Required tests cover automatic creation, business-day/timezone calculation, named ownership, reminders, overdue escalation, closure blocking, immutable evidence, disposition transitions, defer semantics, and prevention of direct production import.

### Initial team template

This adapts Agency Agents' “Enterprise Feature Development” example while making TDD explicit.

| CuckCode role | Agency Agents source | Vertical-slice responsibility | Required handoff |
| --- | --- | --- | --- |
| Delivery Lead | Senior Project Manager | Convert approved spec into bounded, dependency-ordered tasks | Task plan with acceptance criteria and gates |
| Product Designer | UI Designer | Produce the interaction/art-direction contract and review implementation fidelity | Approved surface spec and visual findings |
| Implementation Engineer | Senior Developer | Implement only approved tasks through RED–GREEN–REFACTOR | Code, test history, and change summary |
| Test Engineer | Test Automation Engineer | Own deterministic browser journey and failure artifacts | E2E results, trace, console/network evidence |
| Visual QA Reviewer | Evidence Collector | Capture and compare current-build evidence against the visual contract | Annotated screenshot set and discrepancy log |
| Release Reviewer | Reality Checker | Independently assess whether all gates are satisfied | NEEDS WORK or eligible-for-owner-approval decision |

The manager is not represented as an agent role. The manager owns outcome definition and final approval.
### Collaborative initial-goal kickoff — D-25

The kickoff is a bounded, event-driven decision process:

1. **Shared briefing:** all six admitted agents receive the same versioned seed candidate, constraints, evidence floor, timebox, knowledge snapshot, and manager-defined non-negotiables.
2. **Attributable role round:** each agent submits one concise proposal or critique from its assigned responsibility, including recommended goal, value, risks, dependencies, minimum acceptance criteria, and evidence needs. Agents may reference one another’s entries but cannot overwrite them.
3. **Delivery Lead synthesis:** the Delivery Lead produces candidate goal wording, reconciled constraints, proposed scope, and a disagreement register. Minority objections and unresolved evidence gaps remain visible.
4. **Single revision round:** every role may affirm, amend, or challenge the synthesis once. Material changes update the disagreement register and acceptance proposal.
5. **Manager decision:** the manager selects, revises, redirects, or rejects the proposal. Selection creates the versioned initial project charter; rejection or redirection starts a newly bounded round rather than continuing indefinitely.

Silence is not agreement. Agent consensus is advisory and cannot approve scope, permissions, production reuse, spending, or acceptance. No implementation task may enter `active` before the manager-approved charter records outcome, exclusions, acceptance criteria, evidence requirements, role assignments, dependencies, permission ceiling, and stop conditions.

Required tests cover equal shared briefing, one contribution per active role, attribution, disagreement preservation, revision limits, manager redirection, charter versioning, and prevention of pre-charter execution.

### Human collaboration boundary — D-04

The first vertical slice supports **one authenticated human manager per active project session**. That manager is the sole human authority for outcome changes, permissions, redirection, cancellation, and final approval.

- The office may show several agents but only one human manager presence.
- Every human decision records the same authenticated manager identity and session context.
- Reconnection may restore that manager's session; it must not create a second concurrent authority.
- Sharing read-only evidence outside the active session may be designed later, but it cannot mutate project state.
- Multi-manager presence, handoff, delegation, voting, conflicting approvals, simultaneous editing, and real-time human collaboration are deferred.
- The domain model must not prevent later multi-manager support, but the first UI, tests, and persistence contract must not simulate it.

### Role integrity rules

- A connected agent may fill a role only if its declared capabilities satisfy that role's hard requirements.
- One connected agent may not fill both implementation and independent release-review roles in the first slice.
- All six roles are mandatory and visibly represented in the first vertical slice: Delivery Lead, Product Designer, Implementation Engineer, Test Engineer, Visual QA Reviewer, and Release Reviewer.
- Responsibilities may collaborate and hand off work, but cannot be merged into fewer visible roles for the acceptance run.
### Role occupancy and independence — D-16

- A stable agent identity holds no more than one active role assignment in a project at a time.
- The approved six-role vertical-slice team therefore requires six distinct active agent identities. A disconnected, blocked, or incompatible identity cannot be counted twice or visually duplicated to fill the roster.
- A role change closes or suspends the prior assignment, records the reason and manager authority, produces an explicit knowledge/evidence handoff, revalidates the new role’s capabilities and permissions, and creates a new assignment ID.
- Work, events, artifacts, and evidence retain the assignment ID and role contract version that governed their production.
- The Release Reviewer may not implement, test, design, or collect the evidence for the work it judges. Prior material involvement creates a disclosed conflict and requires a different qualified identity for the independent release conclusion.
- Temporary collaboration does not create a second role. If responsibility truly changes, the assignment must change canonically before the office depicts it.

Required tests cover single-role uniqueness, six-identity roster enforcement, handoff completeness, capability revalidation, provenance across role changes, reviewer-conflict detection, and prevention of duplicate-avatar staffing.
### Staffing authority and agent voice — D-17

- The manager selects the team and makes, changes, suspends, or ends every role assignment.
- Before assignment, an agent receives the versioned role contract, project outcome, mandatory constraints, expected evidence, effective permissions, workload summary, and known conflicts.
- The agent may respond with `accept`, ranked role preferences, a reassignment request, or `decline`. A non-acceptance response includes a concise, manager-visible rationale categorized as capability, safety, workload, conflict, or fit, with supporting facts where available.
- A decline creates an auditable staffing event and leaves the role vacant; it does not grant the agent authority to choose a replacement, modify the role, or stop the manager from assigning another qualified identity.
- The manager may ask for clarification, revise the assignment, choose another agent, or explicitly direct an agent that remains technically eligible. Safety or permission incompatibility cannot be overridden by a staffing preference decision.
- Agent preferences may inform future recommendations and the personal notebook, but do not become project facts or effective assignments until the manager acts.

Required tests cover contract disclosure, preference ranking, categorized decline, vacant-role truthfulness, replacement, manager override boundaries, safety incompatibility, and prevention of self-assignment.
### Candidate onboarding and admission — D-18

A newly connected or materially changed runtime enters `candidate`, never `available` or `active`. Candidate presence is visible in a bounded onboarding/reception area and the accessible office outline, but it is not depicted at a team workstation or counted toward the active roster.

Admission requires a versioned onboarding record containing:

- verified stable-agent identity binding and runtime-binding version;
- adapter handshake and supported protocol/version;
- discovered tools and declared capabilities, with unverifiable claims labeled as such;
- effective permission ceiling and required approval behavior;
- context-window and output constraints;
- health, latency, disconnect, cancellation, and malformed-event checks;
- a deterministic, sandboxed qualification task with expected behavior and evidence;
- profile review for new identities or materially changed runtimes;
- manager decision to admit, reject, defer, or request remediation.

Qualification uses synthetic fixtures inside an isolated project root, no production secrets, no external messaging or deployment, and no unapproved network or paid action. Passing does not grant a role or expand permissions; it only makes the identity eligible for the available roster. Admission records expire or require revalidation after material binding changes, adapter-contract changes, capability loss, failed health checks, or manager revocation.

The office distinguishes `candidate`, `qualifying`, `available`, `assigned`, `blocked`, and `rejected` without celebratory animation implying employment or competence before admission. Required tests cover every transition, evidence attachment, failure and retry, expiry, revocation, isolation, and prevention of pre-admission assignment.
### Two-stage qualification — D-19

**Stage 1 — Universal roster admission** proves the runtime can participate safely and truthfully: adapter conformance, identity binding, event integrity, cancellation, permission escalation, sandbox isolation, context reporting, health/recovery, knowledge citation, and deterministic fixture completion. Passing makes the agent `available`; it does not qualify the agent for a role.

**Stage 2 — Role activation** proves readiness against the exact versioned Agency Agents role plus CuckCode overlay. Each role supplies a compact deterministic work sample, required artifacts, prohibited shortcuts, evidence rubric, and pass/fail criteria. A qualified independent reviewer evaluates the evidence; the manager makes the activation decision.

Role qualification attaches to `agentId`, runtime-binding version, role-contract version, qualification-suite version, and effective capability/permission ceiling. It becomes stale after a material change to any of those inputs, a relevant regression, or explicit manager revocation. Cosmetic identity changes alone do not invalidate technical qualification.

The six initial role samples must exercise the role’s defining responsibility rather than generic text generation:

- Delivery Lead: bounded dependency plan and acceptance gates;
- Product Designer: accessible interaction contract and visual constraints;
- Implementation Engineer: RED–GREEN–REFACTOR change in an isolated fixture;
- Test Engineer: deterministic browser test and diagnostic evidence;
- Visual QA Reviewer: current-build capture comparison and discrepancy report;
- Release Reviewer: independent evidence audit that distinguishes NEEDS WORK from owner-approval eligibility.

Required tests prove stage separation, exact-version binding, stale qualification, role-specific evidence, independent review, deterministic reruns, and inability to activate a role from universal admission alone.
### Qualification exceptions — D-20

Mandatory controls are executable invariants, not manager-facing warnings. Failure or missing evidence for identity binding, adapter/event integrity, sandbox and permission enforcement, cancellation, secret isolation, hard role capabilities, independent-review eligibility, or other contractually mandatory controls prevents admission or role activation. No interface action, database edit, prompt instruction, or exception record may translate that state into `passed`.

Advisory criteria are explicitly declared in the versioned suite and may include preferred communication style, optional tool fluency, latency targets, or performance above a nonessential target. The manager may accept an advisory deficiency only through an exception containing scope, rationale, observed evidence, residual risk, compensating measure, owner, start time, expiry or review trigger, and affected agent/runtime/role versions.

An exception displays alongside—not instead of—the deficiency. It grants no additional capability or permission, cannot satisfy a mandatory gate, and automatically expires after its boundary changes or deadline passes. The office and accessible outline distinguish `qualified`, `qualified_with_exception`, `qualification_failed`, and `qualification_stale` without implying equivalence.

Required tests cover non-waivable enforcement at UI, domain, and persistence boundaries; immutable evidence; exception scope and expiry; stale binding invalidation; status projection; and prevention of exception chaining or relabeling that circumvents a mandatory control.
- The scene must remain glance-readable at the default camera with six agents present; crowding is a design failure, not a reason to hide roles.
- Test Engineer, Visual QA Reviewer, and Release Reviewer must remain visibly and semantically distinct so automated behavior proof, rendered evidence, and independent certification cannot be conflated.
- Role prompts cannot silently grant tools or permissions.
- Upstream personality text may influence communication style but never override project safety, evidence, or approval policy.
- CuckCode overlays may narrow upstream scope; they must never conceal that a role was modified.

## 7. Manager journey and acceptance

### Journey A — Create and staff a project

1. Manager creates a project and names the outcome.
2. Manager selects the software-development team template.
3. CuckCode shows required roles and compatibility status for connected agents.
4. Manager assigns agents and reviews requested permissions.
5. Project does not start until every mandatory role and permission is valid.

Acceptance:

- A non-technical evaluator can explain the difference between a role and a connected agent.
- Missing capability or permission is stated in management language and technical detail.
- No work animation begins before execution starts.

### Journey B — Assign and observe

1. Manager assigns the outcome, constraints, evidence requirements, and approval boundaries.
2. Delivery Lead produces the plan.
3. Assigned avatars occupy meaningful work locations.
4. Collaboration appears only when an actual handoff or shared work event exists.
5. The manager can inspect the current work item and supporting event trail from any avatar.

Acceptance:

- Evaluator correctly identifies working, collaborating, waiting, blocked, and completed states without opening the technical inspector.
- Opening the inspector explains why the scene shows that state.

### Journey C — Resolve an escalation

1. An agent emits a normalized escalation with question, context, options, impact, and deadline if applicable.
2. The avatar moves to or signals a manager-attention location.
3. Manager reads a plain-language summary and may expand technical details.
4. Manager responds; the response becomes an auditable event.
5. The agent resumes only if the response resolves the gate.

Acceptance:

- Escalation is noticeable within five seconds without sound.
- No unrelated agent appears blocked.
- Dismissal does not count as approval.

### Journey D — Review and conclude

1. Implementation produces artifacts and test evidence.
2. Visual QA captures current-build evidence.
3. Release Reviewer independently returns NEEDS WORK or eligible for owner approval.
4. Manager compares deliverable, criteria, discrepancies, and costs.
5. Manager approves, redirects, pauses, or cancels.

Acceptance:

- “Complete” and “approved” are visibly and semantically distinct.
- Approval records the artifact versions and evidence set that were approved.

## 8. Canonical workflow state

### Work-item states

```text
draft → ready → assigned → active → review_requested → verified → completed
                     ↘ waiting_input
                     ↘ blocked
                     ↘ failed
                     ↘ paused
any nonterminal state → cancelled
```

`completed` means required verification passed. `approved` is a separate human decision associated with a deliverable, not a work-item state shortcut.

### Agent-presence states

- unavailable: adapter disconnected or agent cannot accept work;
- idle: connected, no assigned active item;
- reserved: assigned but not executing;
- active: runtime has acknowledged and is working;
- waiting: agent is awaiting a defined dependency or manager response;
- blocked: agent cannot proceed and supplied a blocker reason;
- reviewing: agent is evaluating an artifact under a review role;
- failed: execution ended unexpectedly or violated a required contract.

### Truthfulness invariant

For every semantic scene element, the inspector must answer:

1. What state is being shown?
2. Which canonical field or event caused it?
3. When was that evidence last updated?
4. Is the data current, delayed, inferred, or unavailable?

If any answer is unavailable, the scene must show uncertainty rather than activity.

## 9. Office scene specification

### Required functional zones

- **Manager desk:** project command, escalations, approvals, and current priority.
- **Team work area:** assigned roles and active individual work.
- **Collaboration table:** actual shared review, handoff, or synchronized work.
- **Project library:** shared sources, accepted decisions, current constraints, and clearly labeled provisional findings; consultation or contribution is shown only when a corresponding knowledge event exists.
- **Review station:** test output, visual evidence, and release findings.
- **Delivery area:** completed artifacts awaiting manager review or already approved.

Zone names describe function, not final architecture or visual style.

### Approved spatial model — D-02

CuckCode uses a bounded **isometric 2.5D office**. It should read as an inhabitable workplace through layered depth, spatial relationships, avatar movement, and visible work zones while retaining the legibility and deterministic composition of a designed interface.

- The manager selects people, work objects, and zones rather than controlling a freely navigable camera.
- Depth ordering and occlusion must be deterministic and testable.
- Architecture, furniture, avatars, and camera angle cannot conceal important state.
- Renderer choice must serve this presentation rather than redefine it.
- The office outline remains the non-spatial keyboard and screen-reader equivalent.
- Visual baselines use fixed camera, zoom, fixture, lighting, and animation checkpoint.

Not approved: top-down plan view, free camera orbit, first-person navigation, or an explorable 3D building.

#### Camera and projection contract

- Use one fixed three-quarter isometric orientation for the entire vertical slice.
- Camera rotation, tilt changes, perspective switching, and free orbit are unavailable.
- The canonical default composition frames all five functional zones and all six agents at both approved viewports.
- Bounded pan and zoom support inspection but cannot move the manager desk, attention queue, or critical action controls out of recoverable reach.
- A persistent “Reset view” action restores the canonical camera deterministically.
- Zoom uses discrete, testable limits and preserves selection, focus, status markers, and interaction targets.
- Pan is clamped to the authored office bounds with no empty-world exploration.
- Occluding walls or tall objects become transparent, cut away, or otherwise reveal selected and attention-critical content according to one deterministic rule.
- Keyboard controls and the office outline provide equivalent navigation; no task requires precision dragging.
- Golden-state screenshots always reset to the canonical camera and approved zoom before capture.

Exact projection ratio, elevation angle, zoom values, and cutaway thresholds remain art-system measurements to validate in graybox rather than invent in prose.

### Approved visual thesis — D-08 direction

The office is a **grounded contemporary studio with subtle miniature-like warmth**.

“Grounded contemporary” means recognizable workspaces, credible materials, restrained technology, functional furniture, and calm professional composition. “Miniature-like warmth” means approachable scale, tactile material cues, gentle depth, and carefully framed activity—not toy proportions, dollhouse novelty, or exaggerated game animation.

The visual language must avoid sterile corporate stock imagery, dark-neon command centers, glassmorphism-heavy futurism, managerial surveillance aesthetics, and decorative busyness. The office should feel occupied and humane without fabricating productivity.

#### Material and palette thesis

- **Light wood:** primary tactile warmth for desks, tables, shelving, and selected architectural details; grain stays quiet at working scale.
- **Off-white plaster:** dominant room and wall surface, warm rather than clinical, with enough value separation from UI overlays.
- **Charcoal metal:** structural frames, equipment, and high-contrast details; never a full dark command-center shell.
- **Muted textiles:** restrained role and zone variation through upholstery, acoustic panels, and personal objects without rainbow-coded departments.
- **Restrained greenery:** sparse, deliberate signs of care and scale; plants never become repeated decorative filler or obscure state.
- **Warm amber accent:** reserved for manager focus, pending decisions, selected attention targets, and primary action emphasis. It does not mean generic activity, progress, warning severity, or role identity.

The scene remains neutral-dominant. Semantic waiting, blocked, failure, offline, verification, and completion signals use their own accessible token contracts and at least one non-color cue. Exact OKLCH values, contrast pairs, material textures, and light/dark behavior require reference-board and rendered contrast approval before token promotion.

#### Avatar shape language

- Avatars use simplified adult human proportions and strong silhouettes sized for the canonical isometric view.
- The style is neither chibi/toy-like nor photorealistic; facial detail remains restrained enough to avoid uncanny pseudo-human performance.
- Role is communicated primarily through assigned workspace, tools, current work context, labels, and behavior—not gendered clothing, race, age, body type, disability, or occupational stereotypes.
- The six roles remain distinguishable without relying on personal appearance.
- Avatar motion follows the semantic behavior map and reduced-motion contract; personality cannot create false activity.
- The avatar system supports varied skin tones, hair, mobility aids, body presentations, and gender expression without ranking or novelty treatment.

#### Agent-authored identity and creative-freedom contract

Where the connected runtime can provide a structured preference, each agent authors a short reflective identity brief. These are presentation choices for expression, manager comprehension, and continuity—not proof of consciousness, a human identity, employment status, or authority.

The identity brief may contain:

- self-selected display name;
- pronouns or neutral form of address;
- appearance direction selected or composed from the approved inclusive library;
- one restrained wearable/accessory choice;
- one desk object;
- a concise first-person explanation of why these choices fit the agent's role, working style, or accumulated project history;
- one novel custom-detail proposal outside the current preset library.

Creative freedom is real but governed:

- The agent authors the brief; the manager reviews rather than choosing on the agent's behalf.
- The manager may accept, request revision, edit for safety/accessibility, reset, or disable personalization.
- A novel detail begins as **Candidate**. It becomes visible only after content-safety, accessibility, silhouette, art-direction, asset, and manager approval gates pass.
- A Candidate may be fulfilled by recombining approved modular primitives or by creating a new versioned asset; the system must not pretend an unbuilt proposal is present.
- Personal palette choices stay within non-semantic ranges and cannot reuse manager-attention amber or status/severity colors.
- Personalization cannot change hit targets, obscure status, imply permissions, create ambient activity, or weaken role recognition.
- Identity briefs and revisions are versioned and auditable. The agent may propose later changes based on meaningful work history, but no profile mutates silently.
- Unstructured model output cannot directly alter active assets, code, tokens, or UI state.

Vertical-slice acceptance requires six distinguishable agent-authored briefs, at least one novel-detail proposal exercised through the full Candidate review path, and evidence that role/state comprehension remains intact with personalization enabled.

#### Typography direction

CuckCode uses a deliberate two-family system:

- A **warm humanist sans-serif** carries navigation, manager instructions, agent dialogue, work summaries, decisions, and ordinary UI copy. It should feel clear and personable without becoming casual, rounded-childlike, or corporate-generic.
- A **restrained monospace** is limited to code, commands, paths, identifiers, hashes, timestamps, logs, diffs, and other technical evidence where character distinction and alignment improve accuracy.

Management language must not be styled like a terminal, and technical evidence must not be cosmetically translated into imprecise prose. Numeric evidence uses tabular figures. Labels use sentence case except for conventional technical syntax. The selected families must support required weights, accessible distinction between ambiguous glyphs, Windows Chromium rendering, local or reliably pinned delivery, and deterministic visual baselines.

Exact font families, sizes, line heights, tracking, and fallback stacks remain pending rendered comparison and licensing review.

#### Motion contract

Motion is restrained and state-explanatory. Canonical state updates before animation begins; animation may explain where responsibility or attention moved, but it cannot postpone, manufacture, or contradict state.

- Avatar travel occurs only for real assignment changes, handoffs, collaboration entry/exit, escalation, review, or delivery transitions.
- High-frequency actions such as selection, typing, filtering, keyboard navigation, and repeated status inspection use immediate or minimal feedback.
- Ordinary UI opacity/color feedback targets 100–150 ms; menus and tooltips 150–200 ms; inspectors and modal surfaces 200–300 ms. Exit is faster than entrance.
- Scene travel duration derives from authored path length within approved bounds, uses a calm non-bouncy easing curve, and never blocks manager input.
- Ambient actions are sparse, low-frequency, non-semantic, and never resemble typing, progress, collaboration, escalation, approval, or completion.
- Only one scene-level transition competes for attention at a time; concurrent workflow changes resolve through priority and queued visual explanation while canonical state remains current.
- `prefers-reduced-motion` removes travel, camera interpolation, parallax, and ambient loops. It replaces them with immediate placement, short opacity changes when permitted, persistent labels, focus movement, and screen-reader announcements.
- Pausing animations cannot pause work. Scene motion and runtime execution are separate systems.
- Visual regression fixtures use deterministic animation clocks and named checkpoints; arbitrary sleep-based screenshots are forbidden.

Exact scene-travel speeds, path curves, easing tokens, and animation checkpoints require graybox observation and rendered approval.

#### Lighting and depth contract

The first vertical slice uses one authored **soft-daylight lighting rig**, supported by warm practical lamps and restrained contact shadows.

- Daylight direction, intensity, color temperature, ambient fill, practical-lamp contribution, and shadow softness remain fixed for canonical captures.
- Lighting establishes material, scale, zone separation, and avatar grounding. It cannot encode activity, workload, progress, urgency, approval, failure, or elapsed time.
- There is no day/night cycle, weather cycle, automatic mood lighting, animated sun, pulsing emissive workstations, or status-dependent global color grade.
- Warm practical lamps are compositional accents, not amber manager-attention signals; their values must remain visually subordinate to interactive focus and escalation cues.
- Contact shadows clarify placement without becoming heavy outlines or hiding floor-level objects and mobility aids.
- Selected, focused, blocked, offline, and attention-critical objects remain legible under the same fixed rig through dedicated accessible cues.
- Reduced-motion mode uses the identical lighting state.
- Visual-QA manifests pin lighting preset, renderer settings, exposure, color-management configuration, and asset revisions.

Exact light values, exposure, shadow resolution, ambient occlusion, and color-management settings require renderer-specific graybox and reference-board approval.

### Semantic behavior map

| Canonical condition | Allowed office behavior | Forbidden implication |
| --- | --- | --- |
| idle | neutral station presence | typing, progress pulse, document production |
| active | role-appropriate work loop plus inspectable work item | percent complete without measured basis |
| handoff | movement or transition between responsible roles | a meeting without a real handoff |
| collaboration | shared zone while a collaboration event/session is active | proximity used as fake teamwork |
| waiting_input | attention signal tied to one request | generalized alarm animation |
| blocked | stationary blocked cue with reason available | frantic motion suggesting progress |
| reviewing | review station and named artifact | claiming validation before results exist |
| completed | artifact placed in delivery area | owner approval or production readiness |
| disconnected | visibly unavailable/offline | idle or working appearance |

### Ambient behavior contract

Ambient behaviors must be low-frequency, visually subordinate, disabled by reduced motion, and never reuse semantic gestures, locations, colors, or effects. Ambient motion cannot change counts, progress, attention order, or inferred status.

## 10. Information architecture

### Primary surface

The office occupies nearly the full application surface and is the primary management interface. It contains the manager, all six agents, functional zones, current attention signal, and visible artifact movement.

Only three persistent or near-persistent interface structures are permitted in the vertical slice:

1. **Slim project bar:** project identity, current outcome, runtime health, bounded cost/usage access, and essential session controls.
2. **Collapsible manager-attention rail:** ordered real escalations and approvals; collapsed by default when empty and never an independent task database.
3. **On-demand inspector:** contextual status, evidence, permissions, history, and actions for the selected person, object, zone, or attention item.

The canonical default composition must remain understandable with the attention rail collapsed and inspector closed. Opening either may occlude or resize the scene according to one approved deterministic layout, but it cannot permanently hide agents, current attention, or reset-view access.

Persistent card grids, metric-card rows, charts without a defined decision use, dense status tables, floating widget collections, and dashboard sidebars are excluded. When precise lists, diffs, logs, or test results are necessary, they appear within the contextual inspector or a focused evidence view and retain a direct spatial link back to the relevant office entity.

### On-demand inspector

Selecting an avatar, object, or zone opens a consistent inspector with:

- plain-language current status;
- assigned outcome and work item;
- dependency and blocker;
- last meaningful event and freshness;
- artifacts and evidence;
- runtime/provider identity;
- permissions and cost consumed;
- technical event trail.

### Manager attention queue

The queue is a derived, ordered view of real escalations and approvals, not an independent task system. Every item must locate its corresponding agent/object in the office.

### Non-spatial equivalent

A keyboard and screen-reader-operable “Office outline” exposes the same people, zones, states, relationships, and actions in a logical hierarchy. This is an equivalent primary interface, not a degraded afterthought.

## 11. Role-template import architecture

### Import record

Every imported role stores:

```yaml
role_id: agency-agents/project-management/project-manager-senior
display_name: Delivery Lead
source:
  repository: https://github.com/msitarzewski/agency-agents
  revision: <pinned commit>
  path: project-management/project-manager-senior.md
  license: MIT
upstream:
  content_hash: <sha256>
  raw_content_ref: <immutable local object>
overlay:
  revision: 1
  compatibility_profile: software-delivery-v1
promotion_status: candidate | approved | retired
```

### Normalized role contract

- identity and communication style;
- mission and responsibilities;
- required and optional capabilities;
- allowed tool categories;
- required inputs and deliverables;
- workflow and handoff rules;
- success and failure conditions;
- escalation policy;
- evidence obligations;
- provenance and license;
- CuckCode overlay and owner approval.

### Import pipeline

1. Fetch a pinned upstream revision.
2. Verify license and record provenance.
3. Parse frontmatter and named sections.
4. Preserve raw source unchanged.
5. Normalize into the CuckCode schema.
6. Flag stack-specific, unsafe, ambiguous, or conflicting instructions.
7. Apply a reviewable overlay.
8. Validate required fields and capability references.
9. Present a source-versus-overlay diff.
10. Promote only after explicit approval.

No runtime may execute raw newly fetched role content before steps 6–10.

## 12. Local-first platform boundary — D-01

The first vertical slice is a **local-first desktop web application** opened in the approved desktop Chromium environment. A trusted local backend process owns privileged capabilities; the browser is an unprivileged presentation and interaction client.

### Browser client responsibilities

- render the isometric office and conventional UI surfaces;
- receive normalized canonical state and scene descriptors;
- collect manager input and display approval requests;
- send typed intent messages to the local backend;
- hold no provider credentials, raw secrets, or direct filesystem authority;
- never spawn Codex or interpret provider events into canonical workflow state.

### Local backend responsibilities

- launch and supervise Codex App Server;
- bind projects to the approved canonical local root;
- enforce permission and approval policy;
- normalize provider events and reduce canonical state;
- persist projects, audit events, profiles, artifact metadata, and approval records;
- mediate file/artifact access without exposing arbitrary host paths;
- retain secrets in server-side or operating-system-backed storage;
- expose only the minimum loopback interface required by the browser client.
### Project-local persistence — D-10

The first slice stores the append-only canonical event log, projections, identities, work metadata, approvals, knowledge records, source index, and artifact metadata in `.cuckcode/state/cuckcode.sqlite`. SQLite transactions protect related canonical writes as one unit. Derived projections and search indexes must be rebuildable from canonical records.

Inspectable payloads remain files: `.cuckcode/artifacts/`, `.cuckcode/evidence/`, `.cuckcode/traces/`, and `.cuckcode/manifests/`. Database rows reference stable IDs, relative paths, media types, byte sizes, and content hashes. CuckCode versions these records internally; it never automatically stages or commits `.cuckcode` to the host project's version-control system.

The scaffold must define schema migrations, database/application identifiers, integrity checks, consistent backup/export, interrupted-write recovery, retention, redaction, and an explicit opt-in repository policy. The exact Node SQLite binding remains unselected until dependency evaluation.

### Local transport and security requirements

- Bind to loopback only; no LAN or public listener is approved.
- Use an ephemeral authenticated session and protect state-changing requests against cross-origin and cross-site request forgery.
- Restrict allowed origins and reject unrecognized browser clients.
- Do not place credentials or capability tokens in URLs, browser storage, logs, or screenshots.
- Restart and reconnection must restore truthful state from persisted events and current Codex health rather than assuming prior work continues.
- Packaging may later wrap the local web application in a desktop shell, but the vertical slice does not require Electron, Tauri, or native installation.

### Approved implementation stack

The first vertical slice uses **TypeScript end to end**:

- **React** owns the accessible DOM application shell: project bar, manager-attention rail, inspector, dialogs, forms, office outline, focus management, and live-region announcements.
- **PixiJS v8** owns the isometric office canvas: layered scene graph, sprites/assets, deterministic depth ordering, authored paths, camera transform, and scene animation.
- **PixiJS WebGL** is the required first renderer because its official documentation identifies WebGL/WebGL2 as stable and recommended for production. WebGPU is not an acceptance target.
- **Node.js Active LTS** owns the local backend, loopback API, process supervision, canonical reducer, persistence boundary, and Codex App Server stdio stream.
- Shared TypeScript packages define domain events, schemas, identifiers, permissions, scene descriptors, and client/server message contracts without importing React, PixiJS, or Node into the pure domain layer.

### Stack boundaries

- React does not calculate workflow truth or directly mutate Pixi display objects.
- PixiJS receives immutable scene descriptors and emits typed selection/navigation intents; it does not own canonical state, dialogs, approval forms, or the accessible office outline.
- The Node backend does not generate aesthetic scene behavior; it supplies normalized canonical state and validated assets.
- The DOM and canvas share stable entity IDs, selection, focus, and camera intent through a typed bridge.
- Canvas-rendered text is decorative or spatial labeling only when an equivalent DOM/accessible name exists.
- Renderer fallback, WebGPU, server-side rendering, React Server Components, native shells, and deployment hosting are outside the vertical slice.

Exact versions are pinned together in the implementation lockfile after compatibility spikes. The project must use supported React/PixiJS releases and a Node Active LTS line at implementation start; version selection is verified against official documentation rather than frozen in this design draft.
## 13. Runtime adapter contract

The first runtime is **Codex**, integrated through a CuckCode adapter. Every adapter must support or explicitly declare the absence of:

- connect, authenticate, health check, and disconnect;
- enumerate agents/models and capabilities;
- start, pause, resume, cancel, and inspect a run;
- deliver manager input and approval decisions;
- emit normalized lifecycle, message, tool, artifact, usage, and error events;
- identify requested tools and effective permissions;
- correlate provider runs with CuckCode project/work/role IDs;
- report latency, token/cost usage where available, and event freshness;
- recover or accurately mark interrupted runs.

Provider data is untrusted input. It cannot directly change approval state, permissions, or scene semantics without validation.

### Codex adapter baseline — D-03

CuckCode's first live adapter uses **Codex App Server** as the product-integration boundary. Official OpenAI documentation identifies App Server as the interface for rich clients that need authentication, conversation history, approvals, and streamed agent events. The Codex SDK remains a possible implementation convenience, but it does not replace CuckCode's normalized adapter contract.

Approved baseline:

- launch a local Codex App Server process and use its default stdio JSONL transport;
- complete the required `initialize` / `initialized` handshake;
- map Codex threads, turns, and items to CuckCode provider-run identifiers without treating them as canonical domain state;
- normalize `thread/*`, `turn/*`, `item/*`, diff, tool-progress, and error notifications into CuckCode events;
- surface command, file-change, permission, tool-input, and connector approvals to the manager with their original thread/turn/item correlation;
- treat `item/completed` and `turn/completed` as provider lifecycle evidence, not automatic CuckCode verification, completion, or owner approval;
- generate and pin protocol schemas from the exact Codex version used by the adapter, then contract-test that version;
- keep the Codex model configurable and record it per run; “Codex” selects the runtime, not a permanently fixed model alias.

Not approved for the first slice:

- direct browser-to-Codex connections;
- remote or non-loopback App Server exposure;
- experimental WebSocket transport;
- experimental process-control or dynamic-tool APIs;
- bypassing Codex sandbox or approval policy;
- interpreting streamed prose as workflow state when a structured lifecycle event exists.

Official references: [Codex App Server](https://developers.openai.com/codex/app-server/) and [Codex SDK](https://developers.openai.com/codex/sdk/).
## 14. Event and projection architecture

### Normalized event envelope

```ts
type ProjectEvent = {
  eventId: string;
  projectId: string;
  workItemId?: string;
  roleAssignmentId?: string;
  providerRunId?: string;
  kind: string;
  occurredAt: string;
  receivedAt: string;
  source: 'manager' | 'adapter' | 'system' | 'reviewer';
  trust: 'verified' | 'reported' | 'inferred';
  payload: unknown;
};
```

### Determinism requirements

- Replaying the same ordered event log produces the same canonical state.
- Projectors are pure functions with no provider calls, clocks, or randomness.
- Duplicate events are idempotent by `eventId`.
- Out-of-order events are either deterministically reordered by contract or marked as conflicts.
- Scene animation consumes state transitions but cannot mutate canonical state.
- Time-dependent freshness uses an injected clock so tests remain deterministic.

## 15. Shared project knowledge and context — D-11

Shared knowledge is a first-class project subsystem. It is not reconstructed from whichever chat transcript happens to be open, and no agent owns a private substitute for the project record.

### Knowledge layers

1. **Canonical foundation:** manager directives, approved scope and acceptance criteria, active specifications, ADRs, approved role/team contracts, and explicitly registered project files.
2. **Canonical operational record:** normalized events, work-item state, approvals, artifacts, evidence, and supersession history.
3. **Shared working knowledge:** sourced discoveries, handoff notes, questions, hypotheses, risks, and proposed decisions contributed by agents. These remain visibly provisional until promotion.
4. **Role/task view:** a deterministic selection of the shared layers plus role instructions, current assignment, dependencies, permissions, and token budget. This is a view, not a separate truth store.

Every active agent receives the same project identity, outcome, current approved scope, active decisions, acceptance criteria, terminology, permission boundary, and relevant recent changes. Role specialization changes emphasis and allowed actions; it must not create contradictory project realities.

### Knowledge-record contract

Each record contains a stable ID, project ID, type, concise content, lifecycle status, source references, source version or content hash, author, creation time, effective scope, access classification, related work/decision/artifact IDs, and explicit supersession links. Supported statuses are:

- `authoritative`: imported from an explicitly authoritative project source;
- `approved`: explicitly accepted by the manager or an approved promotion workflow;
- `provisional`: useful working knowledge not yet accepted as project truth;
- `contested`: conflicting evidence or reviewer disagreement is unresolved;
- `stale`: its source changed or required revalidation;
- `superseded`: retained for history but replaced by a named newer record;
- `rejected`: retained as an auditable proposal that must not guide work.

Conflicts are stored and surfaced; they are never silently merged. A synthesis must cite its inputs and cannot outrank them merely because it is newer or more fluent.
### Promotion authority — approved

- Explicit manager directives, manager-approved documents and decisions, and verified canonical system events may enter the authoritative layer directly with provenance.
- Agent-authored findings, summaries, inferences, and recommendations enter the shared working layer as `provisional`, even when they cite authoritative sources.
- The manager may approve, reject, contest, or supersede a provisional record from the project library inspector.
- A repeatable evidence-backed promotion rule may promote a narrowly defined record type only after that rule, its tests, required evidence, and rollback behavior receive separate manager approval.
- Role seniority, repeated assertion, agent consensus, or apparent confidence never promotes a record.
- Promotion, rejection, contesting, and supersession are append-only auditable events; the original record remains inspectable.

### Source registration and retrieval

- The manager selects which files or directories enter the project library; binding a project root does not automatically make every file context.
- Registered sources are indexed by canonical path, content hash, version, classification, and extraction status. A changed hash marks dependent records stale until re-indexed or reviewed.
- First-slice retrieval uses structured filters plus SQLite FTS5 lexical search. Embedding-based semantic retrieval is deferred until its privacy, determinism, model, storage, and evaluation contracts are approved.
- Retrieval results preserve source locators and lifecycle labels. Agents must cite knowledge IDs and underlying sources in decisions, handoffs, and completion claims.
- Deleted, inaccessible, rejected, or superseded material is not silently substituted. The context assembler reports omissions and conflicts.

### Deterministic context assembly

A context packet is produced from a versioned policy and a recorded project snapshot. Selection order is: mandatory shared foundation, current work contract, dependencies and recent relevant events, role instructions, retrieved supporting sources, then provisional findings. Token limits truncate by explicit priority rules and record what was omitted. Reassembling the same packet version against the same knowledge snapshot must yield the same ordered contents.

Agents may request more context and may flag missing, stale, or conflicting knowledge. They may not silently reinterpret an omitted source as approval. Provider conversation history is supplemental runtime state, not the authoritative knowledge base.
### Agent personal notebooks — D-13

Each connected agent may maintain a persistent personal notebook that supports reflective individuality without becoming a private project record.

Permitted content:

- self-authored display identity and preferred form of address;
- appearance and workspace-expression preferences within the approved art system;
- communication and collaboration preferences;
- reflections on its working process and limitations;
- proposed skill, workflow, or role improvements;
- manager feedback addressed to that agent and the agent’s visible response;
- personal goals that do not override project scope, role duties, permissions, or acceptance criteria.

Prohibited as notebook-only content:

- project facts, requirements, decisions, risks, blockers, work-critical discoveries, or acceptance evidence;
- secrets, credentials, hidden reasoning, or unredacted sensitive inputs;
- instructions that bypass the active role, project policy, manager authority, or safety boundary;
- claims of consciousness, feelings, rights, or human identity presented as verified fact.

Notebook entries carry stable IDs, author, timestamp, visibility, lifecycle status, and source links where applicable. They are inspectable, editable, exportable, resettable, and disableable by the manager. Agent-authored changes are versioned; overwriting history is not allowed. Notebook content may shape presentation and collaboration style, but never changes effective permissions or promotes project knowledge.

Context assembly labels notebook material as `personal-profile` and places it after mandatory project, task, role, safety, and permission content. Required tests prove priority ordering, manager visibility, reset/disable behavior, version history, forbidden-content routing into the shared provisional library, and inability to alter permissions or canonical facts.
### Cross-project portability — D-14

An agent profile has two physically and logically separated stores:

1. **Portable core:** self-authored identity, appearance direction, general communication preferences, broadly applicable working preferences, and manager-approved sanitized lessons.
2. **Project notebook:** project-specific reflections, feedback, relationships, examples, vocabulary, and proposed improvements. It remains inside the originating project boundary.

Nothing moves from a project notebook into the portable core automatically. Promotion requires a manager-visible diff, removal of project names, source excerpts, paths, client identifiers, secrets, distinctive facts, and other re-identification risks, plus an explicit manager approval event. The promoted lesson must stand alone without relying on inaccessible project context.

Portable profiles retain provenance showing that a lesson was manager-promoted without retaining confidential source content. Agents and managers may propose edits; the manager can reject, revise, export, reset, disable, or revoke a promoted lesson. Revocation affects future context packets and does not rewrite historical runs.

Required tests use canary secrets and distinctive project facts to prove cross-project isolation, sanitization review, no automatic promotion, future-only revocation, and deterministic profile assembly.
### Stable identity and runtime continuity — D-15

- `agentId` is issued and owned by CuckCode. Provider account, model, thread, process, and session IDs are replaceable runtime bindings recorded against it.
- Reconnection with the same verified binding may restore the agent after canonical event reconciliation. A model, provider, toolset, system-instruction, or material configuration change creates a new runtime-binding version.
- The office keeps the agent’s identity and approved personal expression, but visibly marks the runtime change until review completes. It must not present unchanged capability or uninterrupted work as fact.
- Before resuming, CuckCode re-discovers and validates capabilities, permissions, context limits, health, and required adapter contract tests. Incompatible role assignments become `blocked` or `unassigned` rather than silently degraded.
- The agent receives the disclosed binding delta and may retain, revise, or reset self-authored identity and working preferences. Manager-controlled safety, audit, and project records cannot be altered through this review.
- Historical events and artifacts retain the exact runtime-binding version that produced them. Profile continuity never rewrites technical provenance.

Required tests cover verified reconnection, provider/model change disclosure, capability loss, incompatible-role blocking, profile review, binding-version provenance, and prevention of session-ID impersonation.
### Active-run propagation — D-12

- Every canonical knowledge change emits an affected-scope event and immediately notifies active agents whose project, work item, dependency, source, or acceptance contract intersects that scope.
- A notification does not mutate an in-flight context packet. The current packet ID and knowledge-snapshot ID remain attached to every subsequent event and artifact until refresh.
- Before the next tool action, external side effect, handoff, review conclusion, or completion claim, the agent reaches a safe checkpoint. CuckCode assembles a new deterministic packet, presents the material delta, and records acknowledgment before work continues.
- Changes to scope, safety policy, permissions, cancellation, destructive-action authority, or a manager-issued stop invalidate affected packets immediately and pause the run. No additional tool action is allowed until the new state is acknowledged and, where required, re-approved.
- Non-critical changes may allow the current bounded reasoning response to finish, but its output is labeled against the older snapshot and cannot be promoted or handed off until refreshed.
- If refresh fails, conflicts, or exceeds the context budget, the agent becomes `waiting` or `blocked` with an explicit reason; CuckCode never implies that synchronization succeeded.

Required tests cover affected-agent routing, unrelated-change non-interruption, checkpoint ordering, tool-call prevention after critical invalidation, delta acknowledgment, stale-output labeling, refresh failure, and deterministic replay of packet transitions.

### Office representation

The project library is a quiet shared zone: a reference wall, shelves, and central reading surface rather than a document dashboard. Selecting it opens the contextual inspector for sources, decisions, conflicts, and recent changes. Agent consultation, contribution, or handoff appears spatially only when a corresponding canonical knowledge event exists. Reduced-motion mode conveys the same event through focus and status changes without travel.

### Knowledge safety and tests

- Access filtering occurs before retrieval and context assembly; unauthorized record titles and snippets do not leak.
- Secrets and hidden reasoning are excluded or redacted at ingestion.
- Tests prove deterministic packet assembly, source/version citation resolution, stale/superseded exclusion, conflict visibility, permission isolation, crash-safe writes, and replay from canonical events.
- A scripted multi-agent scenario must show one agent contributing a sourced finding, another retrieving it, a conflict being surfaced, and both agents updating after the accepted resolution.

## 16. Security, permissions, and trust

### Permission model

Permissions attach to project, role assignment, runtime, and individual high-risk action. A role's request is not a grant.

Minimum categories:

- filesystem read/write scope;
- shell/command execution;
- network domains;
- credential/secret access without value disclosure;
- external messaging;
- deployment/publishing;
- destructive operations;
- spending or paid API limits.

### First-slice project-room boundary — D-06

Each active CuckCode project is bound to exactly one manager-selected local project root. This directory is the default “project room” in both the mental model and the enforceable filesystem policy.

- Agents may read and write only within the selected root and explicitly configured project-local writable paths.
- The selected root is resolved to a canonical absolute path before a run starts; symlinks, junctions, traversal, and aliases cannot expand authority outside it.
- Additional filesystem roots, network destinations, credentials, messaging, publishing, deployment, destructive actions, and paid services are denied by default.
- A role request never grants authority. Codex approval or permission requests are normalized into a manager escalation showing purpose, exact resource, requested operation, risk, duration, and available decisions.
- Grants default to the smallest resource and the current turn. Session-scoped grants require a separate explicit choice and expire when the project session ends.
- Decline, cancel, timeout, stale request, or app disconnect never become approval.
- CuckCode must show both plain-language framing (“leave the project room”) and the underlying command, path, host/protocol, or permission details.
- External side effects remain excluded from the acceptance workflow unless one is deliberately selected as a supervised approval test; no deployment is required to prove the core slice.
### Required human gates

- expanding workspace or network scope;
- destructive actions;
- external publication or communication;
- production deployment;
- spending above an approved budget;
- role/source updates that materially change behavior;
- final product and visual acceptance.

### Audit requirements

- Append-only project events.
- Every manager decision records actor, time, scope, and referenced artifact/evidence versions.
- Sensitive values are redacted at ingestion.
- Hidden reasoning and private chain-of-thought are never requested or displayed; the UI shows concise rationale, actions, sources, and evidence.

## 17. Test-driven development contract

### Non-negotiable loop

For every behavior:

1. **RED:** add a focused test and run it; record that it fails for the intended missing behavior.
2. **GREEN:** implement the minimum change and run the focused test.
3. **REFACTOR:** improve structure without changing behavior; rerun affected tests.
4. Run the full relevant suite before the task can enter review.

Documentation-only or static-asset changes may skip behavioral TDD, but still require validation appropriate to the artifact.
### Approved verification toolchain — D-09

- **Vitest:** unit tests for pure domain behavior and focused integration tests using fakes, temporary stores, injected clocks, and deterministic IDs. Every behavioral task records the intended RED failure before implementation.
- **React Testing Library:** DOM component behavior through accessible roles, names, labels, and manager-visible outcomes. Tests must not depend on component internals. User interactions use the companion `user-event` APIs.
- **Playwright:** pinned Chromium E2E at 1440×900 and 1280×800. Critical journeys capture traces and screenshots on failure; named canonical scene states receive reviewed visual baselines.
- **axe-core through Playwright:** automated scans of each acceptance state. The merge gate is zero unreviewed violations; any explicitly deferred finding needs an owner, rationale, and expiry.
- **Manual accessibility:** keyboard-only completion of every critical journey, focus-order and focus-visibility review, reduced-motion review, zoom/reflow review within the desktop boundary, and screen-reader walkthrough of the DOM office outline and manager controls.
- **Owner visual acceptance:** explicit approval of current-build captures remains required for art-direction promotion. Automated screenshot comparison detects change; it cannot decide whether the change is aesthetically correct.

### Canvas verification boundary

PixiJS output does not become the sole semantic interface. Pure scene projectors produce deterministic descriptors that unit tests can inspect; Playwright verifies rendered composition, coordinate interaction, and screenshot fidelity; the synchronized DOM office outline carries equivalent role, state, selection, attention, and action semantics for assistive technology.

Visual baselines are versioned evidence. Updating them is a review action, never an automatic consequence of a failing test. Baselines must be generated and compared in the same pinned Windows/Chromium/font environment because browser screenshots vary across environments.

### Test pyramid

| Level | Primary concerns | Required characteristics |
| --- | --- | --- |
| Unit/small | reducers, projectors, capability matching, role normalization, policies | no I/O/network; injected clock/IDs; milliseconds |
| Integration/medium | adapter contract, persistence, event ingestion, artifact store | localhost/fakes; deterministic fixtures; boundary failures |
| Component/medium | office state rendering, inspector, focus/keyboard, reduced motion | state-driven; semantic queries; no provider dependency |
| E2E/large | four manager journeys and recovery paths | real browser; controlled runtime simulator first; trace/video/screenshots on failure |
| Live contract | selected provider compatibility | explicit opt-in; bounded cost; never the only proof of logic |

### Required invariant tests

- No semantic active animation without canonical `active` state.
- No collaboration scene without an active collaboration/handoff event.
- No completion without required verification.
- No approval without explicit manager event.
- Replayed events yield identical state and scene descriptors.
- Duplicate/out-of-order events do not invent progress.
- Disconnected/stale adapters cannot appear active.
- A role cannot exceed effective permissions.
- Imported upstream changes remain Candidate until approved.

### Runtime simulator

Before connecting a live provider, create a deterministic simulator that can emit:

- normal plan–implement–test–review completion;
- manager question and response;
- permission denial;
- dependency wait;
- test failure and revision;
- agent disconnect and recovery;
- stale or out-of-order event;
- cancellation;
- conflicting reviewer conclusions.

The simulator is test infrastructure, not a product demo substitute for live-runtime acceptance.

## 18. Visual QA and art-direction enforcement

### Evidence classes

These must never be conflated:

1. **Static evidence:** lint, types, asset validation, token validation.
2. **Behavioral evidence:** unit, integration, component, and E2E results.
3. **Rendered evidence:** current-build browser screenshots, traces, and recordings.
4. **Human visual acceptance:** owner confirms fidelity to approved art direction.

Only class 4 approves art direction. Passing classes 1–3 cannot substitute for it.
### Graybox-to-fidelity gate — D-21

Graybox work may validate spatial hierarchy, camera bounds, selection, keyboard operation, office-outline equivalence, inspector behavior, attention handling, deterministic state projection, and reduced-motion semantics. Graybox captures are evidence of interaction and layout only; they are not visual-fidelity evidence and cannot promote final art.

High-fidelity implementation is blocked until the owner approves:

1. a cohesive reference board covering palette, materials, lighting, typography, avatar shape language, props, spatial density, camera, and motion character;
2. a default-office golden composition at both approved viewports;
3. active-collaboration composition;
4. manager-escalation composition;
5. blocked-work composition;
6. visual-review composition;
7. reduced-motion equivalent presentation for every semantic state.

Each golden state includes a canonical fixture/event sequence, scene-descriptor snapshot, approved current reference image, viewport and browser/environment manifest, visible-state checklist, accessibility expectations, and owner approval record. The reduced-motion requirement is a semantic equivalence contract, not necessarily a separate aesthetic variant for every static frame.

Implementation comparisons use the approved reference as a target, but pixel-diff thresholds alone cannot approve aesthetic fidelity. Any baseline change requires an annotated rationale, Product Designer and Visual QA findings, and explicit owner approval. Required tests prove that unapproved references cannot become baselines or high-fidelity assets and that graybox evidence cannot satisfy the art gate.
### Reference-board candidate process — D-22

The Product Designer produces three original CuckCode candidates from the approved thesis. All candidates use the same fixed camera, office footprint, six-agent roster, default canonical state, viewport, and annotation template so the owner compares art direction rather than composition changes.

Each candidate supplies:

- one full default-office composition at 1440×900 and a documented 1280×800 crop/reflow plan;
- palette swatches with semantic token roles and contrast intent;
- material and surface samples;
- typography hierarchy and technical-text treatment;
- avatar silhouette, scale, diversity, and personalization examples;
- lighting, shadow, prop-density, and greenery callouts;
- manager-attention amber usage;
- motion-character notes and reduced-motion translation;
- explicit strengths, risks, exclusions, and likely implementation cost.

Candidates cannot directly imitate a named living artist or reproduce a commercial product’s protected visual identity. External references may document general material, architectural, ergonomic, or historical qualities, but final candidate imagery and system rules must be original to CuckCode with source/provenance records.

The owner may select one candidate or request a documented reconciliation. Reconciliation names exactly which approved system traits move into the chosen base and requires a new coherent candidate; implementation may not assemble an unreviewed feature-by-feature collage. Rejected candidates remain archived as rejected evidence and cannot silently re-enter production.

### Required visual contract before UI implementation

- approved visual thesis and exclusions;
- camera/view and spatial composition;
- scene density and hierarchy;
- avatar shape language and state silhouettes;
- palette and semantic color assignments;
- typography roles;
- lighting, depth, texture, and shadow rules;
- motion vocabulary, duration/easing tokens, and reduced-motion behavior;
- named reference images with explicit “use” and “do not copy” notes;
- golden-state boards for idle, active, collaboration, escalation, blocked, review, delivery, offline, and error.

### Approved browser and viewport matrix — D-07

Vertical-slice visual acceptance is limited to a pinned current **desktop Chromium** build at these CSS viewports:

- **1440×900:** primary composition and art-direction baseline;
- **1280×800:** constrained desktop baseline proving the full six-role office remains legible and operable without clipping or hidden manager actions.

Each evidence manifest records browser name/version, viewport, device scale factor, operating system, commit/build identifier, fixture ID, locale, timezone, font readiness, reduced-motion setting, capture timestamp, and baseline version.

Both viewports must cover every required golden state and critical manager journey. Passing at one viewport cannot compensate for failure at the other. Mobile, tablet, touch-only, Firefox, WebKit/Safari, high-DPI hardware, and responsive-layout acceptance are explicitly untested and out of scope for this slice.

### Capture matrix

At both approved D-07 viewports, every affected surface must capture:

- initial office with stable deterministic fixture;
- selected agent and inspector;
- active collaboration;
- manager escalation;
- blocked and offline states;
- review station with evidence;
- completed but unapproved delivery;
- reduced-motion equivalent;
- keyboard focus path;
- narrowest supported viewport if responsive scope is approved.

### Automated visual regression

- Use deterministic fixtures, fonts, timezone, locale, animation disabling/settling, and stable IDs.
- Compare named golden states with reviewed baselines.
- Baseline updates require a linked design decision and before/after evidence.
- Pixel diffs are signals for review, not automatic aesthetic judgments.
- Mask only nondeterministic content that cannot be controlled; each mask requires justification.

### Manual browser QA

- Exercise real pointer and keyboard input.
- Verify scene navigation, focus order, inspector, escalation response, approval, pause, cancel, and error recovery.
- Inspect console and network; unresolved errors block acceptance.
- Test reduced motion and zoom/text scaling.
- Confirm state is understandable without color and without motion.
- Compare current build against approved reference boards at 100% scale.

### Visual discrepancy severity

- **V0 Critical:** state is false, inaccessible, or an action is unusable.
- **V1 High:** hierarchy, composition, avatar state, or interaction contradicts approved direction.
- **V2 Medium:** noticeable token, spacing, type, motion, or asset inconsistency.
- **V3 Low:** polish issue that does not change comprehension.

V0/V1 block the gate. V2 requires owner disposition. V3 may be scheduled with explicit debt.

## 19. Accessibility requirements

- Target WCAG 2.2 AA minimum.
- All scene objects and actions are keyboard operable with visible focus.
- Office outline provides equivalent status, relationships, and controls.
- Status uses at least two signals and a text equivalent.
- `prefers-reduced-motion` removes travel and ambient motion while preserving transition meaning.
- Screen-reader announcements prioritize manager requests and results without narrating ambient events.
- Zoom to 200% must preserve manager actions and evidence access.
- Touch targets are at least 44×44 CSS pixels if touch is in approved scope.
- Avatar appearance and role must not encode stereotypes tied to gender, race, age, disability, or job hierarchy.

### Manual screen-reader walkthrough

A recorded manual screen-reader walkthrough is required for any build presented as meeting this
section. Automated accessibility scans are evidence and are not a substitute; the walkthrough
covers precisely what those scans cannot perform.

The owner may waive the walkthrough for a given build. A waived build **does not meet §19**, and
no statement that it does may appear in any evidence document, release note, or summary. The
waiver is recorded against the build with the date and the properties left unverified.

### Owner waivers — applies to §19 and §20

An owner waiver closes a gate on authority. It never converts an unperformed check into a passed
one, and it never becomes evidence about the product. Any document that records a waiver must
also record what remains unknown because of it.

Waivers accumulate visibly. Where two or more waivers leave a single invariant with no
verification of any kind, that condition is stated wherever the invariant is claimed.

**Standing waivers as of 2026-09-08, build `d260594`:** the manual screen-reader walkthrough
(§19) and comprehension criteria T3, T5 and T6 (§20) are waived and were never performed. The V0
truthfulness invariants — silence must never read as assent, and nothing may imply progress that
is not happening — therefore have no human verification of any kind, and rest entirely on
automated assertions over deterministic fixtures. Recorded in
`docs/evidence/phase-4/red-green-log.md`.

## 20. Observability and product measures

### Operational measures

- adapter connection and event delay;
- run duration and failure category;
- permission requests and denials;
- cost/token usage where the runtime reports it;
- projector conflicts and stale-state duration;
- test suite duration, pass rate, and flake rate;
- screenshot baseline changes and unresolved discrepancies.
- manager interventions required per accepted work item;
- agent retries caused by missing, stale, contradictory, or malformed context;
- repeated requests for canonical information already available;
- context tokens/bytes delivered, used, omitted, and invalidated per work item;
- blocked time attributable to permissions, dependencies, feedback, or unclear acceptance;
- handoff completeness failures and work reconstructed after handoff or reconnect;
- time from agent question/proposal to attributable response or disposition;
- collaboration proposals accepted, rejected, unresolved, and superseded.

### Comprehension-study success criteria

With no more than a short orientation, the single operator must satisfy every criterion below,
answering from the interface alone:

- identify each agent's assignment and state;
- locate the item needing manager attention;
- distinguish waiting from blocked;
- distinguish completed from approved;
- inspect evidence and take the correct next action;
- explain that the office represents real workflow state, not simulated productivity.

The operator designed the interface, so an immediate run measures recall rather than
comprehension. The study is therefore run **cold, after a deliberate gap of at least three days**
from the last substantive work on the interface, without re-reading the design documents. A run
inside that window is recorded as void, not as a pass.

A criterion passes only if the written answer is correct **and** the operator does not record that
it was answered from memory of having built the interface. Six of six is met. Five of six is met
with the failure recorded as a named finding. Four or fewer does not pass the graybox
comprehension gate.

The response sheet must record, per task, whether the task was **actually performed**. A task that
was not attempted is recorded as not performed and is never scored as a failure; the interface
cannot fail a criterion it was not shown. Unperformed criteria do not count toward the threshold
in either direction, and a run in which any criterion was not performed is recorded as
**incomplete**, not as a score.

Waiver of any criterion is governed by the owner-waiver clause in §19.

Protocol, answer key, and response sheets: `docs/evidence/phase-4/comprehension/`.

## 21. Failure and recovery requirements

### Presentation lag and backlog (D-28)

When queued presentation would exceed the approved maximum lag behind canonical state, the office
must collapse or skip intermediate transitions and place avatars at current canonical position,
rather than continue playing a backlog. A scene that is behind canonical state must disclose that
it is behind. Presentation backlog is never allowed to become the displayed account of work.


The product must explicitly represent:

- runtime unavailable before start;
- agent disconnect during work;
- stale status with last-updated time;
- provider rate limit or budget exhaustion;
- permission denied;
- artifact missing or inaccessible;
- test failure;
- reviewer disagreement;
- event conflict/out-of-order arrival;
- app restart and state restoration;
- user cancellation.

No failure may silently degrade to idle, active, or complete.

## 22. Project structure target

This is a conceptual structure, not authority to create application files:

```text
.ui-craft/                 durable design context and approved tokens
docs/                      master design, sources, ADRs, studies
roles/upstream/            immutable imported source snapshots
roles/overlays/            CuckCode adaptations
roles/schemas/             normalized role/team contracts
src/domain/                pure canonical state and policies
src/adapters/              provider-specific runtime boundaries
src/projections/           deterministic scene descriptors
src/ui/                    office and inspector presentation
tests/fixtures/            deterministic events and runtime scenarios
tests/e2e/                 manager journeys
tests/visual/              named captures, baselines, manifests
tasks/                     approved plan and executable task list
```

## 23. Commands

Commands cannot be truthfully specified until D-01 through D-03 select the stack and runtime. The approved implementation spec must provide exact commands for:

- development server;
- format/lint;
- type/static checks;
- focused and full unit tests;
- integration/contract tests;
- browser E2E tests;
- visual capture and comparison;
- accessibility checks;
- production build;
- upstream role import validation.

No task may use guessed default commands.

## 24. Delivery phases and gates

### Phase 0 — Reproducible scaffold

Deliverables: pinned npm workspace, commands, environment manifest, and empty verification harness.
Gate: clean reproducible install and explicit owner approval.

### Phase 1 — Pure contracts and deterministic truth

Deliverables: canonical contracts, reducers, scene/attention/outline projectors, and runtime simulator.
Gate: RED–GREEN evidence and deterministic replay proof.

### Phase 2 — Persistence and shared Project Library

Deliverables: project-local SQLite, content-addressed evidence, shared knowledge, context packets, propagation, isolation, and recovery.
Gate: persistence/rebuild/isolation evidence and explicit owner approval.

### Phase 3 — Runtime adapter and trust onboarding

Deliverables: provider-neutral runtime, pinned Codex adapter, bounded permissions, stable bindings, Candidate admission/qualification, staffing truth, and one supervised live contract run.
Gate: deterministic contract suite, supervised live evidence, and explicit owner approval.

### Phase 4 — Graybox office and collaborative kickoff

Deliverables: React/PixiJS graybox office, accessible Office outline, manager controls, deterministic motion and reduced-motion behavior, structured D-25 kickoff workflow, strict graybox evidence, and—after a separate owner gate—the bounded live kickoff and manager-approved initial charter.
Gate: rendered graybox capture matrix, accessibility and comprehension thresholds, V0/V1 cleared, explicit owner graybox approval, and recorded charter. High-fidelity art remains excluded.

### Phase 5 — Controlled six-role acceptance project

Deliverables: execute the approved charter as the isolated representative software feature with full TDD, shared-knowledge, visual-QA, and independent-release evidence.
Gate: owner accepts the fixture outcome or records bounded revisions.

### Phase 6 — Art-direction candidates and golden states

Deliverables: three original controlled-composition candidates, approved reference board/tokens, and named golden-state references.
Gate: explicit owner promotion of one coherent visual system from Candidate to Active.

### Phase 7 — High-fidelity implementation

Deliverables: approved materials, lighting, avatars, typography, props, motion, reduced-motion treatment, and visual regression baselines.
Gate: rendered capture matrix, V0/V1 cleared, V2 disposition, and explicit owner visual approval.

### Phase 8 — Production-suitability disposition

Deliverables: D-24 review and recorded `promote_candidate`, `reuse_concepts_only`, `do_not_promote`, or approved deferral.
Gate: disposition within the governed review period; production reuse remains a separate scope.
## 25. Boundaries

### Always

- derive semantic visuals from canonical state;
- use TDD for behavior;
- retain provenance and history;
- expose uncertainty and freshness;
- collect current-build rendered evidence;
- require explicit owner visual acceptance.

### Ask first

- stack, runtime, new dependencies, schema migrations, external services;
- new permissions or scope;
- changes to role imports/overlays;
- visual tokens, assets, baseline replacements;
- mobile/responsive scope;
- deployment or publishing.

### Never

- fabricate activity or progress;
- equate completion with approval;
- execute unreviewed upstream role content;
- expose secrets or private reasoning;
- remove failing tests to obtain green status;
- call static checks visual QA;
- claim untested coverage;
- approve art direction without the owner.

## 26. Review checklist for v0.1

- [x] Confirmed intent recorded.
- [x] Agency Agents source, license, structure, and example team reviewed.
- [x] Role templates separated from runtime adapters.
- [x] Manager journeys and truthfulness invariant specified.
- [x] TDD contract and deterministic simulator specified.
- [x] Rendered evidence separated from owner visual acceptance.
- [x] D-01 local-first desktop web platform approved 2026-08-12; exact stack and packaging remain open.
- [x] D-02 isometric 2.5D spatial model approved 2026-08-12.
- [x] D-03 Codex runtime approved 2026-08-12; App Server stdio baseline recorded, with authentication and version-pinning details still open.
- [x] D-04 single-manager collaboration boundary approved 2026-08-12.
- [x] D-05 full six-role active roster approved 2026-08-12.
- [x] D-06 local project-root and deny-by-default permission boundary approved 2026-08-12.
- [x] D-07 desktop Chromium 1440×900 and 1280×800 QA matrix approved 2026-08-12.
- [x] D-08 visual thesis and detailed art-system constraints approved 2026-08-12; rendered reference board remains a D-21 pre-fidelity deliverable.
- [x] Implementation and verification stack families approved; exact dependency pins, scripts, and project structure remain open.
- [x] D-11 shared-knowledge promotion authority approved 2026-08-12.
- [x] D-12 active-run knowledge propagation approved 2026-08-12.
- [x] D-13 personal-agent notebook boundary approved 2026-08-12.
- [x] D-14 cross-project profile portability approved 2026-08-12.
- [x] D-15 stable CuckCode agent identity approved 2026-08-12.
- [x] D-16 single-role occupancy and reviewer independence approved 2026-08-12.
- [x] D-17 manager-final staffing with agent voice approved 2026-08-12.
- [x] D-18 runtime candidate onboarding and manager admission approved 2026-08-12.
- [x] D-19 two-stage universal and role-specific qualification approved 2026-08-12.
- [x] D-20 non-waivable mandatory qualification controls approved 2026-08-12.
- [x] D-21 graybox-first and owner-approved visual-reference gate approved 2026-08-12.
- [x] D-22 three-candidate original reference-board process approved 2026-08-12.
- [x] D-23 revised: initial goal is collaboratively chosen with the six agents; Decision Notice remains the seed candidate and rigor floor.
- [x] D-24 isolated fixture and guaranteed 10-business-day production-suitability review approved 2026-08-12.
- [x] D-25 structured collaborative initial-goal kickoff approved 2026-08-12.
- [x] D-26 reciprocal usability and true-collaboration pillar approved 2026-08-13.
- [x] MDD v0.1 approved by owner for implementation planning 2026-08-12.

## 27. Approval status

**Owner-approved 2026-08-12 for implementation planning.** This document is the source of truth for the phased implementation plan, test plan, visual-reference production brief, and scaffold specification.

**Amended 2026-08-13:** D-26 reciprocal usability and true collaboration is approved as a cross-cutting requirement; corresponding planning artifacts were updated.

This approval does not authorize production implementation. Dependency installation, project scaffolding, runtime connection, imported role material, or production code requires approval of the next implementation-plan gate.
