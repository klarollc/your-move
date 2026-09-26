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
- Owner's first run (win32-x64): 150 features, **53** default-on, `needsRuling` 56, bundleHash
  unchanged. The one difference from the Linux dry run: `secret_auth_storage` (stable) is default-on
  on win32-x64 and default-off on linux-x64.
- **Erratum, spec §Findings:** "52 default-on in all" was counted from the Linux binary in the
  container mirror. The pinned binary on the owner's platform (win32-x64) reports 53. The 43
  "not removed" figure has the same source and is one short on win32-x64 for the same reason.
- **Owner ruling, 2026-09-26** (moves into the follow-up rulings record at Task 6):
  `secret_auth_storage` is disabled under FU-1's deny-by-default rule; Task 6's signed-in probe
  (`account/read`, no model turn) proves whether sessions still see the login, and a failure there
  reopens it as a keep. `features.json` records the platform it came from; the owner reruns the
  upgrade once to write it.
- RED (platform field): 17 pass, 1 fail, `AssertionError` against a stub `buildFeaturesRecord`
  that returned only `version` and `features`. GREEN: 18 pass, 0 fail.
