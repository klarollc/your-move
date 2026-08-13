# Phase 0 dependency review

Checked: 2026-08-13

- Exact direct versions are pinned in `package.json` and `package-lock.json`.
- `npm audit` reports zero known vulnerabilities across the installed tree.
- Direct-license review found MIT, Apache-2.0, and MPL-2.0 licenses only.
- TypeScript is pinned to 6.0.3 because `typescript-eslint` 8.67.0 declares support below TypeScript 6.1; registry-latest TypeScript 7 was rejected.
- `@types/node` is pinned to the verified Node 24 line, 24.13.3, rather than registry-latest Node 26 types.
- npm install scripts are denied unless explicitly listed. Only these audited exact packages are allowed:
  - `better-sqlite3@13.0.3`: native Node binding build required for the approved SQLite proof.
  - `esbuild@0.28.2`: platform binary verification required by Vite/Vitest.
- `npm approve-scripts --allow-scripts-pending` reports no unreviewed scripts.
- Playwright 1.62.1 installed Chromium 151.0.7922.34 plus its required FFmpeg and Winldd support files.