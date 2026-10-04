/**
 * Reconciles a turn's completion record with the notifications streamed during it (workflow-proof
 * W2, DF-044).
 *
 * What the real logs show: Codex's `turn/completed.items` normally carries only the final agent
 * message, while the stream carries the user message, reasoning, file changes and the rest. In all
 * six session logs that contain turn items, the completion record held 1 item and the stream 2 to
 * 6. So an item present in the stream and absent from the completion record is the NORMAL case
 * (`omittedFromCompletion`, informational) and never makes a record partial on its own.
 *
 * A record is partial only when the stream itself cannot be trusted to be whole:
 *
 * - the completion record holds an item with an id that the stream never showed;
 * - an item started (`item/started`) and never completed (`item/completed`);
 * - no stream was observed at all, so there is nothing to compare against.
 *
 * Items with no string id cannot be matched by id. They are de-duplicated by their content and are
 * never reported as missing from the stream or as unfinished.
 */
export type TurnRecordReconciliation = Readonly<{
  /** Every distinct item, the completion record's first, then those only the stream showed. */
  items: unknown[];
  completionItemCount: number;
  streamedItemCount: number;
  /** Streamed items absent from the completion record. Expected; not a fault. */
  omittedFromCompletion: number;
  /** Ids of completion-record items the stream never showed. A fault. */
  missingFromStream: string[];
  /** Ids of items that started and never completed. A fault. */
  unfinishedItemIds: string[];
  /** False when no stream was collected, so no comparison was possible. */
  streamObserved: boolean;
  /** False when no `item/started` ids were supplied, so unfinished items were not checked for. */
  startsObserved: boolean;
  partial: boolean;
  reasons: string[];
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const idOf = (item: unknown): string | undefined =>
  isRecord(item) && typeof item.id === "string" && item.id.length > 0 ? item.id : undefined;

const typeOf = (item: unknown): string =>
  isRecord(item) && typeof item.type === "string" && item.type.length > 0 ? item.type : "unknown";

const keyOf = (item: unknown): string => {
  const id = idOf(item);
  return id !== undefined ? `id:${id}` : `json:${JSON.stringify(item) ?? String(item)}`;
};

export function reconcileTurnRecord(
  input: Readonly<{
    completedItems: readonly unknown[];
    streamedItems?: readonly unknown[];
    startedItemIds?: readonly string[];
  }>,
): TurnRecordReconciliation {
  const streamObserved = input.streamedItems !== undefined;
  const streamed = input.streamedItems ?? [];
  const startsObserved = input.startedItemIds !== undefined;

  const seen = new Set<string>();
  const items: unknown[] = [];
  for (const item of [...input.completedItems, ...streamed]) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  const completionKeys = new Set(input.completedItems.map(keyOf));
  const streamedKeys = new Set(streamed.map(keyOf));
  const streamedIds = new Set(streamed.map(idOf).filter((id): id is string => id !== undefined));
  const omittedFromCompletion = [...streamedKeys].filter((key) => !completionKeys.has(key)).length;

  const reasons: string[] = [];
  const missingFromStream: string[] = [];
  if (streamObserved) {
    for (const item of input.completedItems) {
      const id = idOf(item);
      if (id !== undefined && !streamedIds.has(id)) {
        missingFromStream.push(id);
        reasons.push(
          `item ${id} (${typeOf(item)}) is in the completion record but the stream never showed it`,
        );
      }
    }
  } else {
    reasons.push("no stream was observed, so the completion record cannot be checked against it");
  }

  const unfinishedItemIds: string[] = [];
  for (const id of input.startedItemIds ?? []) {
    if (!streamedIds.has(id) && !unfinishedItemIds.includes(id)) {
      unfinishedItemIds.push(id);
      reasons.push(`item ${id} started and never completed`);
    }
  }

  return {
    items,
    completionItemCount: input.completedItems.length,
    streamedItemCount: streamed.length,
    omittedFromCompletion,
    missingFromStream,
    unfinishedItemIds,
    streamObserved,
    startsObserved,
    partial: reasons.length > 0,
    reasons,
  };
}
