# Your Move — Redesign Build Plan

Source: owner-supplied attachment `your-move-redesign-build-plan-2026-10-18.md`.

## Owner amendment — 2026-10-18 (R1 only)

**R1 is approved for implementation.** The owner clarified that the earlier “R1 build” directive approves R1 only and supersedes the source draft's “No build until approved” status for R1. R2–R5 remain unapproved; this amendment does not authorize them.

For R1, OpenAI and Anthropic are the only providers. Hermes is excluded from v1. Do not change local-loopback behavior, the canonical event log, the lamp/T3/T4, or later-phase workflows. Use paste-key connections with validation before saving. OpenAI's ChatGPT-plan OAuth documentation describes a separate integration and requires an interest request for remotely hosted applications; no eligibility/client approval is present for this Railway service, so this build does not use that flow. Provider keys are encrypted at rest, and no API/UI response may reveal stored key material.

Because the service has a public HTTPS endpoint, its provider-management surface must be protected by one owner login. This is a single-user access boundary, not multi-user support. Railway project reference supplied by the owner: `265f5b22-b4c3-46ae-90b0-32fec7893e04`. This authorizes deploy-ready code/configuration only; it does not authorize connecting to Railway, setting variables, pushing, or deploying.

Where this amendment conflicts with the source text below, the amendment controls for R1 only.

---

## Source attachment (verbatim)

Your Move — Redesign Build Plan
Date: 2026-10-18
Status: Draft for owner approval. No build until approved.
Basis: Operation redesign proposal (2026-10-18), all three questions decided (hosted; OpenAI + Anthropic + Hermes; keep dogfood sessions).
v1 gate: every phase must reduce friction or remove an operational blocker. Anything else is cut.
v1 definition
A non-technical user can: connect a provider in a few clicks → describe work in plain language in one interface → have the agent do it → see lamp glows → triage them. No terminals. No JSON. No manual runs. That is v1. Everything below is judged against it.
What survives / what is replaced
Survives (carried over, not rebuilt):
Event log: one command path, one reducer, one event log. The data architecture is sound.
Bounded work contract as a concept (scope, acceptance, done-criteria, permission ceiling). Expression becomes prose; JSON becomes internal-only.
T3/T4 lamp: utterance instrumentation, live verdict feed, triage UI. Proven technology; ported to hosted, not redesigned.
Projection-only verdicts.
Replaced:
Local-loopback operation (shelved, not deleted — local-models future track stays open).
Manual server/UI startup.
JSON contract authoring.
Manual per-item runner invocation (run-workflow-attempt.ts as a hand-run script).
The pinned contract-draft session model (replaced by prose draft in the work-creation flow).
Phases
R1 — Hosted foundation + provider connections
Hosting: Railway (~$5/mo). Git-push deploy from the repo, public HTTPS URL, no server admin. Decided 2026-10-18 for least friction.
Scope: Stand up the hosted server on Railway. Build connect-once for OpenAI and Anthropic. Credential storage encrypted at rest, never displayed back. Model defaults to automatic with manual override. Token expiry gets an explicit state with two-click reauth; work state survives reauth.
Acceptance:
A user connects each provider in a few clicks (OAuth where available, paste-key with validate-at-connect otherwise). Invalid credentials fail at connect time, never at first use.
Disconnect is explicit and immediate. Reconnect resumes, never restarts.
Keys are encrypted at rest; the UI never shows a stored key back.
R2 — Plain-language work creation
Scope: One interface in Surface B: describe the outcome in plain language → system drafts the contract in prose (scope, acceptance, boundaries) → user refines or approves. No JSON visible at any point. No window-switching.
Acceptance:
A non-technical user can go from blank screen to approved work item without leaving Surface B, without a terminal, without seeing JSON.
The approved prose contract maps to the internal bounded-contract schema (validated server-side; the user never sees the schema).
Approval gates remain: nothing irreversible without explicit approval.
R3 — Live execution loop
Scope: Replace manual runner invocation with server-managed execution. The provider connection persists; assigning work wakes the agent. Trigger/request-driven, durable state — not a hot loop, not hand-run scripts.
Acceptance:
Assigning approved work starts execution with no further manual steps. No PowerShell, no args, no worktree juggling visible to the user.
The loop survives restarts (durable state, not in-memory-only).
The user can see what's running and disconnect the provider at any time.
R4 — Lamp on hosted
Scope: Port the T3/T4 lamp to the hosted architecture: utterance capture on the hosted runner, live verdict feed over the existing WebSocket path, triage UI against the hosted feed. No redesign of the lamp itself.
Acceptance:
Lamp verdicts flow live during hosted execution (same ≤10s budget, same message contract).
Triage UI works unchanged against the hosted feed.
Projection-only discipline holds: verdicts never enter the canonical log.
(May overlap R2/R3 — the lamp is decoupled from the operation model.)
R5 — Dogfood
Scope: Run the three release-tail sessions (license-review hash fix, REA provenance, MSVC entitlement research) through the redesigned loop. Mark lamp worksheets per the dogfood runbook.
Acceptance:
All three sessions run start-to-finish through the new interface with no terminal use.
Worksheets marked; hit/miss/false-glow recorded.
Friction log: any blocker encountered is recorded against the v1 gate (fix or cut).
Sequencing
R1 → R2 → R3 → R5, with R4 overlapping R2/R3. Each phase gets a Cinder conformance gate before the next begins (same gate discipline as T3/T4).
Explicitly out (v1 gate)
Local-loopback operation (shelved).
Pause/resume, cross-attempt verdict store, automated promotion (still non-goals).
Any provider beyond the three.
Any feature that does not reduce friction or remove an operational blocker.
Decisions needed before R1
1. Hosting venue. Where does the hosted server live? DECIDED 2026-10-18: Railway.
2. Hermes connection mechanics. How does the hosted server reach Hermes? MOOT — Hermes cut from v1.
