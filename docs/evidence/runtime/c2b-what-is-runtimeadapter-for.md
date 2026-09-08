# C-2b — What is `RuntimeAdapter` for? A recommendation

Status: **Recommendation. Awaiting owner decision. Nothing deleted.**
Prepared 2026-09-08. Follows `c1-provider-neutrality-review.md`.

## The precise shape of the problem

C-1 said `RuntimeAdapter` has no implementation and no consumer. A second grep sharpens it. Of the
runtime contract surface:

| Symbol | Consumed by application code? |
| --- | --- |
| `runtimeBindingReportSchema` / `RuntimeBindingReport` | **Yes** — `persistence/runtime-trust-store.ts` |
| `runtimeCorrelationSchema` / `RuntimeCorrelation` | **Yes** — the Codex normalizer |
| `runtimeRecordSchema` | No — its own contract test only |
| `permissionDecisionSchema` | No — its own contract test only |
| `runtimeIssueSchema` / `RuntimeIssue` | No — nothing, including the normalizer, which returns its own inline issue shape |
| `AdapterResult<T>` | No — referenced only by `RuntimeAdapter`'s own method signatures |
| `RuntimeAdapter` | No |

So this is not one dead symbol. `RuntimeAdapter`, `AdapterResult`, and `RuntimeIssue` form a
**closed cluster that refers only to itself.** Nothing outside it points in.

`runtimeRecordSchema` and `permissionDecisionSchema` are a different case: unconsumed today, but
each encodes a real rule that will bind a future consumer — the nine-kind vocabulary, and
`decidedBy: { kind: "manager" }` which forbids provider-authored permission decisions. Those earn
their place as specifications even while unused.

## Recommendation: delete the closed cluster

Remove `RuntimeAdapter`, `AdapterResult`, and `RuntimeIssue`. Keep everything else.

**Why not extend it instead.** Extending means designing turn execution and event delivery now,
with zero consumers, from imagination. That is exactly how the interface acquired its Codex shape
in the first place: it was derived from one provider rather than from a need. Repeating the method
and expecting a different result is not a plan. The first real consumer is the Task 17 live-kickoff
harness, which does not exist yet; the boundary should be derived from what that harness actually
requires, at the moment it requires it.

**Why not leave it.** An exported interface that nothing implements is a false affordance. It reads
as "the runtime boundary is here" to anyone — including a future agent session — and the boundary
is actually `CodexStdioSupervisor.request()` behind a Codex method allow-list. It also makes the
provider-neutral claim look discharged when it is not.

**What deletion costs.** The MDD's provider-neutral commitment loses its most visible artifact, and
someone reading the contracts will no longer see an obvious seam for a second provider. That cost
is real, and the mitigation is that this document and the C-1 finding stay in the evidence tree:
the claim becomes an open commitment with a recorded reason, rather than a satisfied one with no
substance behind it.

## The middle option, and why I rejected it

`runtime-codex` could implement `RuntimeAdapter` today — `connect` maps to the supervisor's
start-and-handshake, `disconnect` to `stop`, `cancel` to `turn/interrupt`. That would make the
interface exercised for its declared surface at low cost.

It still would not carry turn execution, so no consumer could use a provider through it, and the
indirection would exist solely to make a contract look satisfied. That is worse than either
honest option.

## What this does not decide

Not F3 (`RuntimeCorrelation` carrying Codex's thread/turn/item hierarchy) and not F4 (the
normalizer's inability to express a retryable failure). Both are only answerable once a real
consumer defines what it needs from the boundary. They stay open in the C-1 finding.

## If approved

One commit: delete the three symbols, update the C-1 finding to record the decision, and note in
the Claude-adapter proposal that C-2b is closed and C-3 onward remain unauthorized. No behavior
changes; `verify` must stay green on its own.
