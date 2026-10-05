# Your Move contract-draft service proposal

**Status:** Draft for owner ruling. This proposal authorizes no implementation or provider call.
**Scope:** provide a real agent-authored bounded contract draft for the Surface B create flow.

## 1. Problem and constraints

Surface B requires the manager to describe an outcome, an agent to draft the structured agreement,
and the manager to approve or edit it before work is created. The current `work.created` command
accepts a validated contract, but there is no draft service. The UI therefore keeps create unavailable
and explains why.

The workflow core remains authoritative: one `executeWorkCommand` path, one `replayProject` reducer,
and one append-only event log. Draft generation may return a candidate, but it cannot create work,
assign it, mutate a second work store, or bypass the shared command path. The service adapter stays
separate from role templates and the Surface B projection. No simulated or manager-authored text may
be presented as an agent draft.

## 2. Event and command reconciliation

| Step / fact | Existing core reconciliation | Proposed treatment |
|---|---|---|
| Manager describes an outcome | No workflow event is needed for unsaved form input. | Keep the request transient; do not save it as a work item or event. |
| Agent returns a structured draft | `work.created` stores an approved contract, not an unapproved draft or its author. | Add server-side `ContractDraftService` generation. Return a schema-validated candidate and an opaque, short-lived server receipt. No event is appended yet. |
| Manager edits and approves | Existing `create` intent already passes through `executeWorkCommand` and appends `work.created`. It cannot currently prove which draft was reviewed. | Extend the shared `create` intent with a server-issued draft receipt. On acceptance, `work.created` v4 stores the accepted contract plus the exact candidate snapshot and service provenance; the receipt is consumed once. |
| Manager declines, abandons, or reloads | No current event records these pre-creation actions. The spec says nothing is written until approval. | Discard transient candidate/receipt state. Do not append a decline event or create a local draft store. If durable decline history is later required, propose it separately through workflow-proof. |
| Provider failure or invalid output | No existing event or state means “drafted.” | Append nothing. Keep work creation unavailable, report the service failure, and permit a fresh request. |

No new event kind is proposed in this slice. `work.created` remains the sole durable creation fact;
its v4 payload would carry both the immutable agent candidate and the manager-approved contract.
The exact payload/version and receipt trust boundary require approval before implementation. Historical
`work.created` v1–v3 records must continue replaying unchanged.

## 3. Service boundary and flow

1. Surface B submits the manager's plain-language outcome and only explicitly selected context
   references to an authenticated loopback draft endpoint. Draft generation is a service request,
   not a workflow write.
2. The server invokes a provider-neutral `ContractDraftService` port through a separate runtime
   adapter. The configured agent role, runtime identity, model/runtime version, and provider-run ID
   come from server configuration/results; the browser cannot choose or assert them.
3. The server validates the response against `boundedWorkContractSchema`, including positive
   `maxTurns`, non-empty acceptance criteria and stop conditions, unique evidence kinds, and exact
   agreement between evidence obligations and `requiredEvidenceKinds`. Invalid output is refused.
4. The server returns the candidate and an opaque receipt bound to the authenticated session,
   project, normalized request digest, candidate digest, service/run provenance, and expiry. The
   receipt is not a command receipt and does not claim the draft is correct or approved.
5. Surface B displays the candidate as an unapproved agent draft. The manager may edit the complete
   contract, inspect the candidate-to-final diff, and approve or discard it. Candidate form state is
   transient presentation state, not a persisted work read model; reload loses it.
6. On approval, the browser calls the existing `/api/commands` boundary with the ordinary create
   command plus the opaque receipt and final contract. The server resolves and consumes the receipt,
   binds provenance, and invokes `executeWorkCommand`; it does not accept browser-supplied source,
   actor, run ID, or digest claims.
7. `work.created` is appended atomically with the approved contract and candidate provenance. The UI
   changes only after append and log readback confirm the new event; otherwise the event log and
   existing projection remain unchanged.

## 4. Proposed v4 creation evidence

The v4 payload retains the validated final `contract` and required evidence kinds, and adds a
`contractDraft` record containing:

- the exact schema-valid candidate contract returned by the service;
- service/role identity and version, provider-run ID, and server-generated draft ID;
- normalized request digest and candidate digest;
- the manager actor and creation event's normal timestamp/revision binding.

The manager-approved `contract` is authoritative for replay, execution, attestation, and evidence
applicability. The retained candidate supports an honest diff and audit only; it never supplies
active obligations or counts as evidence. The event's source/trust envelope must distinguish the
authenticated service result from manager approval. A receipt expiry, replay, cross-project use,
contract mismatch, or duplicate create command refuses without append. The service must not emit
secrets, hidden prompts, or unrequested file contents into the log.

## 5. Validation, privacy, and failure rules

- Require a live authenticated manager loopback session for drafting and approval. Bind the receipt
  to that session and project; use existing CSRF and exact-origin protections.
- Apply request length and rate limits. Context files are opt-in references, read only from the
  allowed project/worktree roots, with their digests recorded. Do not send the full repository by
  default. Exclude credentials, hidden prompts, ignored files, and files outside the allowlist.
- Treat provider output as untrusted candidate data. Validate the complete strict schema and all
  cross-field invariants server-side. A manager may edit it, but editing never changes its recorded
  agent-origin provenance.
- The service receipt is server-created, single-use, short-lived, and content-bound. Browser fields
  cannot fabricate or replace provenance. Duplicate IDs, stale project revision, expired receipts,
  provider timeout, refusal, invalid schema, and damaged logs all fail closed.
- No optimistic row or success receipt: show “drafting” while waiting; show “draft ready for your
  review” only after validated service response; show created work only after append/readback.
- A draft is not checked evidence, a manager decision, or proof that its terms are safe. Approval
  means the manager accepted the final contract; it does not verify future results.

## 6. Recommendation and tradeoff

Use a provider-neutral server-side draft port and keep pre-approval drafts transient. Preserve the
accepted candidate and its provenance inside the single `work.created` v4 event, alongside the
manager-approved final contract. This keeps the log as the only durable work history and makes the
final agreement auditable without a draft writer, draft store, or second command path.

The tradeoff is that declined or abandoned drafts are not recoverable or auditable after the session
ends. Persisting them would require additional canonical events and a proposal for draft lifecycle,
retention, privacy, and manager-decline semantics. The current Surface B specification says nothing
is written until approval, so this proposal defers that expansion.

## 7. Owner ruling requested

Approve, amend, or reject the server-side provider-neutral service, transient pre-approval candidate,
single-use bound receipt, and `work.created` v4 provenance snapshot described above. If approved,
implementation must follow the workflow-proof process with contract tests first, then reducer,
command, loopback, and projection/adversarial UI tests, followed by full `verify` and provenance.
No provider selection or call, event/schema mutation, command implementation, or service code is
authorized by this draft.
