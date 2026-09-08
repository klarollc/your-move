# Task 16 — Role promotion and live kickoff preflight packet

Status: **DECISION PACKET. Nothing is promoted. No provider call has been made.**
Prepared 2026-09-08 against `ba30926`, updated the same day with the owner's decisions.
Authorized 2026-09-08, scoped to producing this packet only.

**One blank remains: the two model names (§2).** Everything else is settled and recorded below.

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

**Every role is currently `"status": "candidate", "executable": false`.** That is what approval
changes, and it changes it for these six contract versions only.

**Owner decision 2026-09-08 — promotion scope: promote until revoked, not per-kickoff.** These six
contract versions become executable and stay executable until explicitly revoked. Consequence,
accepted deliberately: there is no automatic reversion after the run, so an explicit revoke path
is required and is part of Task 16's executable half. Digest accuracy is not a manual check —
`npm run roles:agency-agents:check` asserts these digests, source drift and path allowlisting on
every `verify`, and was green at `ba30926`. What approval changes is the executable flag, not the
identity.

`implementation-engineer` carries one **quarantined segment**, treatment
`excluded_from_normalized_role`. The excluded content is a single line:

```html
<!-- You create sophisticated component combinations -->
```

Harmless in content. Not harmless in category: an instruction invisible to anyone reading the
rendered markdown and fully present in the text a provider would receive. The import test named
"rejects hidden instructions and executable overlays" fired on a benign instance in an upstream
repository with no bad intent.

**Owner decision 2026-09-08: exclusion confirmed.** The promoted `implementation-engineer`
therefore differs from its upstream source; the manifest records the segment hash and treatment,
so the difference stays attributable. Recorded because this is the only evidence in existence that
the import quarantine does anything.

## 2. Runtime

- Codex App Server, local direct-spawn stdio. Installed version **0.146.0**, pinned protocol
  bundle at `packages/runtime-codex/protocol/0.146.0/`.
- Transport is loopback only. Non-loopback transport is a spec stop condition.
- **`authMode`: `chatgpt`.** Owner decision 2026-09-08 — subscription auth, not an API key.
- **Two models, one provider.** Owner decision 2026-09-08. Five roles on one model; the Release
  Reviewer on a second. Rationale: D-25 gives that role independent dissent, and six instances of
  one model on one briefing are correlated by construction — if it never dissents, the record
  cannot distinguish "nothing to dissent about" from "same model, same conclusion." Two models
  within one provider buys partial decorrelation at the cost of one extra binding.
- **The two model names are not yet recorded.** The pinned protocol treats `model` as a free
  string and enumerates no values, so the available names come from the account rather than from
  the pin. They must be written here before Task 17, because "which model produced this" belongs
  in every attributable record afterwards.

A cross-vendor split was considered and rejected on 2026-09-08: it requires a second runtime
adapter, which is now blocked by deliberate decision. See
`docs/evidence/runtime/c1-provider-neutrality-review.md`.

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
**not** the live briefing.

**Owner decision 2026-09-08: keep the graybox briefing's structure, replace only its goal.**
Structure is preserved so the live output stays comparable to `?kickoff=revision`; the goal is
replaced because the fixture's — "Choose the first project goal collaboratively" — is deliberately
vague and would produce output no manager would charter. That matters more than it sounds:
**Task 17 ends in a charter decision, and a chartered fixture is what closes the named weak
assertion** in §8. A run ending in rejection leaves that assertion open.

Proposed briefing, for approval with the packet:

```
goal:                  "Assert that every canonical record type carries a validated timestamp."
constraints:           ["No pre-charter implementation"]
permissions:           ["project.read", "collaboration.contribute"]
evidenceFloor:         ["test", "visual", "release"]
managerNonNegotiables: ["Six attributable roles", "One revision maximum"]
activeRoleIds:         [delivery, design, implementation, test, visual, release]
```

The goal is the DF-007 corrective, already recorded as proposed-and-unauthorized in
`docs/evidence/dogfood-register.md`. It is small, concrete, the owner already believes it should
exist, `QuestionDisposition` is a known second offender, and six roles have genuinely different
things to say about it. It is a goal the owner would actually charter.

## 6. What remains

**One blank, then approval of the packet as a whole.**

1. **The two model names**, and confirmation that the second belongs to the Release Reviewer.

Settled on 2026-09-08 and recorded above rather than left as open questions: promotion scope
(until revoked, §1), the quarantined segment (exclusion confirmed, §1), `authMode` (`chatgpt`,
§2), the two-model approach (§2), and the briefing (§5).

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
