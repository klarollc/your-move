# Phase 3 Invariant and Evidence Gate

Date: 2026-08-13
Result: **PASS — ready for owner review**

## Machine verification

- `npm.cmd run verify`: exit code 0.
- Codex protocol: 4 tests passed; 275 generated files validated at exact version 0.146.0.
- Agency Agents: 3 tests passed; 6 Candidate roles validated at pinned commit `ebe9c99acb5c96f9468de368d8bead775387d1a7`.
- Qualification: 2 files / 16 tests passed.
- Scaffold contracts: 2 tests passed.
- Formatting, lint, and TypeScript checks passed.
- Unit: 23 files / 79 tests passed.
- Integration: 11 files / 31 tests passed; the guarded live suite was skipped in ordinary verification by design.
- Contract: 6 files / 31 tests passed.
- Production web build passed.
- Browser scaffold smoke: 4 tests passed across Chromium 1440 and 1280.
- Automated accessibility: 2 tests passed across Chromium 1440 and 1280.
- Configured visual command exited successfully with no Phase 3 visual assertions.
- Explicit `npm.cmd run test:runtime`: 8 contract, 4 process-integration, and 7 unit tests passed.
- Explicit protocol and role provenance checks returned `ok: true`.

## Supervised live evidence

- Owner-authorized corrective attempt 2 passed: 1 file / 1 test, exit code 0.
- Installed Codex 0.146.0, managed authentication, direct stdio handshake, bounded turn, exact correlation, clean shutdown, and cleanup were verified.
- No command, file-change, MCP, dynamic-tool, collaboration, web-search, or image-generation item was emitted.

## Invariants established

- Provider reports are evidence, never authoritative manager decisions.
- Admission, qualification, agent acceptance, and manager activation remain distinct.
- Permission is deny-by-default, exact-scope, single-use, and replay/staleness protected.
- Credentials are rejected from application persistence and evidence.
- Binding identity, versions, qualification freshness, recovery, and project isolation are enforced.
- Imported upstream role material remains attributed, hash-checked, overlay-separated, Candidate, and non-executable.
- Agent role voice and manager-final staffing truth remain separately auditable.

## Limits and owner gate

- Phase 3 establishes the runtime trust boundary and evidence pipeline only.
- It does not establish visual acceptance, the office workspace experience, agent avatar quality, full accessibility, production readiness, deployment readiness, or Phase 4 authorization.
- Automated accessibility detects only a subset of accessibility failures.
- The configured visual command currently carries no Phase 3 visual assertions; strict visual QA belongs to the separately approved UI phase.
- Owner accepted the Phase 3 evidence gate on 2026-08-13.
- Phase 4 remains unauthorized pending a separate scoped plan and explicit approval.
