# Phase 5 Task 8 — the shared-knowledge scenario

Built 2026-09-14. Contribution, retrieval and conflict resolution exercised against MDD section 15
and passing. **No agent turns were spent; the ledger stays at 4 of 60.**

---

## The scenario is a disagreement that actually happened

The gate asks for contribution, retrieval and conflict resolution "exercised and passing". Two agents
invented for the occasion, disagreeing about a fictional subject, would exercise every line of the
code and prove nothing about the project.

So the scenario is assembled from the real record. The Test Engineer's two verification passes
reached **different conclusions about the same four acceptance criteria**, days apart:

| Subject | Pass 1 said | Pass 2 said |
| --- | --- | --- |
| C-06 | partial | full |
| C-12 | full | partial |
| C-14 | partial | full |
| C-20 | none | partial |

Nothing in that table is authored for the scenario. `scripts/build-phase5-knowledge-scenario.ts`
reads both passes, **discovers** which criteria they disagree about rather than being told, and emits
one knowledge record per claim. The sources are recorded by digest, so a scenario built from a
superseded version of its inputs fails rather than quietly describing a disagreement that no longer
exists.

---

## What the three steps demonstrate

**Contribution.** Eight records, each requesting `authoritative`, each landing `provisional`, each
raising `AGENT_FINDING_REQUIRES_PROMOTION`. Role seniority, repeated assertion and apparent
confidence do not promote a record — the Test Engineer is the project's most reliable reviewer and
its findings still enter as working knowledge.

**Retrieval.** Asking about C-06 before anyone settles it returns both claims, each with its
lifecycle label and its source locator. After the resolution it returns one, and reports the other as
an **omission naming its replacement**. A retrieval that dropped the superseded record would be
indistinguishable, to its reader, from a project in which that record never existed.

**Conflict resolution.** Four conflicts open, four resolved, and **all four retained** with the
resolution that settled them. A subsystem where settled disputes disappear cannot answer the question
that matters later: what the project used to believe, and who decided otherwise.

---

## What was built, and what it refuses

`packages/domain/src/knowledge-retrieval.ts` is new. The contribution half of section 15 already
existed — findings enter provisional, manager transitions are authorized, supersession names its
replacement. Retrieval and conflict surfacing did not exist at all.

Three refusals are worth naming, because each is a way this subsystem could have looked correct:

- **Promotion alone never settles a dispute.** Marking one record authoritative while a contradicting
  record is still live leaves the loser in the project, still retrievable, and now outranked by
  something that never addressed it. That is the silent merge section 15 forbids, and the conflict
  stays open until the losing claim is explicitly superseded or rejected.
- **A synthesis is never counted as a competing claim.** It cites its inputs and does not outrank
  them. Counting it as a rival would manufacture a conflict out of an agreement — one claim plus a
  synthesis of it would read as a project divided against itself by the record that exists to
  summarise it. A synthesis citing a record nobody contributed is reported, not accepted.
- **Half a citation list is not half a synthesis.** A partly-readable `synthesisOf` is refused
  entirely, because keeping the readable entries would leave a record claiming to summarise inputs it
  never named.

**Stale is returned, not withheld.** Stale means "its source changed", not "it is wrong", and the
reader is the one positioned to revalidate it. Only `rejected` and `superseded` are withheld, and
both are reported.

---

## Mutation testing

Seven mutants, all killed. Two survived the first run, and both were real holes rather than weak
mutants: nothing asserted that a synthesis is excluded from the competing claims, and nothing
asserted that a partly-readable citation list is refused. Both behaviours were deliberately designed
and neither was pinned. Two tests closed them.

---

## How to run it

```
npm run phase5:knowledge     # rebuild the scenario from the two passes
npm run test:knowledge       # the gate condition, now part of npm run verify
```

The gate test is in `verify`, so a verification pass that changes makes the scenario stale and the
gate red until it is rebuilt.

---

## What this does not claim

It does not claim the roles used shared knowledge during Phase 5 — they did not; the subsystem did
not have retrieval until today. It replays their recorded disagreement through the subsystem that
should have carried it. That is a demonstration the subsystem works, and an argument for wiring the
roles through it, not evidence that they were.
