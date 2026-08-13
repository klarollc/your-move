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
## Task 4 - Agent, role-assignment, and qualification truth slice

- RED: focused staffing suites failed to import the absent `staffing.js` and `staffing-truth.js` modules; zero tests ran.
- GREEN: added qualification/roster contracts and the pure staffing reducer; 2 files and 5 tests passed.
- Invariants: mandatory failures remain blocking despite exceptions; a second role or missing hard capability is rejected; disconnected active state becomes unavailable and invalidates qualification.
- REFACTOR verification: public exports formatted; `npm.cmd run typecheck` passed.
## Task 5 - Knowledge lifecycle truth slice

- RED: focused knowledge suites failed to import the absent `knowledge.js` and `knowledge-truth.js` modules; zero tests ran.
- GREEN: added lifecycle contracts, pure reduction, and current-knowledge selection; 2 files and 5 tests passed.
- Invariants: provenance is required; adapter findings remain provisional; manager promotion is explicit; unauthorized, stale, rejected, and superseded records remain inspectable but not current.
- REFACTOR verification: public exports formatted; `npm.cmd run typecheck` passed.
## Task 6 - Collaboration, handoff, and actionable error contracts

- RED: focused contract and unit suites failed to import the absent collaboration modules; zero tests ran in both suites.
- GREEN: added participant-neutral commands, complete handoff validation, actionable errors, and shared permission authorization; contract 3 tests and unit 1 test passed.
- Checkpoint defect: typecheck caught a widened test action literal, which blocked declaration emission and exposed a stale downstream contract boundary. The literal was narrowed without changing behavior.
- Checkpoint B: formatting and lint passed; typecheck passed; full unit suite passed (10 files, 27 tests); full contract suite passed (1 file, 3 tests).