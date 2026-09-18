# CuckCode

CuckCode is a visual multi-agent orchestration product in which a familiar office environment is
the primary surface through which a non-technical manager directs real agent work: assigning
outcomes, answering escalations, inspecting evidence, and approving or redirecting deliverables
without learning an agent framework.

Rendering agents as office workers is the visible part and the least load-bearing. The claim is
that the office is **operable** rather than observational, **truthful** — every meaningful visual
behavior backed by an inspectable canonical event, with simulated or fallback animation treated as
a defect rather than a shortcut — and **reciprocal**, with human and agent interfaces as equal
projections of the same canonical state. See MDD §2.

## Current status

**Phase 4 is complete, Phase 6 is complete, and Phase 5 is authorized. The owner has now marked C-17
met after the bounded Decision Notice NVDA walkthrough; the walkthrough findings remain open and the
independent release-review verdict has not been refreshed.**

The bounded live D-25 kickoff ran its full thirteen turns on 2026-09-14: six promoted roles, six
distinct bindings, no external effect. The owner approved the charter it produced, with its ten
evidence gaps as blocking conditions. Phase 6 promoted `reconciliation-b-clarity` to the Active
visual system.

Carried forward unresolved: MDD section 20 and the walkthrough's V0/V1 findings and environment
omissions remain open. The C-17 owner disposition and record are
`docs/evidence/phase-5/c-17-owner-acceptance.json` and
`docs/evidence/phase-5/screen-reader-walkthrough-2026-09-18.md`. Three Phase 6 provenance gaps also
remain open.

**Phase 7 high-fidelity art, deployment, external effects, and any production reuse of fixture code
remain unauthorized.** Phase 5 overall Task 10 owner acceptance remains separate from the C-17
disposition and is still owner-run. See `AGENTS.md`,
`tasks/phase-5-todo.md`, and `docs/evidence/phase-5/approved-charter-v1.md` before changing behavior.

## Toolchain

Use the exact engine family declared in `package.json` before running project verification:

- Node.js `>=24.18.0 <25`
- npm `>=11.16.0 <12`

Run `npm run check:toolchain` first when starting work. `npm run verify` runs this preflight before the repository test gates so unsupported local Node/npm versions fail clearly instead of surfacing as lower-level test-runner or native-binding errors.

## Source of truth

- [Master design document](docs/master-design-document-v0.1.md)
- [External-source register](docs/sources.md)
- [Product and design brief](.ui-craft/brief.md)
- [Design-token decision record](.ui-craft/tokens.md)
- [Project execution rules](AGENTS.md)

## Working principle

The office is a truthful projection of inspectable workflow state. It must never use animation, avatar behavior, or spatial placement to imply work, progress, collaboration, urgency, or availability that is not supported by real events.
