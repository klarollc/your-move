import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";

import "./work-creation.css";
import type { ExecutionView } from "./work-executions.js";
import { MaterialsEditor, type WorkMaterials } from "./work-materials-editor.js";

// The composer is a slip above the street; the draft it produces is a sheet in the sheet position.
// Describe → draft → revise → approve is unchanged; only where each step sits has moved.

/** What approval arms. Shown before the owner confirms, and on the start button for older work. */
export const APPROVAL_CONSENT =
  "Approving gives the agent web research + repo read access. File changes always need your go-ahead.";

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
  // R3: the latest run for this item, when the service has started one.
  execution?: ExecutionView | null;
  // R4: the owner's materials on this revision.
  materials?: WorkMaterials | null;
};

const errorMessages: Record<string, string> = {
  PROVIDER_NOT_CONNECTED: "Connect a provider above first, then describe the work.",
  PROVIDER_REAUTH_REQUIRED: "Your provider connection needs to be renewed above.",
  CONTRACT_DRAFT_INVALID: "The draft could not be formed. Try describing the work again.",
  WORK_DRAFT_REQUEST_INVALID: "Please check what you entered and try again.",
  WORK_DRAFT_NOT_EDITABLE: "This work is already approved and can no longer change.",
  WORK_DRAFT_NOT_FOUND: "That work item could not be found.",
  WORK_MATERIALS_INVALID:
    "Those materials could not be attached. Links must start with http or https, repositories look like owner/name, and text has a size limit.",
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
    // Only declare a JSON body when there is one. Fastify rejects an empty body that claims JSON.
    headers:
      init.body === undefined
        ? (init.headers ?? {})
        : { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await response.json().catch(() => undefined)) as
    (T & { code?: string }) | undefined;
  return { ok: response.ok, status: response.status, body };
}

export type WorkComposer = ReturnType<typeof useWorkComposer>;

/** The composer's state, shared by the slip and the draft sheet so each can sit where it belongs. */
export function useWorkComposer({
  signedIn,
  fetcher,
  onDrafted,
  onApproved,
}: Readonly<{
  signedIn: boolean;
  fetcher: typeof fetch;
  onDrafted?: () => void;
  onApproved?: () => void;
}>) {
  const [draft, setDraft] = useState<WorkDraftView | undefined>();
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  // Focus moves only on the owner's own step (a new draft, approval, discard), never on a refresh.
  const draftFocus = useRef(false);
  const slipFocus = useRef(false);

  // Drop any in-progress draft when the owner signs out, so the next session starts blank.
  useEffect(() => {
    if (signedIn) return;
    setDraft(undefined);
    setDescription("");
    setFeedback("");
    setError("");
    setConfirming(false);
    setNotice("");
  }, [signedIn]);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const result = await requestJson<WorkDraftView>(fetcher, "/api/work-drafts", {
      method: "POST",
      body: JSON.stringify({ description }),
    });
    setBusy(false);
    if (!result.ok || !result.body) {
      setError(messageFor(result.body?.code));
      return;
    }
    draftFocus.current = true;
    setDraft(result.body);
    setFeedback("");
    onDrafted?.();
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

  async function saveMaterials(materials: WorkMaterials): Promise<boolean> {
    if (!draft) return false;
    setBusy(true);
    setError("");
    const result = await requestJson<WorkDraftView>(
      fetcher,
      `/api/work-drafts/${encodeURIComponent(draft.id)}/materials`,
      { method: "PUT", body: JSON.stringify(materials) },
    );
    setBusy(false);
    if (!result.ok || !result.body) {
      setError(messageFor(result.body?.code));
      return false;
    }
    setDraft(result.body);
    return true;
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
    // Approved work joins the queue; the composer folds back to the slip.
    slipFocus.current = true;
    setDraft(undefined);
    setDescription("");
    setFeedback("");
    setNotice("Approved — it has joined the queue.");
    onApproved?.();
  }

  function discard() {
    slipFocus.current = true;
    setDraft(undefined);
    setDescription("");
    setFeedback("");
    setError("");
    setConfirming(false);
    setNotice("");
  }

  return {
    draft,
    description,
    setDescription,
    feedback,
    setFeedback,
    busy,
    error,
    confirming,
    setConfirming,
    notice,
    createDraft,
    reviseDraft,
    saveMaterials,
    approveDraft,
    discard,
    requestDraftFocus: () => {
      draftFocus.current = true;
    },
    takeDraftFocus: () => {
      const pending = draftFocus.current;
      draftFocus.current = false;
      return pending;
    },
    takeSlipFocus: () => {
      const pending = slipFocus.current;
      slipFocus.current = false;
      return pending;
    },
  };
}

/** The New Work slip: one describe field and "Draft it", folded to slip height until used. */
export function WorkSlip({
  composer,
  draftSetAside,
  onShowDraft,
}: Readonly<{ composer: WorkComposer; draftSetAside: boolean; onShowDraft: () => void }>) {
  const field = useRef<HTMLTextAreaElement>(null);
  const { draft, description, busy } = composer;

  useLayoutEffect(() => {
    if (composer.takeSlipFocus()) field.current?.focus();
  });

  return (
    <section
      className={`ym3-slip${description ? " ym3-slip--written" : ""}`}
      aria-labelledby="new-work-title"
    >
      <h2 id="new-work-title">New work</h2>
      {draft ? (
        <div className="ym3-slip__held">
          <p role="status">
            {draftSetAside
              ? "Your draft is set aside while you read this sheet."
              : "Your draft is open below. Approve or discard it to start another."}
          </p>
          {draftSetAside ? (
            <button type="button" className="ym3-slip__return" onClick={onShowDraft}>
              Back to your draft
            </button>
          ) : null}
        </div>
      ) : (
        <form className="ym3-slip__form" onSubmit={(event) => void composer.createDraft(event)}>
          <label htmlFor="work-description">What should get done? Say it in your own words.</label>
          <textarea
            ref={field}
            id="work-description"
            value={description}
            onChange={(event) => composer.setDescription(event.target.value)}
            rows={1}
            maxLength={4000}
            disabled={busy}
          />
          <button type="submit" disabled={busy || description.trim().length === 0}>
            {busy ? "Drafting…" : "Draft it"}
          </button>
        </form>
      )}
      {!draft && composer.notice ? (
        <p className="ym3-slip__notice" role="status">
          {composer.notice}
        </p>
      ) : null}
      {!draft && composer.error ? (
        <p role="alert" className="work-creation__error">
          {composer.error}
        </p>
      ) : null}
    </section>
  );
}

/** The generated draft as a letter: what it is for, what is in and out, and when it is done. */
export function DraftSheet({ composer }: Readonly<{ composer: WorkComposer }>) {
  const title = useRef<HTMLHeadingElement>(null);
  const { draft, busy, confirming } = composer;

  useLayoutEffect(() => {
    if (composer.takeDraftFocus()) title.current?.focus();
  });

  if (!draft) return null;

  return (
    <section
      className="your-move__panel ym3-sheet ym3-sheet--draft"
      id="draft-sheet"
      aria-labelledby="draft-sheet-title"
    >
      <header className="ym3-sheet__letterhead">
        <div>
          <h2 ref={title} tabIndex={-1} id="draft-sheet-title" className="your-move__panel-title">
            New work draft
          </h2>
          <p className="ym3-sheet__dateline">
            Revision {draft.revision}. Nothing starts until you approve it.
          </p>
        </div>
      </header>

      <ProseSummary prose={draft.prose} />

      <form className="ym3-sheet__revise" onSubmit={(event) => void composer.reviseDraft(event)}>
        <label htmlFor="work-feedback">Want something changed? Tell me in plain words.</label>
        <textarea
          id="work-feedback"
          value={composer.feedback}
          onChange={(event) => composer.setFeedback(event.target.value)}
          rows={3}
          maxLength={4000}
          disabled={busy}
        />
        <div className="your-move__actions">
          <button
            type="submit"
            className="your-move__secondary"
            disabled={busy || composer.feedback.trim().length === 0}
          >
            {busy ? "Updating…" : "Update the draft"}
          </button>
        </div>
      </form>

      <MaterialsEditor
        materials={draft.materials ?? null}
        disabled={busy}
        onSave={composer.saveMaterials}
      />

      {!confirming ? (
        <div className="your-move__actions ym3-sheet__decision">
          <button
            type="button"
            className="your-move__primary"
            onClick={() => composer.setConfirming(true)}
            disabled={busy}
          >
            Approve draft
          </button>
          <button
            type="button"
            className="your-move__secondary"
            onClick={composer.discard}
            disabled={busy}
          >
            Discard
          </button>
        </div>
      ) : (
        <div
          className="work-creation__confirm ym3-sheet__decision"
          role="alertdialog"
          aria-labelledby="confirm-title"
        >
          <p id="confirm-title">
            Approve this work? Once approved, the scope and done-when above are locked.
          </p>
          <p className="work-creation__consent">{APPROVAL_CONSENT}</p>
          <div className="your-move__actions">
            <button
              type="button"
              className="your-move__primary"
              onClick={() => void composer.approveDraft()}
              disabled={busy}
            >
              Yes, approve
            </button>
            <button
              type="button"
              className="your-move__secondary"
              onClick={() => composer.setConfirming(false)}
              disabled={busy}
            >
              Keep editing
            </button>
          </div>
        </div>
      )}

      {composer.error ? (
        <p role="alert" className="work-creation__error">
          {composer.error}
        </p>
      ) : null}
    </section>
  );
}

function ProseSummary({ prose }: Readonly<{ prose: ProseDraft }>) {
  return (
    <div className="work-creation__prose">
      <div className="ym3-sheet__letter-section">
        <h3>What this is for</h3>
        <p>{prose.achieve}</p>
      </div>
      <div className="ym3-sheet__letter-section">
        <h3>What is in scope</h3>
        <ul>
          {prose.inScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="ym3-sheet__letter-section">
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
      </div>
      <div className="ym3-sheet__letter-section">
        <h3>Done when</h3>
        <ul>
          {prose.doneWhen.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
