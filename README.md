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

**Phase 4 and Phase 6 are complete. Phase 5 was accepted by the owner on 2026-09-25 on the pass-5
verdict; its D-24 production-suitability review is due 2026-10-09 and Phase 5 cannot close without
it. C-17 is out of scope, not met.**

The bounded live D-25 kickoff ran its full thirteen turns on 2026-09-14: six promoted roles, six
distinct bindings, no external effect. The owner approved the charter it produced, with its ten
evidence gaps as blocking conditions. Phase 6 promoted `reconciliation-b-clarity` to the Active
visual system.

Carried forward unresolved: MDD section 20's comprehension debt remains open. The human
screen-reader walkthrough was ruled **out of scope** on 2026-09-18 for this single-user tool, which
is not the same as met — screen-reader behaviour has never been verified and is not claimed.
Automated accessibility checks and keyboard operability remain required. The C-17 owner disposition and record are
`docs/evidence/phase-5/c-17-owner-acceptance.json` and
`docs/evidence/phase-5/screen-reader-walkthrough-2026-09-18.md`. Three Phase 6 provenance gaps also
remain open.

**Phase 7 high-fidelity art, deployment, external effects, and any production reuse of fixture code
remain unauthorized.** Phase 5 overall Task 10 owner acceptance remains separate from the C-17
disposition and is still owner-run. See `AGENTS.md`,
`tasks/phase-5-todo.md`, and `docs/evidence/phase-5/approved-charter-v1.md` before changing behavior.

On 2026-09-23 the owner inserted **Phase 7-O, Operability**, before Phase 7, classified the
default-office rail/inspector contradiction V1, and authorized a specification for truthful
inspector detail and adversarial fixtures. Actually performed comprehension tasks T3/T5/T6 are in
the Phase 7-O gate. The [decision record](docs/evidence/phase-7-o/decision-record-2026-09-23-operability-scope.md)
authorizes specification only; Phase 7-O implementation still awaits a separately approved spec,
plan, and tasks.

## Agent command runner

`npm run agent:runner` (add `-- --allow-push` to permit pushing) lets an agent request allow-listed
checks — `verify`, the individual test suites, `typecheck`, `lint`, a read-only provenance check —
on this machine without a human relaying output. Start it in a visible terminal and stop it with
Ctrl+C. It runs only the commands in `scripts/agent-runner.allowlist.json`, one at a time, with no
shell and no `CUCKCODE_*` variables, and refuses to start if any such variable is set. Requests and
results live under `node_modules/.cache/agent-runner/`. Plan: `tasks/agent-runner-plan.md`.

Since 2026-09-26 the allowlist also carries six read-only checks — `check:toolchain`,
`test:toolchain`, `test:protocol`, `protocol:codex:check`, `protocol:codex:drift` and
`test:runtime` — for fast targeted checks. They do not change the gate: a commit's gate is still a
full `verify` on a clean tree. The runner reads its allowlist once at startup, so restart it after
the allowlist changes.

## Codex runtime

Codex is a pinned npm dependency, not the desktop app's binary: `@openai/codex` at one exact version
in `packages/runtime-codex/package.json`. `npm run protocol:codex:drift` checks the installed binary's
version and app-server schema against the pin and the committed bundle in
`packages/runtime-codex/protocol/<version>/`, with no provider call; `verify` and every live script
run it. `npm run protocol:codex:upgrade -- <version>` generates a new bundle and a surface diff for
review and never moves the pin. Specification: `docs/codex-runtime-currency-spec-v0.1.md`.

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
