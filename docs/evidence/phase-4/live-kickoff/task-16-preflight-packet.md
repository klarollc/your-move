# Task 16 — Role promotion and live kickoff preflight packet

Status: **DECISION PACKET. Nothing is promoted. No provider call has been made.**
Prepared 2026-09-08 against `ba30926`. Authorized by the owner on 2026-09-08, scoped to producing
this packet only.

Approving this packet authorizes Task 17: one bounded live kickoff. Approving it does **not**
authorize Phase 5, high-fidelity art, visual baseline promotion, deployment, or any external
effect.

## 1. The six immutable upstream sources

Upstream: `https://github.com/msitarzewski/agency-agents`, commit
`ebe9c99acb5c96f9468de368d8bead775387d1a7`, MIT.
Registry `divisions.json` sha256 `15136bcf…a9e48add`; LICENSE sha256 `9a452584…3677f66f`.
Vendored at `roles/upstream/agency-agents/ebe9c99a…/`. Manifest: `roles/manifest.json`.

| Role to promote | Upstream source | Source sha256 | Overlay sha256 |
| --- | --- | --- | --- |
| `delivery-lead` | `project-management/project-manager-senior.md` | `70fb27ca…b540ef2d` | `08270490…eef6e802` |
| `product-designer` | `design/design-ui-designer.md` | `31307689…b6cba240` | `c6ab5dda…2cdf3f31` |
| `implementation-engineer` | `engineering/engineering-senior-developer.md` | `63b8da6c…02c82599` | `23a5a014…472b912e` |
| `test-engineer` | `testing/testing-test-automation-engineer.md` | `479ba12e…7113c0a7` | `4ce050d5…012d5f99` |
| `visual-qa-reviewer` | `testing/testing-evidence-collector.md` | `d7e95b64…d4ef5b12` | `db362629…3a886442` |
| `release-reviewer` | `testing/testing-reality-checker.md` | `6d32fcdb…08f988a1` | `c16186ff…86c3c51b` |

Full digests are in `roles/manifest.json`; the abbreviations above are for reading, and the
preflight check compares full values.

**Every role is currently `"status": "candidate", "executable": false`.** That is what your
approval changes, and it changes it for these six contract versions only.

`implementation-engineer` carries one **quarantined segment**, sha256 `29b191b6…bf9cc3f4`,
treatment `excluded_from_normalized_role`. It is excluded from the normalized role and will not
reach the provider. Flagged because it is the one role whose promoted contract is not simply its
upstream source.

## 2. Runtime

- Codex App Server, local direct-spawn stdio. Installed version **0.146.0**, pinned protocol
  bundle at `packages/runtime-codex/protocol/0.146.0/`.
- Transport is loopback only. Non-loopback transport is a spec stop condition.
- **Model is not recorded anywhere in this repository.** Phase 3's live evidence records the
  Codex version and nothing about the model. See §6 — this is the first item you must supply.

## 3. Bindings

**No agent bindings exist.** Nothing in the repository records six agent IDs bound for this
kickoff, and it would be wrong to invent them here.

What does exist: Phase 3 Tasks 7–11 established binding persistence and identity continuity,
controlled six-role candidate import, universal candidate admission, six role-specific
qualification suites (2 files / 16 tests passing at the Phase 3 gate), and the separation of
admission, qualification, agent acceptance, and manager activation as distinct states.

The machinery is proven; the six bindings are not made. Creating them is the first executable
step of Task 17 preflight, and the preflight must refuse to proceed if any of the six lacks
current, compatible admission and qualification evidence.

## 4. Turn budget and policy ceiling

- **Maximum 13 correlated turns**: six role contributions, one Delivery Lead synthesis, six
  explicit revisions or affirmations. Exceeding 13 is a spec stop condition.
- **Text only.** No tool, connector, file, shell, search, image, deployment, or messaging effect.
- The kickoff is D-25 shaped: one attributable role-specific round, Delivery Lead synthesis
  preserving disagreements, one team revision, then manager selection or redirection.
- Disconnect, malformed output, stale state, or correlation failure must stop the run without a
  fabricated contribution and without a fabricated consensus. Silence is never assent.

## 5. Fixture root and briefing

The graybox fixtures under `?kickoff=revision` and `?kickoff=round` are deterministic and are
**not** the live briefing. The shared briefing for a live run does not exist yet and must be
written and approved before Task 17.

## 6. What you must supply before Task 17 can start

These are genuine gaps, not formalities. Each one blocks.

1. **The model.** Nothing in the repo names it. It must be recorded in the packet before the run,
   because "which model produced this" is part of every attributable record afterwards.
2. **The shared briefing text.** The one thing all six roles respond to.
3. **Confirmation that promotion is limited to these six contract versions**, digests as listed.
4. **Disposition on the `implementation-engineer` quarantined segment** — confirm exclusion.

## 7. What is not built yet

Stated plainly so this packet is not mistaken for readiness.

- **`npm run kickoff:live` does not exist.** Nothing in the repository references
  `CUCKCODE_LIVE_KICKOFF`. The spec proposes the command; the harness is Task 17 work.
- **The preflight is not machine-enforced yet.** Task 16's acceptance requires that the
  text-only/no-tool/no-external-effect policy be machine enforced and that any drift or failed
  precondition block without partial promotion. Those checks are not written. This packet is the
  decision half of Task 16; the executable half remains.

Approving the packet contents does not make the run possible. It makes the remaining Task 16
work — the promotion and preflight checks — worth writing against a settled target.

## 8. Named weakness carried into this gate

The offline kickoff E2E asserts that the decision impact still reads "No work is authorised yet",
and that assertion would also hold if no fixture ever approved a charter, because none does. It
guards the right property without proving that a degraded runtime specifically cannot promote a
kickoff to authorised. Closing it needs a chartered fixture to contrast against — which this
gate produces. Recorded so it is not later read as stronger evidence than it is.
