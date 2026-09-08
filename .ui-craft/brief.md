# CuckCode design brief

Status: Draft v0.1 — confirmed product intent, spatial model, and visual thesis; detailed art system pending owner discovery

## 1. Product identity

CuckCode makes an office scene the primary surface for directing a real multi-agent workflow. The
user is the manager. Connected agents occupy role templates and appear as employees whose
location, posture, actions, conversations, and requests make otherwise technical work
understandable.

The scene is a control surface, not a view of one. Under design pressure, reduce scene fidelity,
zone count, or role count before reducing operability, truthfulness, or reciprocity — those three
are the product, and the office metaphor is not (MDD §2).

This is an operational interface, not a management game and not a decorative visualization over a conventional dashboard.

## 2. Audience

Primary: non-technical managers who can define outcomes and judge deliverables but do not want to operate an agent framework.

Secondary: technical operators who need access to the underlying events, artifacts, tests, costs, permissions, and runtime evidence.

## 3. Experience intent

Within ten seconds, a manager should be able to tell:

- who is assigned;
- what each person is doing;
- who is collaborating;
- who is waiting or blocked;
- what needs the manager's attention;
- what has been delivered and what evidence supports it.

The desired feeling is calm command of a small working studio, not surveillance, urgency theater, or dashboard overload.

## 4. Product principles

1. **Truth before theater.** Meaningful visuals are projections of inspectable workflow state.
2. **Office first.** Start from the work scene and reveal technical detail on demand.
3. **Management language first.** Use outcomes, assignments, questions, approvals, evidence, and delivery before framework terminology.
4. **Progressive disclosure.** The scene must be readable without hiding the technical evidence needed for trust.
5. **Calm attention.** Escalations are noticeable without turning the office into an alarm board.
6. **Agents are not employees.** The metaphor may clarify work, but copy and consent must not falsely imply human judgment, accountability, consciousness, or labor status.
7. **Accessible equivalence.** Every spatial or animated signal has a keyboard-operable, screen-reader-readable, reduced-motion equivalent.

## 5. Initial surface

The first proof is a desktop-first office scene for one software-development project. A manager assigns an outcome to a small specialist team, observes planning and execution, answers a real escalation, reviews test and visual evidence, and approves or redirects the deliverable.

Visual acceptance is desktop-only: a pinned current Chromium build at 1440×900 and 1280×800. Mobile, tablet, touch-only, and cross-browser acceptance are not claimed.

The first slice is a local-first desktop web application. The Chromium client renders the office and collects manager intent; a trusted loopback-only backend owns Codex App Server, filesystem policy, canonical state, persistence, and secrets.

## 6. Learned constraints

- The interface must be simpler and more intuitive than a conventional dashboard for the target audience.
- The scene should resemble a real office work environment with the user in a manager role and agents represented as employees.
- Meaningful avatar behavior must correspond to real, inspectable state.
- Restrained ambient behavior is allowed only when it cannot be mistaken for progress, collaboration, urgency, or availability.
- Agency Agents supplies team structure, roles, and skills; CuckCode imports these as templates into which users plug connected agents.
- The first proof is a focused vertical slice with one runtime and one software-development workflow.
- Development must be test-driven and visual QA must enforce the approved art direction.
- The office uses a bounded isometric 2.5D scene, not a top-down plan view or freely navigable 3D environment.
- The camera uses one fixed three-quarter isometric orientation with no rotation; only bounded pan and zoom are allowed, and a reset action restores the canonical default composition.
- The visual thesis is a grounded contemporary studio with subtle miniature-like warmth: credible and professional, tactile and approachable, but not toy-like or game-like.
- The material language is warm and matte: light wood, off-white plaster, charcoal metal, muted textiles, and restrained greenery.
- Warm amber is the single primary accent and is reserved for manager attention, focus, and primary action—not generic agent activity, role identity, or severity.
- Avatars use simplified adult human proportions and clear silhouettes: neither chibi nor photorealistic, inclusive without occupational stereotypes.
- Agents author reflective identity briefs covering display name, form of address, appearance direction, accessory, desk object, rationale, and one novel custom-detail proposal.
- Novel details remain Candidate until safety, accessibility, silhouette, art-direction, asset, and manager approval gates pass; personalization never overrides role or status presentation.
- Typography pairs a warm humanist sans-serif for management language with a restrained monospace only for code, commands, paths, identifiers, timestamps, logs, diffs, and technical evidence.
- Motion is restrained and state-explanatory: semantic avatar travel only for real transitions, sparse non-semantic ambient movement, immediate canonical state, and reduced-motion equivalents without travel or parallax.
- Lighting is one fixed soft-daylight rig with warm practical lamps and restrained contact shadows; no day/night cycle or global lighting change communicates workflow state.
- The office occupies nearly the full application surface. Persistent chrome is limited to a slim project bar, collapsible manager-attention rail, and on-demand contextual inspector.
- Persistent card grids, metric panels, dashboard widgets, and dense status sidebars are excluded from the vertical slice.

## 7. Numeric visual discovery required

The visual thesis, fixed camera orientation, material direction, warm-amber role, typography roles, and restrained-motion principles are approved. The following exact measurements and asset-system decisions remain unapproved and must be resolved through graybox observation or the later reference-board gate:

- exact isometric projection ratio, elevation angle, discrete zoom limits, and cutaway measurements; the fixed orientation, bounded pan/zoom, no rotation, and canonical reset composition are approved;
- contemporary-studio references, material language, and explicit exclusions;
- exact soft-daylight direction, exposure, practical-lamp values, shadow settings, ambient occlusion, and color-management configuration;
- exact warm-amber and neutral OKLCH values, semantic status colors, contrast pairs, and rendered material samples;
- exact humanist sans and monospace families, licensing, fallback stacks, type scale, and information-density measurements;
- exact avatar proportions, silhouette tests, inclusive modular library, identity-brief schema, Candidate asset workflow, and personalization comprehension tests;
- exact travel speeds, path curves, easing tokens, concurrency priority, animation checkpoints, and reduced-motion rendered states.

