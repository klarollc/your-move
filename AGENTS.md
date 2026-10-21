# AGENTS.md — Your Move

Follow the current authority, live-state, and verification instructions in `docs/HANDOFF.md`, `position.json`, and the approved R1–R4 records. This repository contains an older graybox-office history plus the current hosted Your Move product; do not treat the historical office-first spec as the active hosted UI contract. Internal `@cuckcode/*` package names and legacy protocol/storage keys remain compatibility identifiers unless the owner separately approves a migration.

## Current product and delivery boundaries

- The current hosted product is Your Move: work creation, provider connections, execution, owner review, and explicit approval of proposed writes.
- Make only task-authorized changes. Read the applicable current task record, test contract, and project status before editing.
- Never connect to production providers, modify Railway, deploy, publish, or push without explicit authorization.
- Keep credentials, `.env` files, client data, and private owner content out of code, screenshots, and evidence.
- Do not modify generated evidence or provenance records unless the active scope explicitly authorizes evidence writing.

## Verification

- Use RED–GREEN–REFACTOR for behavioral changes.
- Run `npm run check:toolchain` before project checks.
- Run focused tests first, then the applicable broader gates; report commands and actual outcomes.
- Current visual changes require fresh screenshots at the requested viewport, browser console/network checks, keyboard behavior, and reduced-motion verification. Screenshots and unit tests are not owner visual acceptance.

## Historical office surface

The `apps/web` graybox office, old art-direction package, and Phase 7 office records are historical/secondary. They can retain an office product presentation but must use the user-visible product name **Your Move**. Their office-specific geometry and art rules do not govern the hosted Work/Connections surface.
