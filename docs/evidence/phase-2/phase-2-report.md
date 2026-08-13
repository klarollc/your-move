# Phase 2 evidence report

Status: **Pending owner acceptance**
Implementation commit: `04af121`
Date: 2026-08-13

## Delivered

Phase 2 now provides project-local SQLite truth, checksummed migrations, canonical event storage, content-addressed artifacts/evidence, filtered FTS5 knowledge search, deterministic context packets, isolated notebook/portable-profile records, affected-run propagation, context receipts and feedback delivery, and verified backup/export recovery.

The scripted acceptance scenario uses two isolated projects and two collaborating agent runs. It proves provisional contribution, contested review, manager-approved resolution, pre-action pause, both-agent checkpoint refresh and receipts, restart/rebuild stability, backup/export equality, and bidirectional canary isolation.

## Definitive machine gate

`npm.cmd run verify` passed against `04af12169e5a9200884aeb384f9436c67120da19`:

- scaffold contract: 2 passed;
- format: passed;
- lint: passed with zero warnings;
- TypeScript: passed;
- unit: 17 files, 47 tests passed;
- integration: 8 files, 23 tests passed;
- contract: 4 files, 23 tests passed;
- production build: passed;
- Chromium scaffold regression: 4 passed at 1440 x 900 and 1280 x 800;
- axe scaffold regression: 2 passed;
- visual command: executable, with no Phase 2 visual tests by design;
- dependency audit: zero known vulnerabilities.

## Deterministic proof

The exact proof is retained in `shared-knowledge-proof.json`.

- schema hash: `ff327a6adf54cb7e4bff851f9c0d74d139a07cc64f6d7fb407c3ede5cc5af701`;
- query hash before rebuild, after rebuild, and restart: `8b1f7d7e4e16e91109709893285a09755cb1dbd36e884f30a4c0f81fd40bcba8`;
- context packet and repeat hash: `6fd24a25ca6e1f7169adc04b9a3631b2feb8f0998fdf6964c87aacf9b281fcbf`;
- backup and export database hashes match in the proof artifact;
- both resolution recipients recorded: 2;
- Alpha-to-Beta and Beta-to-Alpha canary crossings: false.

## Audit corrections retained

Checkpoint C found and corrected two acceptance gaps before this report:

1. Existing Windows junctions could escape the project root, and checksum rejection retained an open SQLite handle. Both now have focused RED/GREEN regressions.
2. The shared-knowledge scenario refreshed one run rather than proving delivery to both collaborating agents. It now requires two paused/refreshed runs and two valid receipts.

All harness and behavioral failures remain recorded in `red-green-log.md`.

## Boundaries

Portable profiles remain outside project backups by design. Phase 2 performs explicit backups/exports only; there is no scheduler. Context budgets are deterministic UTF-8 bytes and record counts, not provider tokenizer counts. FTS5 is lexical; embeddings are excluded.

The browser and axe results cover only the unchanged Phase 0 scaffold. Phase 2 changed no rendered UI, so they are regression evidence rather than visual QA or art-direction acceptance.

No live provider/runtime adapter, Agency Agents import, HTTP API, production office UI, scheduled backup, cloud sync, deployment, or Phase 3 capability was implemented.

## Owner gate

Phase 2 is ready for owner review. Acceptance should mark the owner gate complete. Phase 3 remains unauthorized until separately planned and approved.
