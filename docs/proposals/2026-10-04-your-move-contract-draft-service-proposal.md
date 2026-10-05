# Your Move contract-draft service proposal

**Status:** Proposed; awaiting Cinder review and Nate's ruling. No implementation or live provider run is authorized by this document.

## 1. Decision requested

Approve, amend, or decline the following design for creating a genuine agent-authored structured contract draft in Surface B:

- A CuckCode-owned `contract-drafter-v1` procedure runs as one bounded assistant turn through the existing Codex App Server session adapter.
- The server binds the actual assistant response to an authenticated manager, project, current log revision, pinned procedure, and server-selected model. The browser cannot create or assert this provenance.
- An unapproved draft is transient and absent from the project event log. Manager approval, with or without edits, is the one durable `work.created` event and the only path into shared work state.
- The approved event preserves the original candidate and records the manager-approved contract separately, so the record never attributes manager edits to the agent.
- Implementation and deterministic tests can be completed with a test-only fake session adapter. Using the actual provider to generate a production draft requires a separate explicit owner authorization after implementation and verification.

This proposal requests no new event or command family and does not authorize implementation. It proposes a versioned `work.created` schema extension, which must be approved and implemented through the workflow-proof RED–GREEN gate before use.

## 2. Current core facts

- The shared workflow core remains `executeWorkCommand` → the existing loopback command boundary and event log → `replayProject`. `work.created` is currently payload version 3 and stores the validated bounded work contract.
- The event envelope identifies the manager who creates the work. No current durable event represents a draft, its approval, or its provenance.
- The approved Surface B create flow is: manager describes the outcome in plain words → an agent drafts the structured contract → manager approves or edits it. Nothing enters the project log until approval.
- `CodexStdioSupervisor` and `createControlledCodexHome` are existing session/runtime components. They can be reused to host a controlled draft session; this proposal does not repurpose the implementation-attempt runner, which starts from already-created work and has its own attempt-writing behavior.
- There is no existing contract-draft service, role, or validated live provider capability. The model and procedure below are proposed pins, not claims of a previously exercised service.

## 3. Event and command reconciliation

| Concern | Proposal | Reconciliation with the core |
|---|---|---|
| Plain-language description | Sent to the draft service as request input; not appended as a draft event. The eventual work contract remains the durable agreement. | No new event or write path. Retain only a request digest in provenance unless an already-approved contract field explicitly captures the request. |
| Agent candidate | Held in transient server-side draft state and returned for review. It has no project event, read-model row, or durable work effect before approval. | No `contract.draft_created` event. Rejecting, discarding, or letting a draft expire removes its transient receipt and leaves the event log unchanged. |
| Manager edits | The manager edits a copy of the candidate in Surface B. The UI shows a field-level old-candidate → manager-final diff. | Edits are not attributed to the agent. They become durable only as the manager-approved contract in the ordinary create command. |
| Approve | The authenticated manager explicitly approves the displayed final contract using a valid one-use server receipt. | Existing `work.create` / `executeWorkCommand` appends one `work.created` event, proposed payload version 4. The event envelope remains `source: manager`; no second writer or approval event is introduced. |
| Reject / discard | Manager rejects, discards, or abandons the candidate. | No event. Burn the receipt and clear transient server state. A future attempt requires a new draft session. |
| Versioning | New approvals use v4 with separate original candidate, final contract, and service provenance. | v1–v3 events remain replayable and unchanged. Their draft source is “not recorded”; the projection must not infer that an agent authored them. |

The proposed v4 event retains the existing contract fields and adds a provenance object containing only the original structured candidate and the non-secret receipt metadata needed to substantiate its source: draft ID, procedure ID/version and instruction digest, runtime/package and model identifiers, provider session/turn identifiers, and request/candidate digests. Do not store credentials, hidden prompts, or the full provider transcript. The final contract remains a separate field and is attributed to the manager command. Provenance must not change the event envelope's manager attribution.

## 4. Authorized source and authorship

The exact proposed source is the CuckCode-owned `contract-drafter-v1` procedure, executed as a single bounded assistant turn through `CodexStdioSupervisor` using a `createControlledCodexHome` session. The service pins `@openai/codex@0.157.1` and selects `gpt-6.1-sol` on the server. Neither model nor procedure may be selected or overridden by the browser. If that pinned source cannot run or returns an invalid result, the service fails closed; there is no silent model, role, or template fallback.

The procedure is a CuckCode-owned prompt and output contract, not an imported Agency Agents role. It receives the manager's plain-language description and only the bounded context expressly approved for this service. It has no project filesystem/worktree access, repository context, tools, MCP access, or permission to append events. It must produce the structured candidate itself in its assistant response. A schema wrapper may parse and validate that response but may not fill missing contract terms, substitute a canned example, or transform manager-written structured text into purported agent output.

“Agent-authored” means only that the server captured the structured candidate as the assistant response from this specifically identified, controlled session and bound that response to the pinned procedure and model before manager editing. It does not mean that the terms are correct, safe, approved, or independently verified. The manager remains the authorizing actor for the final agreement.

## 5. Draft provenance and validation rules

The draft service is an authenticated, non-project-mutating session endpoint. It is not an alternate command endpoint. The browser submits a plain-language request and expected project revision; the server authenticates the manager, starts the pinned session, captures and validates the actual response, and stores it in a short-lived server-side transient record. The response includes the candidate and an opaque, random, one-use receipt handle. The handle is a reference, not browser-supplied proof.

The server-side receipt binds the authenticated manager session, project, exact current log revision, request digest, candidate and candidate digest, draft ID, procedure/version and instruction digest, runtime/model, provider session/turn IDs, and expiry. On final approval, the browser sends the handle and the manager-approved contract through the existing command boundary. The server resolves the handle and passes trusted draft context to `executeWorkCommand`; identity and provenance are never read from caller-provided actor, model, procedure, candidate, or “verified” fields. A receipt is valid once, for its bound manager, project, revision, and candidate. It expires, is burned on rejection or successful creation, and is lost on service restart; the manager must request a fresh draft in those cases.

Before append, the command path must reject:

- an unauthenticated or non-manager create actor;
- a missing, malformed, expired, previously used, or wrong-session receipt;
- a receipt bound to another project, manager, expected revision, request, or candidate;
- a stale project revision, duplicate work ID, or invalid final contract;
- missing or inconsistent source metadata, an unsupported runtime/model/procedure pin, or candidate digest mismatch;
- any event construction that would label the manager-edited final contract as agent-authored.

The v4 schema requires a well-formed provenance object. Historical v1–v3 payloads continue replaying under their existing schemas; v4 without provenance is invalid. No cryptographic provider signature is claimed. The trust basis is the server-owned session capture and one-use binding; if the chosen adapter cannot provide reliable assistant-turn identity and content to that server boundary, it is not an acceptable source and must fail closed.

## 6. Read-model behavior and truthfulness

Before approval, Surface B shows the candidate as **“Draft for your review — not approved”**, with source identity and run/session reference. **“Source confirmed”** means the server verified the response came from the bound controlled session, procedure, and model. It does not certify the contract's truth or suitability. Show the complete structured candidate, validation issues, and any manager edits as a visible diff before enabling approval.

After append, the projection folds the log and displays the original agent-produced candidate separately from the final manager-approved contract, with the manager as approver and creator. For historical v1–v3 work, show “draft source not recorded.” If provenance is absent or inconsistent for v4, report an invalid/unreadable record; never infer a genuine draft. The projection must refuse to show any draft as approved before a valid `work.created` record exists, refuse approval/create without a genuine bound draft receipt, and refuse a manager-final contract as agent-authored. No optimistic work item or success state may appear before append and readback.

All normal, assignee, and historical/time-travel views remain deterministic projections of the event log. A transient candidate may be displayed for the manager who requested it, but it is not represented as project state, must not appear in another actor's log-derived lens, and disappears on expiry, rejection, restart, or log-revision mismatch. Past-view controls remain read-only.

## 7. RED–GREEN implementation gate

If approved, implementation must proceed in order. Each test must first fail for the expected reason before its corresponding behavior is implemented:

1. **Contract tests:** v4 schema, required provenance, manager envelope attribution, candidate/final separation, malformed and missing provenance rejection, and unchanged v1–v3 replay.
2. **Reducer tests:** deterministic replay and ordering, correct source-confirmed/source-unrecorded labels, separation of candidate from manager final terms, and refusal of impossible approval states.
3. **`executeWorkCommand` tests:** authenticated manager boundary, trusted-context-only receipt acceptance, stale revisions, wrong session/project, expired/reused/missing receipt, duplicate IDs, invalid contract/digest, and atomic append/readback behavior.
4. **Session-service tests:** the exact procedure/model/runtime pins, actual captured assistant turn binding, schema failure, timeout/provider failure, no fallback, and no event append or template substitution on failure. Use a test-only fake adapter; its receipts must be cryptographically or structurally isolated from production receipts and cannot authorize a production create.
5. **Loopback integration:** same authenticated command endpoint and project log; browser-supplied provenance is ignored/rejected; damaged or stale logs and receipts fail closed; append/readback controls the UI.
6. **Projection and adversarial UI tests:** no optimism; no conversion of candidate, claims, or manager edits into agent-authored terms; visible edit diff; missing/mismatched provenance; rejection and expiry; old-log replay; read-only past view; assignee lens cannot see transient manager drafts.
7. **Full `verify` and provenance checks.**

## 8. Live-provider run boundary

A genuine product draft from the specified source requires a live Codex provider session. This proposal does **not** request or authorize that run. The approved implementation and tests can be scoped without a live provider by injecting a test-only fake session adapter that exercises capture, binding, validation, expiry, and failure behavior. Fake output is test evidence only and must never be displayed as a production agent draft or accepted by the production command path.

After code and verification are complete, enabling or demonstrating one genuine draft requires a separate explicit owner authorization for a bounded live provider run. The proposal's approval alone does not grant that authorization. The proposed exact model pin has not been live-validated for this service; if it is unavailable, stop and return for a ruling rather than substituting a model.

## 9. Non-goals

- W12 or the §20 Surface B comprehension run.
- Any live provider execution before separate explicit owner authorization.
- Promotion, deployment, or notification delivery.
- A draft event, durable draft store, second work-state writer, or command path outside `executeWorkCommand`.
- Manager-written text, canned templates, test fixtures, or simulated output represented as agent-authored.
- Agent-side speech acts, assignment, execution, evidence, or review behavior beyond the already-approved shared workflow core.

## 10. Owner ruling requested

Please rule approve, amend, or decline the proposed source, transient-draft lifecycle, v4 `work.created` provenance, validation boundary, and RED–GREEN gate. If approved, Cinder review and this ruling authorize the implementation proposal only; a real provider draft remains separately gated as described in §8.
