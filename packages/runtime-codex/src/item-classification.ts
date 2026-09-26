/**
 * Which turn items are text and which are effects (R5, CX-2).
 *
 * Before this table there were two allow-lists of known effect types, one in the kickoff session
 * and one in the role exercise, and anything not on them counted as text. The pinned vocabulary
 * already held six unlisted types (`imageView`, `subAgentActivity`, `hookPrompt`, `sleep`, and the
 * two review-mode markers), and the current pin added `functionCallOutput`. Now every type is
 * named, the table is tested against the pinned schema's own vocabulary, and a type nobody has
 * classified is `unclassified` — which stops a run rather than passing as text.
 *
 * The rule for a new type is conservative: a wrong `effect` costs a stopped turn; a wrong `text`
 * costs the no-external-effect guarantee.
 */
export type ItemClass = "text" | "effect";

export const ITEM_CLASSIFICATION: Readonly<Record<string, ItemClass>> = {
  agentMessage: "text",
  contextCompaction: "text",
  plan: "text",
  reasoning: "text",
  userMessage: "text",
  collabAgentToolCall: "effect",
  commandExecution: "effect",
  dynamicToolCall: "effect",
  enteredReviewMode: "effect",
  exitedReviewMode: "effect",
  fileChange: "effect",
  functionCallOutput: "effect",
  hookPrompt: "effect",
  imageGeneration: "effect",
  imageView: "effect",
  mcpToolCall: "effect",
  sleep: "effect",
  subAgentActivity: "effect",
  webSearch: "effect",
};

export function classifyItem(type: string): ItemClass | "unclassified" {
  return Object.hasOwn(ITEM_CLASSIFICATION, type)
    ? (ITEM_CLASSIFICATION[type] as ItemClass)
    : "unclassified";
}

/** A turn's item types that are effects, and those nobody has classified. Text is dropped. */
export function classifyTurnItems(items: readonly unknown[]): {
  effects: string[];
  unclassified: string[];
} {
  const effects: string[] = [];
  const unclassified: string[] = [];
  for (const item of items) {
    const raw =
      typeof item === "object" && item !== null ? (item as { type?: unknown }).type : undefined;
    const type = typeof raw === "string" && raw.length > 0 ? raw : "unknown";
    const kind = classifyItem(type);
    if (kind === "effect") effects.push(type);
    else if (kind === "unclassified") unclassified.push(type);
  }
  return { effects, unclassified };
}
