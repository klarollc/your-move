import { useState, type FormEvent } from "react";
import {
  boundedWorkContractSchema,
  contractDraftRecordSchema,
  type BoundedWorkContract,
  type ContractDraftProvenance,
} from "@cuckcode/contracts";

type AgentDraftProvenance = Extract<ContractDraftProvenance, { draftSource: "agent" }>;

export type ContractDraftServiceResult = Readonly<{
  candidate: BoundedWorkContract;
  provenance: ContractDraftProvenance;
  receiptHandle: string;
  expiresAt: string;
  source: "codex-app-server" | "test-fake";
  testOnly: boolean;
}>;

type ReviewedAgentDraft = Omit<ContractDraftServiceResult, "provenance"> & {
  provenance: AgentDraftProvenance;
};

export function ContractDraftPanel(
  props: Readonly<{
    available: boolean;
    disabled: boolean;
    revision: number;
    onDraft?: (description: string) => Promise<ContractDraftServiceResult>;
    onCreate?: (contract: BoundedWorkContract, receiptHandle?: string) => Promise<void>;
  }>,
) {
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<ReviewedAgentDraft | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [finalJson, setFinalJson] = useState("");
  const [managerAuthored, setManagerAuthored] = useState(false);
  const [managerContractJson, setManagerContractJson] = useState("");
  const [pending, setPending] = useState<"draft" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finalParsed = parseFinalContract(finalJson);
  const managerContract = parseFinalContract(managerContractJson);
  const changedFields =
    draft && finalParsed
      ? Object.keys(draft.candidate).filter(
          (key) =>
            JSON.stringify(draft.candidate[key as keyof BoundedWorkContract]) !==
            JSON.stringify(finalParsed[key as keyof BoundedWorkContract]),
        )
      : [];
  const draftStale = draftRevision !== null && draftRevision !== props.revision;
  const disabled = props.disabled || pending !== null;

  const requestDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!props.available || !props.onDraft || disabled || description.trim().length === 0) return;
    setError(null);
    setDraft(null);
    setDraftRevision(null);
    setFinalJson("");
    setPending("draft");
    try {
      const result = await props.onDraft(description.trim());
      if (result.testOnly || result.source !== "codex-app-server") {
        setError("A test-only draft cannot be reviewed or approved here. No work was created.");
        return;
      }
      const parsed = contractDraftRecordSchema.safeParse({
        candidate: result.candidate,
        provenance: result.provenance,
      });
      if (
        !parsed.success ||
        !("candidate" in parsed.data) ||
        !("draftSource" in parsed.data.provenance) ||
        parsed.data.provenance.draftSource !== "agent" ||
        result.receiptHandle.length === 0
      ) {
        setError("The server returned an invalid draft receipt. No work was created.");
        return;
      }
      setDraft({
        ...result,
        candidate: parsed.data.candidate,
        provenance: parsed.data.provenance as AgentDraftProvenance,
      });
      setDraftRevision(props.revision);
      setFinalJson(JSON.stringify(parsed.data.candidate, null, 2));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The agent draft was not created.");
    } finally {
      setPending(null);
    }
  };

  const approveDraft = async () => {
    if (!draft || !finalParsed || draftStale || disabled || !props.onCreate) return;
    setError(null);
    setPending("create");
    try {
      await props.onCreate(finalParsed, draft.receiptHandle);
      setDraft(null);
      setDraftRevision(null);
      setFinalJson("");
      setDescription("");
    } catch (cause) {
      setDraft(null);
      setDraftRevision(null);
      setFinalJson("");
      setError(
        `${cause instanceof Error ? cause.message : "The create command was refused."} No work was confirmed; request a fresh draft before trying again.`,
      );
    } finally {
      setPending(null);
    }
  };

  const createManagerAuthored = async () => {
    if (!managerContract || disabled || !props.onCreate) return;
    setError(null);
    setPending("create");
    try {
      await props.onCreate(managerContract);
      setManagerContractJson("");
      setManagerAuthored(false);
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : "The create command was refused."} No work was confirmed.`,
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="workflow-create-panel" aria-labelledby="new-work-title">
      <div className={`workflow-unavailable-mark${props.available ? " is-ready" : ""}`}>
        {props.available ? "Pinned agent session available" : "Agent drafting disabled"}
      </div>
      <h1 id="new-work-title">Describe the outcome</h1>
      <p>
        The agent’s contract is a candidate for your review. Nothing enters the shared work log
        until you approve the final terms.
      </p>
      {!props.available ? (
        <p className="workflow-draft-disabled" role="note">
          The pinned live draft session has not received separate owner authorization. This screen
          will not use a template or simulated draft. You can write a structured contract yourself
          and record it as manager-authored.
        </p>
      ) : null}
      {!managerAuthored ? (
        <>
          <form onSubmit={(event) => void requestDraft(event)}>
            <label htmlFor="work-description">What outcome do you need?</label>
            <textarea
              id="work-description"
              rows={4}
              maxLength={4_000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!props.available || disabled}
            />
            <p className="workflow-help">
              A plain-language request starts one bounded pinned session. It does not create a work
              item.
            </p>
            <div className="workflow-dialog-actions">
              <button
                className="workflow-primary"
                type="submit"
                disabled={
                  !props.available || disabled || description.trim().length === 0 || !props.onDraft
                }
              >
                {pending === "draft" ? "Waiting for the pinned session…" : "Request agent draft"}
              </button>
            </div>
          </form>
          <button
            className="workflow-secondary"
            type="button"
            onClick={() => {
              setError(null);
              setManagerAuthored(true);
            }}
            disabled={disabled || !props.onCreate}
          >
            You're writing the contract yourself; it will be recorded as manager-authored.
          </button>
        </>
      ) : (
        <section aria-label="Manager-authored contract">
          <p className="workflow-draft-status">Draft source: manager</p>
          <h2>Write your contract</h2>
          <p className="workflow-help">
            Enter the complete structured contract. These terms are your work and will be recorded
            as manager-authored.
          </p>
          <label htmlFor="manager-contract-json">Write the structured contract JSON</label>
          <textarea
            id="manager-contract-json"
            rows={16}
            value={managerContractJson}
            onChange={(event) => setManagerContractJson(event.target.value)}
            disabled={disabled}
          />
          {managerContractJson.length > 0 && !managerContract ? (
            <p role="alert">
              The contract JSON is invalid or does not satisfy the bounded contract.
            </p>
          ) : null}
          <div className="workflow-dialog-actions">
            <button
              className="workflow-secondary"
              type="button"
              onClick={() => setManagerAuthored(false)}
              disabled={disabled}
            >
              Back to agent draft
            </button>
            <button
              className="workflow-primary"
              type="button"
              onClick={() => void createManagerAuthored()}
              disabled={disabled || !managerContract || !props.onCreate}
            >
              {pending === "create" ? "Waiting for log readback…" : "Create manager-authored work"}
            </button>
          </div>
        </section>
      )}
      {error ? (
        <p className="workflow-draft-error" role="alert">
          {error}
        </p>
      ) : null}
      {draft ? (
        <div className="workflow-draft-review" aria-label="Draft approval review">
          <p className="workflow-draft-status" role="status">
            Draft for your review · not approved · source confirmed by the server ·{" "}
            {draft.provenance.model}
          </p>
          <p className="workflow-help">
            Procedure {draft.provenance.procedureId} · session {draft.provenance.providerSessionId}{" "}
            · turn {draft.provenance.providerTurnId} · expires {draft.expiresAt}
          </p>
          <section aria-labelledby="candidate-title">
            <h2 id="candidate-title">Agent candidate</h2>
            <pre>{JSON.stringify(draft.candidate, null, 2)}</pre>
          </section>
          <section aria-labelledby="final-contract-title">
            <h2 id="final-contract-title">Your final contract</h2>
            <label htmlFor="final-contract-json">Edit the structured contract JSON</label>
            <textarea
              id="final-contract-json"
              rows={16}
              value={finalJson}
              onChange={(event) => setFinalJson(event.target.value)}
              disabled={disabled || draftStale}
            />
          </section>
          <section className="workflow-contract-diff" aria-label="Manager edit diff">
            <h2>Changes from the agent candidate</h2>
            {draftStale ? (
              <p role="alert">
                The event log advanced from r{draftRevision}; request a fresh draft.
              </p>
            ) : !finalParsed ? (
              <p role="alert">
                The final contract JSON is invalid or does not satisfy the bounded contract.
              </p>
            ) : changedFields.length === 0 ? (
              <p>No manager edits. The candidate and final contract match.</p>
            ) : (
              <ul>
                {changedFields.map((field) => (
                  <li key={field}>
                    <strong>{field}</strong>
                    <pre>
                      {JSON.stringify(draft.candidate[field as keyof BoundedWorkContract], null, 2)}
                    </pre>
                    <span aria-hidden="true">→</span>
                    <pre>
                      {JSON.stringify(finalParsed[field as keyof BoundedWorkContract], null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="workflow-help">
            Approval records the original candidate and your final contract separately at one new
            log revision.
          </p>
          <div className="workflow-dialog-actions">
            <button
              className="workflow-primary"
              type="button"
              onClick={() => void approveDraft()}
              disabled={disabled || !finalParsed || draftStale || !props.onCreate}
            >
              {pending === "create"
                ? "Waiting for log readback…"
                : "Approve contract and create work"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function parseFinalContract(value: string): BoundedWorkContract | null {
  try {
    const parsed = boundedWorkContractSchema.safeParse(JSON.parse(value) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
