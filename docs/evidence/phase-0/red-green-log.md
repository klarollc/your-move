# Phase 0 RED-GREEN evidence

## Scaffold contract

- RED command: `node --test scripts/scaffold-contract.test.mjs`
- Intended failure: both tests failed with `ENOENT` because `package.json` did not yet exist.
- GREEN: after the private npm workspace manifest and required scripts were added, both scaffold tests passed.

## SQLite proof

- RED command: `npm.cmd run test:integration -- --run packages/persistence/src/sqlite-proof.integration.test.ts`
- Intended failure: Vitest loaded the integration project but could not resolve the unimplemented `sqlite-proof.js` module.
- GREEN: after the minimum proof implementation, both capability and path-confinement tests passed.

## Accessibility correction

- Initial browser accessibility run failed at both approved viewports with axe rule `page-has-heading-one`.
- Minimal correction: the infrastructure-only scaffold received an explicit `h1`.
- GREEN: axe returned zero automatically detectable violations at 1440 x 900 and 1280 x 800.

## Verification-harness defects caught

- Vitest initially discovered a preserved RED test under `.restore/`; all projects now exclude recovery and generated directories.
- A shell-sensitive grep edit temporarily made `package.json` invalid; the manifest was restored from `.restore/`, replaced with explicit `@e2e` tagging, and revalidated by the scaffold contract.
- The first inline SQLite probe was rejected by PowerShell quoting; no evidence was claimed from it. The maintained integration test and typed runner replaced it.