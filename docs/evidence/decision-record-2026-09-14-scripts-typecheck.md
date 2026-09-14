# Decision record — the two errors `typecheck:scripts` reports, and the gate

Status: **ALL FOUR RULED BY THE OWNER 2026-09-14.** Requested and ruled in the same session, then
implemented in the same pass.

| Decision | Ruling |
| --- | --- |
| S-A fix the dropped `roleId` in `scripts/run-phase4-kickoff.ts` | **Yes, via `candidate.roleId`** |
| S-B record a correction beside the two shipped Task 17 run artifacts | **Yes — one overlay file covering both attempts** |
| S-C apply the `exactOptionalPropertyTypes` fix in `scripts/build-phase6-golden-states.ts` | **Yes, apply it** |
| S-D wire `npm run typecheck:scripts` into `npm run verify` | **Yes, immediately after `typecheck`** |

Both defects sit in completed phases — Phase 4 and Phase 6 — so neither was touched before these
rulings. This record is the ruling; the code changes and the correction overlay were made after it.

## How this was found

`scripts/` was never in the tsconfig project graph, so `npm run typecheck` has never covered a single
file in it. `tsconfig.scripts.json` and `npm run typecheck:scripts` were added on 2026-09-14 to make
it visible, and were deliberately held out of `verify` because they reported exactly two errors, both
in completed phases:

```
scripts/run-phase4-kickoff.ts(228,26): error TS2339: Property 'roleId' does not exist on type '{ bindingId: string; ... }'
scripts/build-phase6-golden-states.ts(54,3): error TS2375: Type '{ ...; work: { state: string; } | undefined; ... }' is not assignable to type 'SceneState' with 'exactOptionalPropertyTypes: true'
```

The first is a shipped defect. The second is type-only.

---

## S-A — the dropped `roleId`

The run record's `bindings` projection wrote `roleId: report.roleId`. `runtimeBindingReportSchema`
(`packages/contracts/src/runtime.ts`) is `.strict()` and declares no `roleId`, so the value was
`undefined` and `JSON.stringify` dropped the key. Both committed Task 17 artifacts record six
bindings carrying only `agentId`, `model`, `reasoningEffort`, `protocolVersion`,
`materialFingerprint` and `createdAt`. **The record does not say which role each binding was for.**

Nothing read the field. No provider turn, no binding admission, no preflight check and no domain
decision depends on it — the round ran as recorded. What was lost is the run record's own statement.

`roleId` was available at that point in two places, both discarded:

1. **`providerIds.threadRole`.** `appendBinding` is handed `{ report, providerIds, createdAt }`
   (`packages/application/src/kickoff-harness.ts`), and the script sets
   `providerIds: { threadRole: roleId }`. The inline callback destructured only `{ report, createdAt }`.
2. **`candidate.roleId`.** `BindingCandidate` (`packages/domain/src/kickoff-preflight.ts`) carries
   `roleId`, built by `buildKickoffPreflightInput`. Each prepared binding holds its candidate, and
   `runPreflightedKickoff` refuses the round unless `candidate.agentId`/`bindingId` equal the
   report's — so a join on `bindingId` is exact by construction rather than by convention.

**Ruled: take it from the candidate.** `providerIds` is a free-form provider-identity map whose job
in the persistence store is impersonation detection; the candidate is the record that joins a runtime
session to a role contract, which is what this field is asserting. The script now resolves the role
at the moment the binding is appended and throws `BINDING_ROLE_UNRESOLVED` rather than recording an
unattributed binding.

**Considered and rejected: adding `roleId` to `runtimeBindingReportSchema`.** It would fix the class
of bug, but it changes a Phase 4 contract and the `report_json` column
`packages/persistence/src/runtime-trust-store.ts` writes — a behaviour change in a completed phase to
repair a script-local reporting bug. Nothing in `packages/` was changed.

**What the fix does and does not do.** It changes what a *future* Phase 4 live run records. It
rewrites no existing evidence, and no future Phase 4 live run is authorized.

## S-B — the correction beside the shipped artifacts

**Ruled: one overlay file covering both attempts.**
`docs/evidence/phase-4/live-kickoff/task-17-run/correction-2026-09-14-binding-roleid.json` states the
defect, pins each artifact by sha256, and records the six-row `agentId` → `roleId` mapping recovered
for each. Neither `run-attempt-1.json` nor `run-attempt-2.json` is edited: accepted artifacts record
what was produced on the day they were produced, and corrections are recorded beside them.

**The loss is recoverable from inside each file, and the correction says so rather than only saying
something was lost.** Every binding's `agentId` appears in the same file's `transcript[]` paired with
its `roleId` — six for six in both attempts — and `agentIdFor` derives `agentId` from `roleId` as
`agent_${roleId.replace(/-/g,"_")}`, which every recovered pair matches.

**Stated as a limit in the overlay itself:** this is a join *inferred* from `agentId`, not a
statement recorded in the binding row. It is exact for these two runs because all six agentIds are
distinct and every one appears in the transcript. It is not a general substitute for the field.

The overlay is appended to the provenance ledger in the same pass, with a producer rule naming it, so
it does not land as another `producerKind: unknown`.

## S-C — the Phase 6 type-only fix

`sceneStateFrom` returned `work` as `{ state: string } | undefined` into `SceneState.work?:
{ state: string }`. The renderer tests it with `if (scene.work)`, so an omitted key and an explicit
`undefined` are identical at runtime; only `exactOptionalPropertyTypes` distinguishes them.

**Ruled: apply it.** `return { agentStates, collaborationParticipants, ...(work ? { work } : {}) }`.

**Proven a no-op before the change was made.** All five golden states were rendered at both approved
viewports under both shapes, in memory, writing nothing: **10 captures compared, 0 differing
digests.** All five states contain a work descriptor, so `work` is never actually `undefined` with
the frozen fixtures — the error was latent. No committed Phase 6 evidence was regenerated or touched.

## S-D — the gate

**Ruled: wire `npm run typecheck:scripts` into `npm run verify`, immediately after `npm run
typecheck`,** so a script type error fails beside the package type error it belongs with rather than
after the build and browser stages. `tsconfig.scripts.json` is amended in the same pass so its
header no longer says it is deliberately excluded.

`npm run typecheck:scripts` reports no errors as of this record.

## What this does not authorize

Nothing beyond the four items above. It does not authorize a Phase 4 live rerun, Phase 6
regeneration, Phase 7, deployment, any external effect, or any change to `packages/`.
