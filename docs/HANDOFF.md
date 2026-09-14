# Handoff — state, next action, and what would otherwise be relearned expensively

Written 2026-09-14, last updated after the Task 6 second verification pass. Read `AGENTS.md` first for authority; this document is the
live state, the next action, and the things a fresh session pays for twice if nobody wrote them down.

---

## Where the project is

| Phase | State |
| --- | --- |
| 0–3 | Accepted 2026-08-13 |
| 4 | **Complete.** Bounded live D-25 round ran the full thirteen turns; evidence packet delivered. Owner gate open. |
| 6 | **Complete.** `reconciliation-b-clarity` is the **Active** visual system, promoted by owner execution. |
| 5 | **Tasks 1–9 done.** Release verdict: **NEEDS WORK**, 11 of 21 criteria satisfied. Task 10 is owner-run and is the only authorized step left. |
| 7, 8 | **Unauthorized.** Phase 7 needs its own specification, plan and owner approval. |

Phase 5 turn ledger: **10 of 60**. Acceptance criteria: **20 ready, 1 blocked** (C-18, on gap 3).

---

## The immediate next action

**Task 10 is owner-run and is the only authorized step left in Phase 5.** Do not perform it. The
Release Reviewer's verdict is `NEEDS WORK` — `docs/evidence/phase-5/task-9-outcome.md` — so what the
owner is being asked to accept is a phase that its own independent reviewer says is not ready, with
eleven of twenty-one criteria satisfied.

Nothing else is authorized. The ten items the reviewer says would change its verdict are ordinary
work nobody has ruled on, except these three, which cannot be closed by an agent at all:

- **C-17** needs a human screen-reader walkthrough naming the screen reader, the build, and the paths
  it did and did not exercise. Decision 5-D committed this phase to it.
- **C-18** needs gap 3, the provenance and supersession schema.
- **C-19** needs the owner to look at the forty current-build images and record fidelity acceptance.

**Read DF-015 before writing any brief.** Four briefs in this phase described a world that did not
exist, cost three agent turns, and nearly cost the release verdict: the first release pass reported
four of twenty-one satisfied and the third reported eleven, on an unchanged implementation. Every
false claim was hardcoded prose that was true the day it was written. No brief states what evidence
exists any more — `scripts/phase5-evidence-inventory.ts` reads the tree and reports it.

## Open debts, none of them closed

- **MDD §19 and §20 are unmet.** Waived in Phase 4 with comprehension tasks T3/T5/T6 never performed
  and the screen-reader walkthrough never run. Decision 5-D commits Phase 5 to repeating the gate
  properly: one screen reader, one walkthrough genuinely performed.
- **Gap 3** — the provenance and supersession schema — is the only blocking gap left. C-18 depends
  on it. It is Task 2 design work, not an owner decision.
- **Three Phase 6 provenance gaps** carry forward: no external visual reference informed any
  candidate; the generated half of the approved hybrid medium was never produced; four of six named
  typefaces cannot be embedded, with Phase 7 embedding as the named trigger.
- **Phase 5 will not prove agents can write code.** Decision 5-A is hybrid — agents own design,
  review and verdict; implementation is conventional. That is a recorded departure from the literal
  MDD §24 run and the Phase 5 packet must say so.
- **One live round is one sample.** Thirteen turns on one day say the roles are distinct and the
  round completes. They say nothing about stability across runs.

---

## Rules that are easy to violate

- **Never implement without a recorded owner ruling.** Specification → plan → tasks →
  implementation, with explicit approval at each boundary.
- **Promotion is owner-run, always.** Build the request and the command; never execute it. Both role
  promotion and the Phase 6 visual promotion are gated behind `CUCKCODE_OWNER_PROMOTION=1` and the
  owner runs them.
- **"Noted" is not approval.** MDD D-25: silence is not agreement. When the owner acknowledges
  rather than approves, record it as acknowledged and ask again. He answers directly when asked.
- **Do not accept delegation on an item where your own recommendation was that he decide.**
- **Amend every boundary document in the same pass as the ruling.** `AGENTS.md`, `README.md`, the
  MDD, and the relevant checklist. Leaving one stale is the repeated defect below.
- **RED evidence is a recorded observation, not a live report.** Never re-run a RED capture after
  GREEN.

---

## The recurring defect, and its variants

**A guard is exact inside a boundary nobody examined.** Recorded as DF-010, DF-011, DF-012 and found
at least eight more times in Phase 6 alone. Its variants, each of which cost real time:

- A guard that passes on material that cannot work (DF-010, DF-011).
- A guard that refuses material that works — `roles:promotion:status` joined the superseded import
  and reported an empty promoted set while six roles were promoted (DF-012). **A gate reporting
  closed while open.**
- A guard that is only as current as its call site. Ask, on every decision that supersedes something:
  *what still reads the thing we just superseded?*
- A guard written inside the same boundary as the thing it protects. Twelve passing tests over
  `promotedRoleIds` all built their own manifest fixture, so none could see which manifest the CLI
  actually passed.
- A guard that greps prose. It passes on whatever phrasing it is handed; use a structured field.
- **A mutation that fails to apply is indistinguishable from a guard that does not work.** Verify the
  mutation landed before believing a survivor. This happened once with a prettier-wrapped string.

**And the one that cost the most (DF-015):** four briefs described a world that did not exist. A
brief is a promoted role's entire world, it was treated as framing rather than as evidence, and the
answer's accuracy is bounded by it. **Never hardcode a claim about what evidence exists.**

**And the variant that nearly got filed as a flake (DF-014):** the capture runner passed `--grep
"@visual Phase 5"` through `execFile` with `shell: true`, so the shell split it and Playwright
received `@visual` as the pattern with `Phase` and `5` as positional file filters. It appeared to
work because those strings match the phase-5 filenames. It surfaced as **one unreproducible
failure**, and "I could not reproduce it" means "I do not know what happened" — filing it as a flake
would have left every artifact the harness produced counted as evidence of a command nobody ran.
**No evidence-producing script should invoke a tool through a shell.**

**And the variant Task 7 produced twice in two days:** a brief that hands a role a false premise and
then files the answer as evidence. The verification brief said there were no component tests after
Task 5 shipped them. The Visual QA brief never mentioned the accessibility and isolation suites, so
the reviewer correctly reported that no such checks were shown to it and recommended work already
done. **A brief is an evidence artifact and its accuracy is a precondition of the answer's.**

**And the variant that had been running the longest (DF-013):** `npm run verify` — the eighteen-stage
gate that claims the whole project passes — had never completed since Phase 1. Playwright's default
`testMatch` collected a Vitest file out of `tests/` and died at collection, so no e2e, accessibility
or visual test ran under it. Every session reported suite health from the individual stages instead,
and every one of those numbers was true and none of them was the gate. Fixed by naming `testMatch`.
**Report suite health from `verify`, and name the command beside any count.**

**And the newest variant, from Task 5:** every guard in this repository checks that a claim matches
reality *now*. None notices when a historical record is replaced by a current one. Re-running the RED
capture after GREEN silently overwrote "seventeen failed" with "seventeen passed" — true at the time
of writing and completely beside the point. The capture now refuses to overwrite. The general gap in
the evidence model is not fixed.

---

## Defects that cost a live run, or nearly did

- `createControlledCodexHome` gave the session an empty `CODEX_HOME`, which replaces the credential
  Codex reads along with the instruction sources it was meant to replace. Six role exercises failed
  `AUTH_REQUIRED` while the owner was authenticated the whole time.
- `waitForNotification` returned the first cached notification and never consumed it. A thirteen-turn
  round would have replayed turn one twelve times **and reported success**. Fixed by
  `waitForTurnCompleted`, which matches on turn id.
- The kickoff domain hardcoded `"delivery"` as the synthesis author while the promoted roles are
  `delivery-lead`. The live round would have died at turn 7 of 13 after spending six turns and the
  whole allowance. **Caught by the rehearsal, not by the run.**
- A JSON array was sliced from its first brace and its first element adopted as a role's whole
  position — quiet coercion of an answer never given.
- Attempt 1 of the live kickoff *did* fail at turn 7, on a prompt that said "Include every
  contributionId" immediately before asking for a register keyed by role id. That one cost a run.

**The lesson that generalises:** rehearse against a fake runtime before spending a bounded allowance.
`packages/application/src/kickoff-rehearsal.integration.test.ts` is the pattern.

---

## Operational specifics

Everything runs from `C:\Users\nater\CuckCode`. The owner uses **PowerShell**, so `&&` is a parse
error and there is no inline env-var prefix — write `$env:X='1'; cmd` and clear it afterwards.

| Command | Purpose |
| --- | --- |
| `npm run kickoff:preflight` | Task 17 preconditions, no provider calls |
| `npm run phase5:contract:build` | Rebuild the acceptance contract and traceability matrix |
| `npm run verify` | The whole gate. 511 unit/component/integration + 50 e2e + 42 a11y + 62 visual |
| `npm run phase5:capture` | Recapture the 40 browser cells and rebuild the manifest |
| `npm run phase5:fidelity` | Contract names, as amended by the overlay, against the captured trees |
| `npm run phase5:visualqa:run` | Visual QA Reviewer annotation (live, debits the ledger) |
| `npm run phase5:knowledge` | Rebuild the shared-knowledge scenario from the two passes |
| `npm run test:knowledge` | The Phase 5 shared-knowledge gate condition (also in `verify`) |
| `npm run phase5:release:run` | Release Reviewer verdict (live, debits the ledger) |
| `npm run phase5:verify:run` | Test Engineer verification pass (live, debits the ledger) |
| `npm run phase5:surface:run` | Product Designer surface contract (live, debits the ledger) |
| `npm run roles:promotion:status` | Which roles are promoted, derived from `roles/authored` |
| `npm run phase6:*` | Rebuild any Phase 6 artifact |

Live runs need an explicit opt-in env var — `CUCKCODE_LIVE_PHASE5`, `CUCKCODE_LIVE_KICKOFF`,
`CUCKCODE_LIVE_ROLE_EXERCISE` — and every one of them debits `docs/evidence/phase-5/turn-ledger.json`
where applicable. **A budget nobody debits is discovered rather than set.**

Git: work happens on `hermes/phase-4-task-15-evidence`; fast-forward `main` at the **end** of a
session, not the start, or it silently falls behind. Remote is `klarollc/CuckCode`, private, over
HTTPS — SSH has no key registered and `ssh -T git@github.com` fails.

Each verification pass writes its own file — `verification.json` is pass 1, then `pass-N.json`. The
runner used to overwrite one path, which would have replaced the Task 6 assessment with a later one
and erased the record that the component was ever unverified. The brief and the overclaim
cross-check both read the live test inventory through `scripts/phase5-test-inventory.ts` rather than
from `red-evidence.json`, which stopped being the inventory the moment a test was added.

Browser captures route through `tests/support/evidence-output.ts` and nothing else. It writes into
`docs/evidence` only when `CUCKCODE_REGENERATE_EVIDENCE=1`, and `scripts/evidence-immutability.test.mjs`
fails any spec that names the evidence tree directly — committed evidence was silently rewritten by
an ordinary test run twice before (D4-P-001, D4-P-003). Do not add a second capture path; that guard
caught one being added during Task 7.

Playwright and Vitest share `tests/`. `.spec.ts` is Playwright, `.test.ts` is Vitest, and
`playwright.config.ts` now enforces it. Port 4173 is the preview server; a leftover one from an
earlier session will fail `test:e2e` with "already used".

Owner rulings that amend an authored artifact are recorded as an **overlay**, never edited into it —
`surface-contract/amendments.json` carries decision 7-B's two name changes with their reasons, and
the fidelity check refuses to apply an amendment whose stated base no longer matches what the
authored contract says. The Product Designer's artifact records what that role produced on the day it
produced it.

Golden-state capture digests cover the **rendered SVG string**, not the file, which gains an XML
declaration and `xmlns` on write. Hashing a capture directly will not match; a guard reverses the
transform and asserts it does.

---

## What is genuinely proven, stated plainly

Six promoted roles bind, brief identically, run concurrently under packet limits with containment
intact, and behave as **distinct agents** in live use — four proposed, the two reviewer roles
critiqued, unprompted. A complete D-25 round fits in thirteen turns. The domain refuses a malformed
synthesis rather than accepting it. A stopped run is preserved as evidence.

The Test Engineer's Task 6 pass returned **two full, thirteen partial, six none** out of twenty-one,
with **zero overclaims** when cross-checked against what exists. It found gaps in our work, not only
in the missing component. That is the most valuable agent output of the phase, and it is bad news
delivered accurately — which is the behaviour the whole project is an argument for.
