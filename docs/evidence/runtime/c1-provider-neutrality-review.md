# C-1 — Can `RuntimeAdapter` admit a non-Codex provider?

Status: **Finding. No code written. No contract changed.**
Performed 2026-09-08 against `35d241f`, authorized as C-1 of
`docs/proposals/2026-09-08-claude-runtime-adapter.md`.

## Answer

The question cannot be answered as asked, because **`RuntimeAdapter` has no implementation and no
consumer.** It is declared once and referenced nowhere else in the source tree:

```
packages/contracts/src/runtime.ts:92:export interface RuntimeAdapter {
```

That is the complete set of matches across `packages/*/src` and `apps/*/src`. `runtime-codex` does
not implement it. Nothing calls it. `@cuckcode/runtime-codex` is not a dependency of any workspace
package.

So the provider-neutral claim is not *untested*. It is **unexercised**: no provider has ever been
used through this interface, including the one that exists.

**This is not a defect in Phase 3.** Phase 4 is a deterministic graybox and was never meant to
drive a live runtime; that the application does not yet consume the runtime layer is the expected
state. The finding is narrower and it matters for the decision at hand: building a second adapter
against this interface would not test the neutrality claim, because the interface does not carry
the operation an adapter exists to perform.

## F1 — The interface omits the load-bearing operation

`RuntimeAdapter` declares `connect`, `cancel`, and `disconnect`. It has no way to start a turn,
send a prompt, or receive events.

The thing an adapter is *for* — run a turn, get attributable output back — lives in
`CodexStdioSupervisor.request(method, params)`, gated by a Codex-specific allow-list:

```ts
const ALLOWED_REQUEST_METHODS = new Set([
  "account/read", "thread/start", "turn/start", "turn/interrupt", "thread/read",
]);
```

Any consumer that wants to actually use a runtime must reach past `RuntimeAdapter` into the
Codex-shaped supervisor. `RuntimeAdapter` is neutral in the way an empty room is tidy.

**Consequence for this work stream:** C-2 through C-6 as specified would produce a second
supervisor and normalizer that are just as unreachable as the first. Two unused adapters do not
test neutrality better than one.

## F2 — The neutral vocabulary lives inside the provider package

`NormalizedRuntimeEvent` and `NormalizationContext` — the provider-independent event shape every
adapter must produce — are declared in and exported from `packages/runtime-codex/src/normalizer.ts`.

A Claude adapter must therefore either depend on `@cuckcode/runtime-codex` to obtain the neutral
type, or duplicate it. The first makes the second provider a client of the first; the second
guarantees eventual drift. Neither is acceptable, and the fix is mechanical: the shared vocabulary
belongs in `contracts` (or `domain`), and `runtime-codex` should import it like any other adapter.

`runtimeRecordSchema.kind` in `contracts` already lists the same nine kinds. **The vocabulary is
currently declared twice — once neutrally in `contracts`, once inside the Codex package — with no
mechanism keeping them equal.**

## F3 — `RuntimeCorrelation` encodes Codex's hierarchy

```ts
{ bindingId, providerRunId, providerRequestId, threadId?, turnId?, itemId? }
```

`thread`, `turn`, and `item` are Codex App Server vocabulary. Claude Code's stream-json surface has
a `session_id` and per-message `uuid`s; **there is no turn identifier.** Turns are implicit
boundaries between a prompt and its `result` message.

The three fields are optional, so a Claude adapter can legally omit `turnId`. But consumers written
against Codex will expect it, and the tempting fix is to synthesize one. **An adapter inventing an
identifier to satisfy a schema shaped by a different provider is fabricated provenance in a
canonical record** — precisely the class of thing this project treats as V0. If `turnId` is needed,
it must come from the provider or be absent; it must never be manufactured.

## F4 — The normalizer cannot express a retryable provider event

`normalizeCodexEvent` returns exactly two failure codes, both hardcoded `retryable: false`:

```ts
"UNSUPPORTED_PROVIDER_EVENT" | "MALFORMED_PROVIDER_EVENT"
```

Meanwhile `RuntimeIssue` and `AdapterResult` both carry `retryable`, so the surrounding contracts
clearly anticipate retryable failures. Claude Code emits `system/api_retry` with an `error`
category (`rate_limit`, `overloaded`, `server_error`, `authentication_failed`, …) that is
inherently retryable. A Claude normalizer has nowhere truthful to put it.

## F5 — `authMode` names a vendor

```ts
authMode: z.enum(["chatgpt", "api_key_managed", "none"])
```

Claude Code in `--bare` mode requires `ANTHROPIC_API_KEY` and never reads OAuth or the keychain, so
it maps cleanly to `api_key_managed` and **no change is forced.** Recorded because a vendor name in
a supposedly neutral enum is evidence about how the interface was actually derived: from one
provider, not from the general case.

## F6 — A third canonicalization implementation

`normalizer.ts` computes `evidenceHash` with a private `canonical()` plus
`JSON.stringify`, rather than `stableStringify` from `@cuckcode/domain`.

This is the same defect class fixed in `kickoff-store.ts` earlier today: a second implementation of
"canonical form" that can drift from the first. Here the stakes are higher — the output is an
evidence hash, so divergence would silently produce different hashes for identical events.
Recorded, untouched, out of scope for C-1.

## Recommendation

**Do not proceed to C-2 as specified.** A second supervisor and normalizer built now would be
unreachable, would have to import their shared vocabulary from the first provider's package, and
would test nothing about neutrality.

Proposed replacement for C-2, for owner decision:

- **C-2a — Move the shared vocabulary.** `NormalizedRuntimeEvent` and `NormalizationContext` to
  `contracts`, reconciled with `runtimeRecordSchema.kind` so the nine kinds are declared once.
  Mechanical, low risk, and required by any second adapter. Closes F2.
- **C-2b — Decide what `RuntimeAdapter` is for.** Either extend it to carry turn execution and
  event delivery, or delete it and admit the runtime boundary is the supervisor. **Both are
  defensible; the current state is not, because it presents an interface that cannot be used.**
  Closes F1 and settles F3 and F4, which are only answerable once the boundary is real.

Neither requires a Claude adapter to exist. Both are prerequisites for one meaning anything.

## What this does not say

It does not say the Phase 3 runtime work was wrong. The supervisor, normalizer, protocol pin, and
conformance fake are real and tested. It says the *contract layer above them* was written from one
provider and has never been exercised, and that a second adapter is the wrong instrument for
discovering that — a five-minute grep was sufficient, and no live provider call was needed.
