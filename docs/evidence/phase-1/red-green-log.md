# Phase 1 RED-GREEN-REFACTOR log

## Task 1 - Stable primitives and canonical serialization

Acceptance: validated prefixed IDs and UTC timestamps, injected clock and ID contracts, byte-equivalent canonical JSON, and no wall-clock, randomness, browser, Node, or I/O dependency in the pure source boundary.

- RED command: `npm.cmd run test:unit -- --run packages/contracts/src/primitives.unit.test.ts packages/domain/src/canonical-json.unit.test.ts`
- Expected RED: both suites failed to import the intentionally absent `primitives.js` and `canonical-json.js` modules; zero tests ran.
- GREEN change: added the minimum primitive validators and recursive stable JSON serializer.
- GREEN result: 2 files passed; 6 tests passed.
- REFACTOR: exposed the modules through package entry points without changing behavior.
- Refactor verification: focused 2 files and 6 tests passed; `npm.cmd run typecheck` passed.
- Boundary verification: source scan found no `Date.now`, randomness, Node import, DOM, or window access.
## Task 2 - Versioned event envelope and canonical ordering

Acceptance: supported schema and kind validation, deterministic ordering, identical-duplicate idempotency, conflicting-duplicate quarantine, and deterministic malformed issue order.

- RED command: `npm.cmd run test:unit -- --run packages/contracts/src/events.unit.test.ts packages/domain/src/event-order.unit.test.ts`
- Expected RED: both suites failed to import the intentionally absent `events.js` and `event-order.js` modules; zero tests ran.
- First GREEN attempt: the contract parser suite passed, while all four ordering tests exposed a missing public `parseProjectEvent` export (`TypeError: parseProjectEvent is not a function`).
- Minimal correction: exported the implemented event contract through `@cuckcode/contracts`.
- GREEN result: 2 files passed; 6 tests passed.
- REFACTOR: exposed event ordering through the domain entry point and added explicit internal workspace dependency and TypeScript project-reference boundaries.
- Refactor verification: focused 2 files and 6 tests passed; `npm.cmd run typecheck` passed; lockfile refresh audited 307 packages with zero vulnerabilities and ran no install scripts.
## Task 3 - Work, evidence, and approval truth slice

Acceptance: invalid transitions remain issues without mutation, completion requires all named passed evidence, completion and approval remain separate, and only a manager event can create version-bound approval.

- RED command: `npm.cmd run test:unit -- --run packages/domain/src/work-truth.unit.test.ts`
- Expected RED: the suite failed to import the intentionally absent `work-truth.js` module; zero tests ran.
- GREEN change: added the minimum work, evidence, approval state types and pure reducer.
- GREEN result: 1 file passed; 4 tests passed.
- REFACTOR: exported the truth slice through the domain entry point.
- Checkpoint A: full unit suite passed (5 files, 16 tests); lint passed with zero warnings; typecheck passed.