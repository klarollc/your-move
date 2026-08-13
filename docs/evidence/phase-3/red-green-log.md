# Phase 3 RED-GREEN-REFACTOR Log

## Task 1 - Provider-neutral runtime and trust contracts

Date: 2026-08-13

- RED: `npm.cmd exec vitest run -- --project contract packages/contracts/src/runtime.contract.test.ts` failed because `./runtime.js` did not exist.
- RED: `npm.cmd exec vitest run -- --project unit packages/domain/src/runtime-trust.unit.test.ts` failed because `./runtime-trust.js` did not exist.
- GREEN: both focused suites passed, 3 tests each.
- REFACTOR: formatted the six scoped source/test/export files; both focused suites remained green.
- Verification: `npm.cmd run typecheck` passed.
- Scope proven: required correlation, secret rejection, manager-only permission decisions, mandatory failure non-waiver, admission/activation separation, and reciprocal actionable facts.
## Task 2 - Pin Codex protocol 0.146.0

Date: 2026-08-13

- RED: `node --test scripts/protocol-codex.test.mjs` failed because `check-codex-protocol.mjs` did not exist.
- GREEN: the focused protocol suite passed 4 tests covering unchanged, wrong-version, drift/missing, and experimental-field cases.
- Generation: the verified local `codex-cli 0.146.0` generated 275 stable files without `--experimental`.
- Reproducible semantic bundle hash: `ad2276a8362863c4bcc4083ca33b4a300920419b4ef244689d84c7706f710197` using canonical JSON, relative paths, and per-file SHA-256 input.
- Planning inventory manifest hash retained separately: `605640fd4906e94a9d26a1dd2204cfcc51842771c0b9431c5945be3c62456a4f`; it used the planning inventory representation and is not substituted for the reproducible bundle hash.
- Refinement RED: the first real-bundle check proved stable schemas include definitions for `experimentalApi`; runtime must not enable it, while generation provenance must show no `--experimental` flag.
- Refinement RED: the first regeneration attempt exposed nondeterministic JSON object-key order; raw-byte hashes drifted despite semantic equality.
- REFACTOR: schema files are now canonicalized before hashing; experimental generation is rejected from manifest provenance, and stable schema definitions remain valid.
- Verification: `npm.cmd run protocol:codex:generate` reproduced 275 files at the semantic bundle hash; `npm.cmd run protocol:codex:check` passed.
## Task 3 - Deterministic fake and adapter conformance

Date: 2026-08-13

- RED: the focused contract suite failed because `runtime-fake.js` did not exist.
- GREEN: 5 contract tests passed for fragmented/coalesced framing, deterministic replay, duplicate/unknown responses, malformed/oversized lines, stderr isolation, and post-disconnect rejection.
- REFACTOR: formatted the three scoped fake/test/export files; focused tests remained green.
- Verification: `npm.cmd run typecheck` passed without Codex, authentication, network, wall-clock waits, or external effects.
