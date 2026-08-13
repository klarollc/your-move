# CuckCode scaffold and dependency specification v0.1

Status: **Owner-approved for Phase 0 execution 2026-08-13**  
Audit date: 2026-08-13  
Scope: exact Phase 0 proposal incorporating D-26 reciprocal usability; no dependency has been installed and no Git repository has been initialized.

## Verified local environment

| Item | Observed value |
| --- | --- |
| Windows PowerShell | 5.1.26100.8875 |
| Node.js | 24.18.0 |
| npm | 11.16.0 |
| Git | 2.53.0.windows.2 |
| Codex CLI | 0.146.0 |
| Google Chrome file version | 151.0.7922.109 |
| Existing Git repository | none |

Chrome will be managed for automated testing through Playwright's pinned Chromium build. Chrome 151 remains the approved owner-review browser unless the owner changes D-07.

## Proposed repository layout

```text
CuckCode/
  apps/
    web/                     React DOM shell and PixiJS office
    server/                  loopback API, persistence, process supervision
  packages/
    contracts/               human/agent commands, context, collaboration, errors
    application/             shared use cases and reciprocal projection services
    domain/                  pure events, reducers, policies, projectors
    persistence/             SQLite migrations, stores, integrity/export
    runtime-codex/           Codex App Server adapter
    testing/                 simulator, fixtures, evidence helpers
    ui-system/               approved tokens and shared accessible DOM UI
  fixtures/
    decision-notice/         isolated six-role acceptance project
  roles/
    upstream/                immutable Agency Agents snapshots
    overlays/                reviewed CuckCode adaptations
    manifests/               provenance, hashes, license, promotion status
  docs/
  tests/
    e2e/
    visual/
    accessibility/
  .ui-craft/
  .cuckcode-template/        documented runtime-data layout, never live state
```

Live `.cuckcode/` state belongs inside the manager-selected project, is internally versioned by CuckCode, and is never staged or committed automatically.

## Workspace model

- npm workspaces, one root lockfile, private root package;
- ECMAScript modules and strict TypeScript;
- project references or equivalent package boundaries;
- dependency direction: apps/adapters depend on contracts/domain; domain depends on neither React, PixiJS, Node, SQLite, nor provider packages;
- React owns accessible DOM structure; PixiJS consumes scene descriptors and never owns canonical truth;
- Node server binds only to loopback and mediates every privileged capability.
- human UI and agent adapters invoke shared canonical command/application services rather than implementing separate business rules;
- contracts define typed agent-facing goals, context packets, collaboration records, handoffs, feedback, errors, capability discovery, and acknowledgments;
- every agent-facing message carries stable correlation IDs, schema version, project/work/agent scope, and relevant knowledge snapshot;
- observability measures both manager effort and agent friction without storing hidden reasoning.

## Proposed exact dependency pins

Registry versions were queried on 2026-08-13. The lockfile is authoritative after approved installation.

### Runtime

| Package | Pin | Purpose |
| --- | --- | --- |
| `react` | 19.2.8 | accessible application shell |
| `react-dom` | 19.2.8 | DOM renderer |
| `pixi.js` | 8.19.0 | WebGL office scene |
| `fastify` | 5.11.3 | loopback HTTP API |
| `@fastify/websocket` | 11.3.0 | typed local event stream if SSE is insufficient |
| `zod` | 4.4.3 | runtime boundary validation |
| `better-sqlite3` | 13.0.3 | synchronous local transactional store |

`better-sqlite3` is proposed, not yet accepted. Phase 0 must confirm Windows/Node 24 prebuild or build behavior, license, FTS5 availability, backup/integrity support, and crash-recovery tests before retention.

### Development and verification

| Package | Pin | Purpose |
| --- | --- | --- |
| `typescript` | 6.0.3 | compatible strict compiler pin |
| `vite` | 8.2.1 | web build/dev server |
| `@vitejs/plugin-react` | 6.0.5 | React transform; optional compiler peers excluded initially |
| `vitest` | 4.1.10 | unit/integration/contract tests |
| `@testing-library/react` | 16.3.2 | user-facing React behavior |
| `@testing-library/dom` | 10.4.1 | required DOM peer |
| `@testing-library/user-event` | 14.6.4 | realistic DOM interaction |
| `@testing-library/jest-dom` | 7.0.1 | accessible DOM assertions |
| `jsdom` | 30.0.1 | component test environment |
| `@playwright/test` | 1.62.1 | Chromium E2E and visual capture |
| `@axe-core/playwright` | 4.13.0 | automated accessibility checks |
| `eslint` | 10.8.1 | static linting |
| `@eslint/js` | 10.0.1 | core flat configuration |
| `typescript-eslint` | 8.67.0 | TypeScript ESLint integration |
| `prettier` | 3.9.6 | deterministic formatting |
| `tsx` | 4.23.12 | TypeScript dev/maintenance scripts |
| `@types/node` | 24.13.3 | match Node 24 runtime APIs |
| `@types/react` | 19.2.18 | React types |
| `@types/react-dom` | 19.2.4 | React DOM types |
| `@types/better-sqlite3` | 9.6.0 | SQLite binding types if required |

TypeScript 7.0.2 was current in the registry, but is intentionally rejected because `typescript-eslint` 8.67.0 declares support below TypeScript 6.1. TypeScript 6.0.3 is the verified compatible line. The registry's latest `@types/node` targets Node 26, so the scaffold instead pins the latest observed Node 24 line, 24.13.3.

## Proposed root scripts

```json
{
  "scripts": {
    "dev:web": "npm run dev --workspace @cuckcode/web",
    "dev:server": "npm run dev --workspace @cuckcode/server",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc -b --pretty false",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:contract": "vitest run --project contract",
    "test:e2e": "playwright test --project chromium-1440 --project chromium-1280",
    "test:a11y": "playwright test --grep @a11y",
    "test:visual": "playwright test --grep @visual",
    "build": "tsc -b && npm run build --workspace @cuckcode/web && npm run build --workspace @cuckcode/server",
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:contract && npm run build && npm run test:e2e"
  }
}
```

The two development processes intentionally use separate terminals in Phase 0, avoiding an unnecessary orchestration dependency. Workspace names and build commands must first be established by failing scaffold contract tests; this proposal may not be copied without that RED evidence.

## Repository and ignore proposal

Before `git init`, owner approval is required for:

```gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
.env
.env.*
!.env.example
.cuckcode/
*.sqlite-wal
*.sqlite-shm
```

Golden references, approved evidence manifests, migrations, deterministic fixtures, role source snapshots, overlays, and lockfiles remain tracked. Secrets and live project state remain untracked.

## Loopback and security defaults

- bind to `127.0.0.1`, never `0.0.0.0`;
- random per-session bearer secret delivered without URL query parameters;
- strict Origin allowlist for the web client;
- no browser filesystem, provider credential, or process-spawn authority;
- canonicalize the selected project root before any access;
- schema-validate every client, persistence, and provider message;
- deny network and external effects unless a scoped manager approval exists;
- redact sensitive values before event persistence.
- apply identical authorization and knowledge-scope checks to human and agent command paths;
- return structured actionable errors without leaking unauthorized resource existence.

## SQLite Phase 0 proof

Before the persistence package is accepted:

1. create a temporary database inside a test-owned directory;
2. verify transactions, WAL behavior, FTS5, foreign keys, application/user versions, integrity check, and backup;
3. terminate an isolated writer during a transaction and verify recovery;
4. confirm all test paths remain within the temporary project root;
5. document native binary provenance and clean-install behavior.

## Phase 0 execution proposal

After owner approval:

1. create restore/evidence record;
2. initialize Git and write the approved narrow ignore file;
3. create workspace manifests and empty package boundaries;
4. install exact pins and commit the generated lockfile only after license/install-script review;
5. install Playwright Chromium through its approved command;
6. write failing scaffold contract tests;
7. implement scripts/configuration until those tests pass;
8. run `npm.cmd run verify` and record environment evidence;
9. stop for the Phase 0 gate—no product behavior implementation.

## Approval requested

Approval should resolve two Phase 0 choices:

1. accept `better-sqlite3` as the candidate SQLite binding subject to the proof above;
2. accept Git initialization and the proposed ignore policy.

Dependency installation and Playwright browser download are external mutations and will be requested separately when execution begins.

