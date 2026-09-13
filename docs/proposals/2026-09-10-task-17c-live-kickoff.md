# Task 17c — The supervised live kickoff

**Status: proposed, not approved. Nothing here has been implemented and no provider call has been
made beyond the existing single-turn contract probe.**

Author: agent, 2026-09-10. Requested by the owner on 2026-09-09 ("C. approved").

Task 17a (the binding report) and 17b (the bounded orchestrator, as amended) are complete and
committed. This document covers what stands between them and one supervised live run of the D-25
kickoff on the owner's machine.

---

## 1. What already exists

Verified by reading the tree, not assumed.

- **Process supervision and handshake** — `packages/runtime-codex/src/supervisor.ts`. Working;
  `start()` returns `codexHome`, `platformFamily`, `platformOs`, `userAgent`.
- **Auth mode read-back** — `supervisor.readAccountStatus()`. Returns `chatgpt` or
  `api_key_managed`, or `AUTH_REQUIRED`.
- **Method allow-list** — `ALLOWED_REQUEST_METHODS` in `supervisor.ts`. Five methods; `request()`
  throws `METHOD_NOT_ALLOWED` for anything else.
- **One live turn, end to end** — `packages/runtime-codex/src/codex-live.integration.test.ts`.
  Skipped unless `CUCKCODE_LIVE_CODEX=1`; proves one text-only turn returns and carries no
  forbidden item types.
- **Binding report construction** — `packages/runtime-codex/src/binding.ts`. Unit-tested against
  fixtures.
- **Preconditions** — `packages/domain/src/kickoff-preflight.ts`. Unit-tested; collects every
  failure rather than returning the first.
- **Bounded orchestration** — `packages/application/src/kickoff-run.ts`. Unit-tested; stops rather
  than repairs.
- **Binding persistence** — `createRuntimeTrustStore(...).appendBinding`. Working; validates the
  report and refuses credential-shaped data.
- **Agent registration** — `...registerAgent`. Working.
- **Promotion planning** — `scripts/promote-roles.mjs`. `planPromotion`, `planRevocation`,
  `promotedRoleIds` and `writePromotionRecord` all exported and tested.

That is more than half the machine. What is missing is not the hard part conceptually — it is the
part that touches reality, which is exactly where the remaining unknowns are.

---

## 2. What does not exist

### G1 — Nothing reports which model ran. **This is the blocking unknown.**

`buildBindingReport` requires `facts.reportedModel` and refuses the binding with `MODEL_DRIFT` when
it differs from what was requested. That check is the reason the Task 16 packet records a model per
role at all.

But the handshake does not return a model. `initialize` returns `codexHome`, `platformFamily`,
`platformOs` and `userAgent`, and nothing else. `account/read` returns an auth mode. Neither names
a model. The live probe does not set a model on `thread/start`, and does not read one back.

**The tempting shortcut is a defect, not a shortcut.** Filling `reportedModel` from
`expected.requestedModel` would make `buildBindingReport` compare the request against itself. The
drift check would pass unconditionally and prove nothing, while reading in the log and in the
binding record as though the model had been verified. That is the same vacuous-guard shape as C-1
finding F2 (a guard carrying its own copy of what it guards) and as the promotion CLI problem in
§G4 below. Three instances now; it is a pattern worth naming.

So there are exactly two honest outcomes:

- Codex reports the model somewhere — in the `thread/start` result, in `turn/completed`, or in a
  notification — and `HandshakeFacts` reads it from there.
- Codex does not report it, in which case `RuntimeBindingReport.model` cannot be populated
  truthfully, and either the field admits it is unobserved or the binding is refused. **It must not
  be filled in from the request.**

Which of those is true is an empirical question, and one live probe answers it.

### G2 — Nothing observes the tool surface at binding time

`buildBindingReport` refuses a binding whose session exposes any `toolIds` or `permissionCeiling`,
and one of its tests exists specifically so that `toolIds: []` in a returned report means *the
session was observed to expose none*, not that nobody looked.

Nothing currently looks. The live probe inspects `turn.items` for forbidden item types **after a
turn has already run**, which is a different claim at a different time. Passing `toolIds: []` into
`buildBindingReport` from a handshake that never enumerated a tool surface would be precisely the
lie that test was written to prevent.

This one is closer to answerable than G1: either the session declares a tool surface that can be
read, or the binding is built after a bounded probe turn and the report says the surface was
observed at that point rather than at handshake.

### G3 — The protocol pin exists in three places

`supervisor.ts` hardcodes `/0\.146\.0/u` inside `isInitializeResult`. `buildBindingReport` compares
`facts.userAgent` against `expected.protocolVersion`, supplied by the caller.
`scripts/check-codex-protocol.mjs` reports `0.146.0` from the bundle manifest.

Three copies of one fact. The C-1 F2 rule says a guard asserts against the definition it guards,
never a copy. Today a protocol bump would require finding all three, and the two that were updated
would keep passing while the one that was missed silently stopped meaning anything.

### G4 — Promotion has no executable command, and the obvious one would be vacuous

`npm run roles:promotion:status` reads and reports; it never writes. Nothing joins `planPromotion`
to `writePromotionRecord`.

Wiring a CLI that reads `requested` from `roles/manifest.json` would compare the manifest against
itself, so `PROMOTION_DRIFT` could never fire. The drift guard only means something if `requested`
is a frozen record of what the owner actually approved — the digest table in the owner-approved
Task 16 preflight packet, at commit `ebe9c99`.

### G5 — No harness joins the pieces

Nothing calls `checkBindingPreconditions`, then builds six bindings, then persists them, then calls
`runBoundedKickoff`. `test:live:codex` is a single-turn probe against one throwaway thread.

---

## 3. Proposed sequence

Each step is separately committable, and each behavioural one gets its own RED before
implementation. **Cheapest instrument first**: the step that costs one command runs before the step
that costs a day.

### 17c-1 — A read-only live probe that answers G1 and G2

Extend the existing live spec, or add a sibling gated the same way, that starts a session, opens a
thread, runs one bounded text-only turn, and **prints the redacted shape** of the initialize
result, the `thread/start` result, and the `turn/completed` notification.

No new abstractions, no new production code. The deliverable is knowledge: does anything in that
traffic name a model, and does anything enumerate a tool surface. Output goes into the evidence
directory with credentials redacted by the supervisor's existing `redact`.

Cost: one live turn. Everything downstream depends on the answer, and no amount of design replaces
it.

### 17c-2 — Freeze the approved promotion request, then give promotion a command

Extract the six role digests from the owner-approved Task 16 packet into
`roles/promotion-request.json`, committed, with a test asserting the frozen file matches the packet
it came from. Then `npm run roles:promote` reads the frozen request, compares it against the live
manifest through `planPromotion`, and writes `roles/promotions.json` only on `ok`.

The test that carries this: **change the manifest, leave the frozen request alone, and promotion
must refuse with `PROMOTION_DRIFT` naming the drifted roles.** That test is impossible to pass if
the CLI reads its request from the manifest, which is the point.

The owner runs the promotion. The agent does not.

### 17c-3 — One protocol pin

A single exported constant. `supervisor.ts` asserts against it instead of a literal; the harness
passes it as `expected.protocolVersion`; a guard test asserts the bundle manifest agrees. Small,
and it removes a whole class of silent-drift failure before the live run rather than after.

### 17c-4 — `collectHandshakeFacts`

A function in `runtime-codex` that turns a live supervisor into `HandshakeFacts`, populating every
field **only from something observed**, and refusing rather than defaulting when a fact is not
available. Its shape depends on what 17c-1 finds, so it is specified after that step, not before.

### 17c-5 — The kickoff harness

Registers six agents, builds six bindings through `collectHandshakeFacts` and `buildBindingReport`,
persists each with `appendBinding`, runs `checkBindingPreconditions`, and only then calls
`runBoundedKickoff` with a `TurnRunner` backed by the supervisor. Gated behind its own environment
variable, separate from `CUCKCODE_LIVE_CODEX`, so a live kickoff can never start as a side effect
of running the single-turn probe.

Six supervisor sessions, one per role, since each binding is a distinct agent identity.

### 17c-6 — The run and its write-up

One supervised run on the owner's machine. Evidence recorded whatever the outcome, including a
failed or under-filled round — under the amended orchestrator, an under-filled round is a result,
not a wasted run.

---

## 4. What the live run will and will not establish

**Will:** that the machine survives contact with a real runtime; that a binding can be built from
observed facts; that six distinct agent identities can be bound and persisted; that a bounded round
either completes in thirteen turns or stops for a stated, attributable reason.

**Will not:** anything about the quality of what six agents say to each other. A round that
completes is evidence the *mechanism* works. Whether the resulting synthesis is any good is a
separate question that one run cannot answer, and the write-up must not conflate them.

Nor will it validate the office UI, which is where the owner has said failures actually surface for
him. That remains a gap this task does not close.

---

## 5. Risks

- **G1 may have no good answer.** If Codex never reports a model, the honest options are a report
  that records the model as unobserved, or no binding at all. Both are worse than what the packet
  implies, and the packet would need amending. Discovering that early is the whole reason 17c-1 is
  first.
- **Six sessions may not behave like one.** Everything proven so far involves a single supervisor.
  Concurrency, per-session auth, and process cleanup across six children are untested.
- **The 13-turn budget is not cheaply repeatable**, so the run should not be the place where
  avoidable problems are discovered. 17c-1 through 17c-3 exist to move those discoveries earlier.
- **`roles/promotions.json` is an approval artifact.** Once written it is the record of what the
  owner authorised. It should be committed deliberately, and revocation — which already requires a
  stated reason — is the only way back.

---

## 6. Approval requested

1. The sequence in §3, or a cut of it. 17c-1 is cheap and unblocking; 17c-3 could be deferred; the
   rest are load-bearing.
2. Confirmation that the agent writes `roles/promotion-request.json` and the promote command, and
   that **the owner runs the promotion**.
3. A ruling reserved, not requested now: what a binding report should say if 17c-1 shows the model
   is never reported. Better decided with the answer in hand.
