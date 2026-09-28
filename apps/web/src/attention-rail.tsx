import { useState } from "react";

export type AttentionDisposition = "approve" | "decline" | "defer" | "cancel" | "redirect";

export type OfficeAttentionItem = Readonly<{
  attentionId: string;
  entityId: string;
  label: string;
  reason: string;
  priority: number;
  causeEventId: string;
  plainLanguage: string;
  requiredAction: string;
}>;

export type OfficeDispositionReceipt = Readonly<{
  receiptId: string;
  acceptedRevision: number;
  resultingRevision: number;
  targetEntityId: string;
  disposition: AttentionDisposition;
  correlationId: string;
  agentVisible: true;
}>;

export type OfficeDispositionResult =
  | Readonly<{ ok: true; receipt: OfficeDispositionReceipt }>
  | Readonly<{ ok: false; code: string; requiredAction?: string }>;

export function AttentionRail({
  items,
  available,
  onClose,
  onLocate,
  onDismiss,
  onDisposition,
}: Readonly<{
  items: readonly OfficeAttentionItem[];
  available: boolean;
  onClose: () => void;
  onLocate: (item: OfficeAttentionItem) => void;
  onDismiss: (item: OfficeAttentionItem) => void;
  onDisposition: (
    item: OfficeAttentionItem,
    intent: AttentionDisposition,
    scope: Record<string, string>,
  ) => OfficeDispositionResult | Promise<OfficeDispositionResult>;
}>) {
  const [receipt, setReceipt] = useState<OfficeDispositionReceipt | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  // Task 9f-4 (AR-03 "Several requests", AR-02 frame 4): one item at a time, in canonical order.
  // The position is clamped, so dismissing the current item shows the next one.
  const [index, setIndex] = useState(0);
  const [responding, setResponding] = useState<string | undefined>(undefined);
  const position = Math.min(index, Math.max(items.length - 1, 0));
  const item = items[position];
  const go = (next: number) => {
    setIndex(next);
    setResponding(undefined);
  };

  return (
    <aside className="office-attention" aria-label="Manager attention">
      <header>
        <h2>Manager attention</h2>
        <button type="button" onClick={onClose}>
          Close attention
        </button>
      </header>
      {!available ? (
        <p className="office-attention-denial" role="alert">
          Refresh the current workspace before recording a disposition.
        </p>
      ) : null}
      <div className="office-attention-stepper">
        <button type="button" disabled={position === 0} onClick={() => go(position - 1)}>
          Previous item
        </button>
        <p className="office-attention-position" aria-live="polite">
          {position + 1} of {items.length}
        </p>
        <button
          type="button"
          disabled={position >= items.length - 1}
          onClick={() => go(position + 1)}
        >
          Next item
        </button>
      </div>
      {item ? (
        <article key={item.attentionId} data-attention-id={item.attentionId}>
          <h3>{item.label}</h3>
          <p>{item.plainLanguage}</p>
          <p>
            <strong>Manager action:</strong> {item.requiredAction}
          </p>
          <details>
            <summary>Technical scope</summary>
            <p>
              Priority {item.priority} · {item.reason.replaceAll("_", " ")}
            </p>
            <dl>
              <dt>Attention</dt>
              <dd>{item.attentionId}</dd>
              <dt>Target</dt>
              <dd>{item.entityId}</dd>
              <dt>Cause</dt>
              <dd>{item.causeEventId}</dd>
            </dl>
          </details>
          {/* Task 9g, G-1 (AR-03): one word on screen; the item stays in the accessible name,
              which contains the visible word (WCAG 2.5.3). */}
          <button type="button" aria-label={`Locate ${item.label}`} onClick={() => onLocate(item)}>
            Locate
          </button>
          <button
            type="button"
            aria-label={`Respond to ${item.label}`}
            aria-expanded={responding === item.attentionId}
            onClick={() =>
              setResponding((current) =>
                current === item.attentionId ? undefined : item.attentionId,
              )
            }
          >
            Respond
          </button>
          {responding === item.attentionId ? (
            <DispositionForm
              item={item}
              available={available}
              onSubmit={async (intent, scope) => {
                setFailure(undefined);
                const result = await onDisposition(item, intent, scope);
                if (result.ok) setReceipt(result.receipt);
                else
                  setFailure(
                    `${result.code}. ${result.requiredAction ?? "No change was recorded."}`,
                  );
              }}
            />
          ) : null}
          <button
            className="office-attention-dismiss"
            type="button"
            aria-label={`Dismiss ${item.label}`}
            onClick={() => onDismiss(item)}
          >
            Dismiss
          </button>
        </article>
      ) : null}
      {failure ? <p role="alert">{failure}</p> : null}
      {receipt ? (
        <section
          className="office-attention-receipt"
          role="status"
          aria-label="Disposition receipt"
        >
          <h3>Disposition recorded</h3>
          {/* Task 9f-5 (AR-04; rule 10): the decision in words, identifiers one step away. */}
          <p>
            {receipt.disposition.slice(0, 1).toUpperCase()}
            {receipt.disposition.slice(1)} recorded. The agent can see this decision.
          </p>
          <details>
            <summary>Receipt details</summary>
            <p>{receipt.receiptId}</p>
            <p>
              revision {receipt.acceptedRevision} → {receipt.resultingRevision}
            </p>
            <p>Target: {receipt.targetEntityId}</p>
            <p>Agent-visible disposition: {receipt.disposition}</p>
            <p>Correlation: {receipt.correlationId}</p>
          </details>
        </section>
      ) : null}
    </aside>
  );
}

function DispositionForm({
  item,
  available,
  onSubmit,
}: Readonly<{
  item: OfficeAttentionItem;
  available: boolean;
  onSubmit: (intent: AttentionDisposition, scope: Record<string, string>) => void | Promise<void>;
}>) {
  const [intent, setIntent] = useState<AttentionDisposition>("approve");
  const [reason, setReason] = useState("");
  const [qualifier, setQualifier] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const scope: Record<string, string> = { reason };
        if (intent === "defer") scope.deferUntil = qualifier;
        if (intent === "redirect") scope.redirectEntityId = qualifier;
        void onSubmit(intent, scope);
      }}
    >
      <label>
        Disposition
        <select
          aria-label={`Disposition for ${item.label}`}
          value={intent}
          onChange={(event) => {
            setIntent(event.target.value as AttentionDisposition);
            setQualifier("");
          }}
        >
          <option value="approve">Approve</option>
          <option value="decline">Decline</option>
          <option value="defer">Defer</option>
          <option value="cancel">Cancel</option>
          <option value="redirect">Redirect</option>
        </select>
      </label>
      <label>
        Reason
        <input
          aria-label={`Reason for ${item.label}`}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {intent === "defer" ? (
        <label>
          Defer until
          <input
            aria-label={`Defer until for ${item.label}`}
            required
            type="date"
            value={qualifier}
            onChange={(event) => setQualifier(event.target.value)}
          />
        </label>
      ) : null}
      {intent === "redirect" ? (
        <label>
          Redirect target ID
          <input
            aria-label={`Redirect target for ${item.label}`}
            required
            value={qualifier}
            onChange={(event) => setQualifier(event.target.value)}
          />
        </label>
      ) : null}
      <button type="submit" disabled={!available}>
        Submit {item.label}
      </button>
    </form>
  );
}
