# External-source register

Checked: 2026-08-12

## Agency Agents

- Authoritative repository: [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)
- License: [MIT License](https://github.com/msitarzewski/agency-agents/blob/main/LICENSE), copyright 2025 AgentLand Contributors. The copyright and permission notice must accompany copied or substantial portions.
- Division registry: [`divisions.json`](https://github.com/msitarzewski/agency-agents/blob/main/divisions.json)
- Role-template convention: frontmatter plus identity, mission, critical rules, deliverables, workflow, and success metrics.
- Relevant upstream example: the README's “Enterprise Feature Development” team combines Senior Project Manager, Senior Developer, UI Designer, Experiment Tracker, Evidence Collector, and Reality Checker.

### Initial role references

- [Senior Project Manager](https://github.com/msitarzewski/agency-agents/blob/main/project-management/project-manager-senior.md)
- [Senior Developer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-senior-developer.md)
- [UI Designer](https://github.com/msitarzewski/agency-agents/blob/main/design/design-ui-designer.md)
- [Evidence Collector](https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-evidence-collector.md)
- [Reality Checker](https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-reality-checker.md)
- [Test Automation Engineer](https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-test-automation-engineer.md)

## Interpretation boundary

Agency Agents is used as a source catalog for role structure, role content, and example teams. CuckCode does not assume that it supplies execution, scheduling, event transport, permissions, evidence storage, or office visualization.

Upstream role content is not accepted blindly. Some role files contain stack-specific assumptions or visual prescriptions that may conflict with CuckCode's approved specification. Imports therefore require a preserved upstream layer plus a reviewed CuckCode overlay.
## Approved implementation-stack references

Checked: 2026-08-12

- [React: Using TypeScript](https://react.dev/learn/typescript) — basis for the typed accessible DOM shell.
- [PixiJS v8 architecture](https://pixijs.com/8.x/guides/concepts/architecture) — scene graph, renderer, events, and accessibility capabilities.
- [PixiJS renderers](https://pixijs.com/8.x/guides/components/renderers) — WebGL/WebGL2 is documented as stable and recommended; WebGPU remains outside first-slice acceptance.
- [Node.js releases](https://nodejs.org/en/about/previous-releases) — production applications should use an Active or Maintenance LTS line; CuckCode selects Active LTS at implementation start.
- [Node.js child process](https://nodejs.org/api/child_process.html) — stable asynchronous process-spawn boundary relevant to supervising local Codex App Server.

> **Amended 2026-10-03 (Phase 7 Task 4):** PixiJS is no longer used; the office scene is SVG in the DOM. The two PixiJS entries above are kept as the record of the original choice.

Versions remain implementation-time pins. This register records architectural suitability, not permission to install dependencies.

## Approved verification-toolchain references

Checked: 2026-08-12

- [Vitest: Getting Started](https://vitest.dev/guide/) — TypeScript-oriented unit and integration runner aligned with the Vite toolchain.
- [React Testing Library: Introduction](https://testing-library.com/docs/react-testing-library/intro/) — user-facing DOM queries and behavior over component implementation details.
- [Playwright: Visual comparisons](https://playwright.dev/docs/test-snapshots) — Chromium screenshot generation and comparison; baselines require a consistent execution environment.
- [Playwright: Accessibility testing](https://playwright.dev/docs/accessibility-testing) — axe-core integration and the explicit requirement to combine automation with manual assessment and inclusive testing.
- [axe-core](https://github.com/dequelabs/axe-core) — automated accessibility engine; automated findings are evidence, not full accessibility certification.

Exact versions and commands remain implementation-time pins. Visual baselines may only be promoted after review in the approved Windows/Chromium QA environment.
## Approved persistence and retrieval references

Checked: 2026-08-12

- [SQLite is Transactional](https://www.sqlite.org/transactional.html) — basis for atomic project-local canonical writes and crash-interruption expectations.
- [SQLite FTS5](https://www.sqlite.org/fts5.html) — first-slice local full-text indexing and ranked lexical retrieval.
- [SQLite application ID pragma](https://www.sqlite.org/pragma.html#pragma_application_id) — candidate database identification mechanism to evaluate during schema design.

These references establish architectural suitability. The Node binding, SQLite build features, schema, migrations, and exact integrity/backup commands remain implementation-time decisions and tests.
## Comparable products

Checked: 2026-08-18

The "agents rendered as office workers" concept is an existing product category, not a novel
CuckCode invention. Entrants, adoption figures, and the findings that bear on CuckCode
requirements are recorded in [`docs/competitive-landscape.md`](competitive-landscape.md).

Interpretation boundary: these products are recorded as market evidence about the metaphor's
appeal and about failure modes observed in shipped implementations. None is a source of
architecture, role content, or visual direction, and no code, asset, or design from any of them
may be imported. Their adoption does not satisfy any CuckCode acceptance gate.
