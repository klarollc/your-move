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

  return (
    <aside className="office-attention" aria-label="Manager attention">
      <header>
        <div>
          <p>Canonical projection</p>
          <h2>Manager attention</h2>
        </div>
        <button type="button" onClick={onClose}>
          Close attention
        </button>
      </header>
      <p className="office-attention-summary">
        {items.length} current item{items.length === 1 ? "" : "s"}, in canonical order.
      </p>
      {!available ? (
        <p className="office-attention-denial" role="alert">
          Refresh the current workspace before recording a disposition.
        </p>
      ) : null}
      <ol>
        {items.map((item) => (
          <li key={item.attentionId} data-attention-id={item.attentionId}>
            <p className="office-attention-kicker">
              Priority {item.priority} · {item.reason.replaceAll("_", " ")}
            </p>
            <h3>{item.label}</h3>
            <p>{item.plainLanguage}</p>
            <p>
              <strong>Manager action:</strong> {item.requiredAction}
            </p>
            <details>
              <summary>Technical scope</summary>
              <dl>
                <dt>Attention</dt>
                <dd>{item.attentionId}</dd>
                <dt>Target</dt>
                <dd>{item.entityId}</dd>
                <dt>Cause</dt>
                <dd>{item.causeEventId}</dd>
              </dl>
            </details>
            <button type="button" onClick={() => onLocate(item)}>
              Locate {item.label}
            </button>
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
            <button
              className="office-attention-dismiss"
              type="button"
              onClick={() => onDismiss(item)}
            >
              Dismiss {item.label}
            </button>
          </li>
        ))}
      </ol>
      {failure ? <p role="alert">{failure}</p> : null}
      {receipt ? (
        <section
          className="office-attention-receipt"
          role="status"
          aria-label="Disposition receipt"
        >
          <h3>Disposition recorded</h3>
          <p>{receipt.receiptId}</p>
          <p>
            revision {receipt.acceptedRevision} → {receipt.resultingRevision}
          </p>
          <p>Target: {receipt.targetEntityId}</p>
          <p>Agent-visible disposition: {receipt.disposition}</p>
          <details>
            <summary>Receipt correlation</summary>
            <p>{receipt.correlationId}</p>
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
