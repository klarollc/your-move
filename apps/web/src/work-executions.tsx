import { useCallback, useEffect, useState } from "react";

import "./work-creation.css";
import "./work-executions.css";

export type ExecutionStatus =
  "queued" | "working" | "waiting-on-you" | "done" | "failed" | "interrupted";

export type ExecutionProposalView = {
  id: string;
  tool: string;
  status: "pending" | "approved" | "applied" | "denied" | "stale";
  change: { repo: string; path: string; message: string; content: string };
};

export type ExecutionView = {
  id: string;
  status: ExecutionStatus;
  attempt: number;
  turnCount: number;
  maxTurns: number;
  output: string | null;
  error: string | null;
  proposals: ExecutionProposalView[];
};

type ApprovedDraft = {
  id: string;
  status: "draft" | "approved";
  prose: { achieve: string };
  execution?: ExecutionView | null;
};

/** What approval arms. Shown before the owner confirms, and on the start button for older work. */
export const APPROVAL_CONSENT =
  "Approving gives the agent web research + repo read access. File changes always need your go-ahead.";

const stopReasons: Record<string, string> = {
  PROVIDER_DISCONNECTED: "the provider was disconnected",
  PROVIDER_REAUTH_REQUIRED: "the provider connection needs renewing",
  PROVIDER_UNAVAILABLE: "the provider could not be reached",
  PROVIDER_RESPONSE_INVALID: "the provider sent a reply that could not be used",
  SERVER_RESTARTED: "the service restarted",
  SERVER_SHUTDOWN: "the service was stopping",
  WORK_DRAFT_NOT_FOUND: "its approved work could not be found",
  EXECUTION_INTERNAL_ERROR: "something went wrong in the service",
};

/** One plain-language line for where a run stands. */
export function executionStatusLine(execution: ExecutionView | null | undefined): string {
  if (!execution) return "Not started.";
  const reason = (execution.error && stopReasons[execution.error]) || "it stopped unexpectedly";
  switch (execution.status) {
    case "queued":
      return "Queued — the agent starts shortly.";
    case "working":
      return `Working — turn ${Math.min(execution.turnCount + 1, execution.maxTurns)} of ${execution.maxTurns}.`;
    case "waiting-on-you":
      return execution.proposals.some(({ status }) => status === "pending")
        ? "Waiting on you — the agent proposes a file change."
        : "Waiting on you — the agent has replied.";
    case "done":
      return "Done.";
    case "failed":
      return execution.error === "TURN_BUDGET_EXHAUSTED"
        ? `Stopped — it used all ${execution.maxTurns} turns without finishing.`
        : `Stopped — ${reason}.`;
    case "interrupted":
      return `Paused — ${reason}. Restart it when you are ready.`;
  }
}

async function call<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; body: T | undefined }> {
  const response = await fetcher(url, {
    ...init,
    credentials: "same-origin",
    // Only declare a JSON body when there is one. Fastify rejects an empty body that claims JSON.
    headers:
      init.body === undefined
        ? (init.headers ?? {})
        : { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await response.json().catch(() => undefined)) as T | undefined;
  return { ok: response.ok, body };
}

const ACTIVE: ReadonlySet<ExecutionStatus> = new Set(["queued", "working"]);
const POLL_MS = 2_000;

// The approved-work list: one status line per item, the agent's reply when it waits on the owner,
// and the pending-proposal panel. R4 adds the lamp; R3 needs this to be legible.
export function WorkExecutions({
  signedIn,
  refreshKey = 0,
  fetcher = globalThis.fetch,
}: Readonly<{ signedIn: boolean; refreshKey?: number; fetcher?: typeof fetch }>) {
  const [items, setItems] = useState<ApprovedDraft[] | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { ok, body } = await call<{ drafts?: ApprovedDraft[] }>(fetcher, "/api/work-drafts");
      if (!ok || !Array.isArray(body?.drafts)) return;
      setItems(body.drafts.filter((draft) => draft.status === "approved"));
    } catch {
      // Leave the list as it was; the next poll or action retries.
    }
  }, [fetcher]);

  useEffect(() => {
    if (!signedIn) {
      setItems(undefined);
      return;
    }
    void load();
  }, [signedIn, refreshKey, load]);

  const active = items?.some((item) => item.execution && ACTIVE.has(item.execution.status));
  useEffect(() => {
    if (!signedIn || !active) return;
    const timer = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(timer);
  }, [signedIn, active, items, load]);

  async function act(url: string, body?: object) {
    setBusy(true);
    setError("");
    try {
      const result = await call(fetcher, url, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!result.ok) setError("That did not go through. Refresh and try again.");
    } catch {
      setError("The service could not be reached. Try again.");
    } finally {
      setBusy(false);
      await load();
    }
  }

  if (!signedIn || !items || items.length === 0) return null;

  return (
    <section className="work-creation work-executions" aria-labelledby="work-executions-title">
      <h2 id="work-executions-title">Approved work</h2>
      <ul className="work-executions__list">
        {items.map((item) => {
          const execution = item.execution ?? null;
          const pending = execution?.proposals.filter(({ status }) => status === "pending") ?? [];
          const restartable =
            execution && (execution.status === "interrupted" || execution.status === "failed");
          return (
            <li key={item.id} className="work-executions__item">
              <h3>{item.prose.achieve}</h3>
              <p className="work-executions__status" role="status">
                {executionStatusLine(execution)}
              </p>

              {!execution ? (
                <div className="work-executions__actions">
                  <p className="work-executions__consent">{APPROVAL_CONSENT}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("/api/work-executions", { draftId: item.id })}
                  >
                    Start this work
                  </button>
                </div>
              ) : null}

              {execution?.status === "waiting-on-you" && execution.output ? (
                <div className="work-executions__reply">
                  <h4>The agent says</h4>
                  <p>{execution.output}</p>
                </div>
              ) : null}

              {execution
                ? pending.map((proposal) => (
                    <div
                      key={proposal.id}
                      className="work-executions__proposal"
                      role="group"
                      aria-label={`Proposed change to ${proposal.change.path}`}
                    >
                      <h4>
                        Proposed change to {proposal.change.path} in {proposal.change.repo}
                      </h4>
                      <p>Commit message: {proposal.change.message}</p>
                      <pre className="work-executions__content">{proposal.change.content}</pre>
                      <div className="work-executions__actions">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              `/api/work-executions/${encodeURIComponent(execution.id)}/proposals/${encodeURIComponent(proposal.id)}/approve`,
                            )
                          }
                        >
                          Approve change
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              `/api/work-executions/${encodeURIComponent(execution.id)}/proposals/${encodeURIComponent(proposal.id)}/deny`,
                            )
                          }
                        >
                          Deny change
                        </button>
                      </div>
                    </div>
                  ))
                : null}

              {restartable ? (
                <div className="work-executions__actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(`/api/work-executions/${encodeURIComponent(execution.id)}/restart`)
                    }
                  >
                    Restart
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="work-creation__error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
