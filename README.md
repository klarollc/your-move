# CuckCode

CuckCode is a visual multi-agent orchestration product that represents real agent work as a familiar office environment. It is designed to let non-technical managers assign outcomes, observe work, answer escalations, inspect evidence, and approve deliverables without learning an agent framework.

## Current status

**Phase 4 graybox implementation is in progress.**

The owner approved deterministic Phase 4 Tasks 1–15 on 2026-08-13. Task 15, owner graybox acceptance, live kickoff, high-fidelity art, Phase 5 behavior, deployment, and external effects remain explicit decision gates; see `AGENTS.md`, `docs/phase-4-graybox-office-and-kickoff-spec-v0.1.md`, and `tasks/phase-4-todo.md` before changing behavior.

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

