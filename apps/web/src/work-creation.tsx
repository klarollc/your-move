import { useEffect, useState, type FormEvent } from "react";

import "./work-creation.css";

type ProseDraft = {
  achieve: string;
  inScope: string[];
  outOfScope: string[];
  doneWhen: string[];
};

type WorkDraftView = {
  id: string;
  status: "draft" | "approved";
  description: string;
  prose: ProseDraft;
  revision: number;
  updatedAt: string;
  approvedAt: string | null;
};

const errorMessages: Record<string, string> = {
  PROVIDER_NOT_CONNECTED: "Connect a provider above first, then describe the work.",
  PROVIDER_REAUTH_REQUIRED: "Your provider connection needs to be renewed above.",
  CONTRACT_DRAFT_INVALID: "The draft could not be formed. Try describing the work again.",
  WORK_DRAFT_REQUEST_INVALID: "Please check what you entered and try again.",
  WORK_DRAFT_NOT_EDITABLE: "This work is already approved and can no longer change.",
  WORK_DRAFT_NOT_FOUND: "That work item could not be found.",
};

function messageFor(code: string | undefined): string {
  return (code && errorMessages[code]) || "Something went wrong. Please try again.";
}

async function requestJson<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: (T & { code?: string }) | undefined }> {
  const response = await fetcher(url, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await response.json().catch(() => undefined)) as
    (T & { code?: string }) | undefined;
  return { ok: response.ok, status: response.status, body };
}

export function WorkCreation({ fetcher = globalThis.fetch }: Readonly<{ fetcher?: typeof fetch }>) {
  const [signedIn, setSignedIn] = useState(false);
  const [draft, setDraft] = useState<WorkDraftView | undefined>();
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const session = await requestJson<{ authenticated?: boolean }>(fetcher, "/api/session");
      if (disposed) return;
      setSignedIn(Boolean(session.body?.authenticated));
    })();
    return () => {
      disposed = true;
    };
  }, [fetcher]);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await requestJson<WorkDraftView>(fetcher, "/api/work-drafts", {
      method: "POST",
      body: JSON.stringify({ description }),
    });
    setBusy(false);
    if (!result.ok || !result.body) {
      setError(messageFor(result.body?.code));
      return;
    }
    setDraft(result.body);
    setFeedback("");
  }

  async function reviseDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    const result = await requestJson<WorkDraftView>(
      fetcher,
      `/api/work-drafts/${encodeURIComponent(draft.id)}/revise`,
      { method: "POST", body: JSON.stringify({ feedback }) },
    );
    setBusy(false);
    if (!result.ok || !result.body) {
      setError(messageFor(result.body?.code));
      return;
    }
    setDraft(result.body);
    setFeedback("");
  }

  async function approveDraft() {
    if (!draft) return;
    setBusy(true);
    setError("");
    const result = await requestJson<WorkDraftView>(
      fetcher,
      `/api/work-drafts/${encodeURIComponent(draft.id)}/approve`,
      { method: "POST" },
    );
    setBusy(false);
    setConfirming(false);
    if (!result.ok || !result.body) {
      setError(messageFor(result.body?.code));
      return;
    }
    setDraft(result.body);
  }

  function startOver() {
    setDraft(undefined);
    setDescription("");
    setFeedback("");
    setError("");
    setConfirming(false);
  }

  if (!signedIn) return null;

  if (draft?.status === "approved") {
    return (
      <section className="work-creation" aria-labelledby="work-creation-title">
        <h2 id="work-creation-title">Work approved</h2>
        <p className="work-creation__approved">
          Approved on {new Date(draft.approvedAt ?? draft.updatedAt).toLocaleString()}. It is ready
          to be assigned. Nothing has started yet.
        </p>
        <ProseSummary prose={draft.prose} />
        <button type="button" onClick={startOver}>
          Describe another piece of work
        </button>
      </section>
    );
  }

  return (
    <section className="work-creation" aria-labelledby="work-creation-title">
      <h2 id="work-creation-title">Describe the work</h2>

      {!draft && (
        <form onSubmit={createDraft}>
          <label htmlFor="work-description">What should get done? Say it in your own words.</label>
          <textarea
            id="work-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            maxLength={4000}
            disabled={busy}
          />
          <button type="submit" disabled={busy || description.trim().length === 0}>
            {busy ? "Drafting…" : "Draft it"}
          </button>
        </form>
      )}

      {draft && (
        <>
          <ProseSummary prose={draft.prose} />

          <form onSubmit={reviseDraft}>
            <label htmlFor="work-feedback">Want something changed? Tell me in plain words.</label>
            <textarea
              id="work-feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={3}
              maxLength={4000}
              disabled={busy}
            />
            <button type="submit" disabled={busy || feedback.trim().length === 0}>
              {busy ? "Updating…" : "Update the draft"}
            </button>
          </form>

          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} disabled={busy}>
              Approve this work
            </button>
          ) : (
            <div
              className="work-creation__confirm"
              role="alertdialog"
              aria-labelledby="confirm-title"
            >
              <p id="confirm-title">
                Approve this work? Once approved, the scope and done-when above are locked.
              </p>
              <button type="button" onClick={approveDraft} disabled={busy}>
                Yes, approve
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy}>
                Keep editing
              </button>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="work-creation__error">
          {error}
        </p>
      )}
    </section>
  );
}

function ProseSummary({ prose }: Readonly<{ prose: ProseDraft }>) {
  return (
    <div className="work-creation__prose">
      <h3>What this is for</h3>
      <p>{prose.achieve}</p>
      <h3>What is in scope</h3>
      <ul>
        {prose.inScope.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>What is not included</h3>
      {prose.outOfScope.length > 0 ? (
        <ul>
          {prose.outOfScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>Nothing called out.</p>
      )}
      <h3>Done when</h3>
      <ul>
        {prose.doneWhen.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
