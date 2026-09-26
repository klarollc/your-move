# Follow-ups red-green staging (Tasks 4–6)

Staged here so the ledgered `docs/evidence/runtime/codex-currency/red-green-log.md` changes only
once, at Task 6's provenance write, when these entries move into its "Follow-ups" section.

## Task 4 — Features in the upgrade (F1.2)

- RED (2026-09-26, `node --test scripts/codex-surface-diff.test.mjs`): 9 pass, 8 fail, every
  failure an `AssertionError`. Seven failed against deliberate stubs (`parseFeaturesList` returning
  `[]`, `diffFeatures` returning an empty diff, `mergeDiffs` returning its first argument); one
  failed against the real `upgradeWritePaths`, which did not yet list `features.json`.
- GREEN: 17 pass, 0 fail. Parser: padded columns, a stage that may contain a space, CRLF, a
  refused unreadable line (`FEATURES_LIST_UNPARSED`) and a refused empty list
  (`FEATURES_LIST_EMPTY`). Diff: a new default-on feature, a flip to default-on and a stage move on
  a default-on feature need a ruling; a default-off addition, a flip to off and a removal are
  recorded, not ruled; with no baseline list every default-on feature needs a ruling.
- Found while building: `features list` reports the state under the config it runs with (the
  2026-09-26 ruling showed `-c features.apps=false` changes it), so the upgrade runs it with an
  empty `CODEX_HOME` and a working directory outside the repository.
- Dry run in the container mirror (Linux 0.157.1, not the owner's Windows binary):
  `created:false`, bundleHash unchanged `98111ca770d4d181fa42551a666d8c9be42d1333540ef70fd93cffda53fba24f`,
  `manifest.json` bytes unchanged, 150 features, 52 default-on, `needsRuling` 55 (the 3 existing
  entries plus 52 `featureDefaultOn`, ruled by FU-1), no temporary directory left behind.
