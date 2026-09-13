# Task 17c-1 — What the Codex runtime actually reports

Run 2026-09-11 on the owner's machine, `CUCKCODE_LIVE_CODEX=1`, codex-cli 0.146.0, subscription
auth. One bounded read-only turn against an ephemeral thread in a temp directory. The turn
completed and returned `CUCKCODE_PROBE_OK` with a single `agentMessage` item.

This probe asserts almost nothing. Its output *is* the result.

## The two questions it was built to answer

### Q1 — Does anything report which model ran? **Yes, at `thread/start`.**

```
.model = "gpt-5.6-terra"
.modelProvider = "openai"
.serviceTier = "default"
.reasoningEffort = "high"
```

Not in `initialize`, which returns only `userAgent`, `codexHome`, `platformFamily`, `platformOs`.
Not in `account/read`, which returns an auth mode. `thread/start` is the only source.

So `MODEL_DRIFT` in `buildBindingReport` is enforceable against an observed fact, and
`HandshakeFacts.reportedModel` has an honest origin. The shortcut of filling it from the requested
model — which would have compared the request against itself and passed unconditionally — is not
necessary and must not be taken.

**The observed defaults are not what was approved.** The Task 16 packet approved `gpt-5.6-luna` at
`medium` for five roles and one. A default thread got `gpt-5.6-terra` at `high`. Both the model and
the effort differ. A binding built against packet expectations would have been refused on
`MODEL_DRIFT` at the first role, correctly. The harness must pass model and effort explicitly on
`thread/start` and compare the response, rather than accepting the runtime's defaults.

### Q2 — Does anything enumerate a tool surface? **No.**

No key anywhere in `initialize`, `thread/start`, `turn/completed` or `thread/read` lists tool
identifiers. What `thread/start` reports instead is a bounds description:

```
.sandbox.type = "readOnly"
.sandbox.networkAccess = boolean(false)
.approvalPolicy = "never"
.approvalsReviewer = "user"
.activePermissionProfile = object(null)
.multiAgentMode = "explicitRequestOnly"
```

These are restrictions, not exposures, and that distinction collides with the binding contract as
written. `buildBindingReport` refuses a binding when `toolIds` or `permissionCeiling` is non-empty,
treating both as things the session exposes. Populating `permissionCeiling` from the values above
would refuse every binding. Leaving it empty would claim an observation nobody made — precisely
what the test "never reports an empty tool list it did not observe" exists to prevent.

**`toolIds: []` cannot be claimed for this adapter, because this adapter does not enumerate a tool
surface.** Recorded as an unresolved contract question, not as a defect in the probe.

## What the probe found that it was not looking for

### An unpinned instruction source participates in every thread

```
.instructionSources = array(1)
.instructionSources[0] = "C:\Users\nater\.codex\AGENTS.md"
```

The runtime names a file in the owner's Codex home as an instruction source for the thread. **Its
contents have not been examined** — it sits outside the connected folder, in a directory that also
holds provider credentials, and the agent did not request access to it.

The significance is structural rather than dependent on its contents. Role promotion exists to pin
exactly what instructions a role runs under: source digest, overlay digest, all-or-nothing,
drift-checked, folded into the binding's material fingerprint. This file is none of those, and it
applies to every thread regardless of role. Six roles intended as six distinct pinned contracts
would share one uncontrolled instruction input that no part of the system accounts for.

Recorded as DF-010.

### `thread/read` does not return a completed turn

After the turn completed, `thread/read` returned `.thread.turns = array(0)`, with `createdAt`
having moved from 1789093926 to 1789093933. For an ephemeral thread it is not a transcript source.
The `turn/completed` notification is the only place the turn's items appeared.

The harness must record from `turn/completed` and must not treat `thread/read` as a way to recover
what was said.

### Minor observations

- `userAgent` is
  `"CuckCode/0.146.0 (Windows 10.0.26200; x86_64) WindowsTerminal (CuckCode; 0.0.0)"`.
  It carries the protocol pin, and `versionOf`'s first-match regex extracts `0.146.0` rather than
  the trailing `0.0.0`. Correct today, but it is correct by ordering rather than by construction.
- `.thread.source = "vscode"` for a thread started over stdio by this project. Cosmetic, but it
  means thread provenance as the runtime records it does not identify CuckCode.
- The turn took 6.9 seconds for a one-word reply at `high` effort. Thirteen turns at that rate is a
  materially slower run than the budget alone suggests.

## Cost

One turn. It answered two questions that no amount of reading the tree could answer, invalidated an
assumption in the approved packet, and surfaced a governance gap nobody was looking for.
