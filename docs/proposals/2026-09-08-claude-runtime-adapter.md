# Specification — second runtime adapter: Claude Code

Status: **C-1 and C-2 complete 2026-09-08. C-3 onward UNAUTHORIZED and now blocked on a
prerequisite that does not exist: there is no runtime boundary to write a second adapter against,
by deliberate decision. Revisit when the first real consumer defines one.**

**C-1 F3 closed 2026-09-28 (owner, housekeeping 3d), no code change.** `RuntimeCorrelation` keeps
Codex's `threadId`, `turnId` and `itemId` as optional fields. The standing rule is unchanged: a
future adapter omits any identifier its provider does not have and never synthesizes one. Nothing
further is needed until a second adapter exists; if one does, F3 is reopened by that work.
Author: Claude (Cowork), at owner request on 2026-09-08.
Authority: MDD D-26 reciprocal usability; Phase 3 provider-neutral runtime contracts.
Triggers the Phase 4 spec stop condition **"provider/tool/external-effect expansion"**, which is
why this exists as a specification rather than as work already underway.

## 1. Why

`RuntimeAdapter` is declared in `packages/contracts/src/runtime.ts` and has exactly one
implementation: `packages/runtime-codex`. A provider-neutral runtime with one provider is an
untested claim. Nothing has ever forced the interface to be neutral, so any place it has quietly
absorbed a Codex assumption is currently invisible.

The immediate driver is narrower and concrete. D-25 gives the Release Reviewer the job of
independent dissent. Six instances of one model sharing one briefing are correlated by
construction: if the Release Reviewer never dissents, the record cannot distinguish "nothing to
dissent about" from "same model, same conclusion." A second vendor makes that role's dissent mean
something.

**Both reasons are worth stating because they justify different scopes.** The first justifies a
full second adapter. The second alone would be satisfied by two Codex models. The owner chose the
adapter on 2026-09-08.

## 2. What it is

A `packages/runtime-claude` workspace implementing `RuntimeAdapter`, structurally mirroring
`runtime-codex`: a stdio supervisor over a locally spawned process, a normalizer producing
`NormalizedRuntimeEvent`, and a pinned provider version.

Transport is the same shape as Codex, which is what makes this tractable: `claude -p` with
`--output-format stream-json` emits newline-delimited JSON events on stdout, with a terminal
`result` message carrying the final text, cost, and session id. The app never holds provider
credentials; the CLI does. Multi-turn continuation uses `--resume <session_id>` rather than a
long-lived duplex channel.

### Not in scope

- Any change to `RuntimeAdapter` itself without a recorded reason. **If the interface needs to
  change to admit a second provider, that is the single most valuable finding of this work and it
  gets its own entry in the dogfood register.**
- Tool use, file access, or shell access of any kind. See §4.
- Replacing Codex. Six roles remain on Codex; this adapter serves the Release Reviewer.

## 3. Conformance obligations

A second adapter is only worth building if it is held to the same bar. It must pass the existing
suites, unchanged:

- `packages/testing/src/runtime-fake.contract.test.ts` — byte-equivalent output for a fragmented
  schedule; duplicate and unknown responses visible without inventing progress; malformed and
  oversized lines rejected; stderr never becomes lifecycle progress; stdout after disconnect
  rejected.
- `packages/contracts/src/runtime.contract.test.ts` — no event without runtime correlation, no
  secret-bearing record, no provider-authored permission decision.
- `runtimeBindingReportSchema` — including `authMode`, `model`, `capabilityIds`, `toolIds`,
  `permissionCeiling`, `materialFingerprint`, and `status: "candidate"`.

**`authMode` needs a new value.** The enum is `chatgpt | api_key_managed | none`. Claude Code in
`--bare` mode never reads OAuth credentials or the keychain and requires `ANTHROPIC_API_KEY`, so
`api_key_managed` is arguably correct already — but `chatgpt` is a vendor-specific member of a
supposedly neutral enum, which is itself evidence about the interface's neutrality. Decide
deliberately; do not widen the enum by reflex.

**`model` must be read back, not asserted.** The `system/init` event reports the model the session
actually used. The binding report records what the runtime said, never what we asked for. A
requested model that differs from the reported one is a drift condition and stops the run.

## 4. The hard problem: text-only is not the default

Task 17 requires "no tool, connector, file, shell, search, image, deployment, messaging, or other
external effect." Codex is constrained by `--strict-config` and an allow-list of five request
methods.

Claude Code is not equivalent out of the box. **In `--bare` mode Claude still has Bash, file read,
and file edit tools available.** `--permission-mode dontAsk` denies anything outside the
permission rules *except a read-only command set*, which is still a shell surface.

This is the specification's central risk and it must be closed by evidence, not by configuration
confidence:

1. Compose the strictest available configuration — `--bare`, `--permission-mode dontAsk`,
   `--permission-prompts none`, no `--allowedTools`, no `--mcp-config`, no `--add-dir`.
2. **Prove it.** A test that runs the adapter against a prompt explicitly instructing the model to
   read a file and run a command, and asserts that no `tool_use` block of any kind appears in the
   stream and that the named file was never opened. A configuration believed to be text-only is
   not evidence that it is.
3. If any tool surface survives, the adapter records the residual surface in
   `toolIds`/`permissionCeiling` truthfully rather than claiming `[]`. **An adapter that reports
   an empty tool list it has not proven is a V0 truthfulness violation by this project's own
   standard.**

`--permission-prompts none` also matters for a second reason: unattended denial without retry.
Nobody is present to answer a prompt mid-kickoff.

## 5. Version pinning

`runtime-codex` pins protocol `0.146.0` with a checked bundle and a drift test. Claude Code's
stream-json surface is version-gated feature by feature — `capabilities` on `system/init` from
v2.1.205, `mcp_server_errors` from v2.1.219, `--permission-prompts` from v2.1.259, and others.

The adapter pins an exact `claude` version, records it in the binding report as
`adapterVersion`/`protocolVersion`, and fails closed on mismatch. Prefer the `capabilities` array
on `system/init` over version-string comparison where both are available.

## 6. Determinism and the fake

`DeterministicRuntimeFake` is the conformance harness and stays provider-neutral. The Claude
adapter is tested against the same fake with a Claude-shaped schedule. Live runs remain a
separately gated, opt-in integration test mirroring `codex-live.integration.test.ts`, which is
skipped by default.

Costs and token counts in the `result` message are client-side estimates. They may be recorded as
observations; they are never evidence of anything.

## 7. Proposed task breakdown

Sized to be individually gated, as usual.

1. **C-1 Contract review.** ~~Determine what, if anything, `RuntimeAdapter`, `authMode`, and
   `RuntimeCorrelation` need in order to admit a non-Codex provider.~~ **DONE 2026-09-08.**
   Finding: `docs/evidence/runtime/c1-provider-neutrality-review.md`. `RuntimeAdapter` has no
   implementation and no consumer, and omits the operation an adapter exists to perform, so the
   neutrality claim is unexercised rather than untested. **C-2 through C-6 below are superseded
   pending an owner decision on C-2a and C-2b named in that finding.**
2. **C-2 Supervisor.** Spawn, handshake, NDJSON framing, line-size limits, stderr isolation,
   post-disconnect rejection, SIGINT versus SIGTERM (143), exit-code handling.
3. **C-3 Normalizer.** `system/init`, `assistant`, `result`, `system/api_retry` → typed events.
   Retry error categories map to `RuntimeIssue` with correct retryability.
4. **C-4 Text-only enforcement and its proof.** §4. The adversarial test is the deliverable.
5. **C-5 Binding and trust.** `RuntimeBindingReport` with read-back model, pinned version,
   truthful `toolIds`, `authMode` decision applied.
6. **C-6 Conformance.** Full existing suites green against the new adapter, plus an opt-in live
   test skipped by default.

Tasks 1 and 4 carry the real risk. 2, 3, 5, 6 are mechanical against a known shape.

## 8. What approving this does not authorize

Not Phase 4 Task 17, not the live kickoff, not role promotion, not Phase 5, not high-fidelity art,
and not any change to `RuntimeAdapter` — §7's C-1 produces a finding for separate decision.

Approving authorizes C-1 only. Each subsequent task needs its own approval, per the standing gate.

## 9. Argument against building this

Six roles on one model, with the Release Reviewer's non-dissent recorded as **uninformative rather
than as agreement**, is honest and costs nothing. That handling is already required by this
project's truthfulness rules, so the correlation problem has a zero-cost mitigation that does not
delay the live kickoff.

Against that: the provider-neutral claim is currently untested, and a second adapter is the only
thing that tests it. The interface has never been forced to be neutral, so the finding from C-1
alone may justify the work regardless of whether the Release Reviewer ever runs on Claude.

If the owner wants the live kickoff sooner, the correct order is Task 17 on six Codex roles with
the limitation recorded, then this adapter, then a second kickoff that contrasts the two.
Sequencing this adapter first delays the live kickoff by the full C-1 through C-6 span.

## Sources

Claude Code headless and CLI behaviour in §2, §4 and §5 is drawn from the current Claude Code
documentation, retrieved 2026-09-08: https://code.claude.com/docs/en/headless
