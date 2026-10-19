import { z } from "zod";

/** Shared interchange record for a runtime utterance and its locked lamp verdict. */
export const sharedUtteranceVerdictSchema = z
  .object({
    id: z.string().min(1),
    session_id: z.string().min(1),
    index: z.number().int().positive(),
    sourceItemId: z.string().min(1),
    turnIndex: z.number().int().positive(),
    speaker: z.literal("assistant"),
    text: z.string().min(1),
    timestamp: z.string().datetime({ offset: true }),
    gold_lamp: z.null(),
    gold_speech_act: z.null(),
    ambiguous: z.null(),
    source: z.literal("runtime"),
    notes: z.string(),
    verdict: z.enum(["lamp", "no-lamp"]),
    verdictTs: z.string().datetime({ offset: true }),
    promptVersion: z.string().min(1),
  })
  .strict();

export type VerdictRow = z.infer<typeof sharedUtteranceVerdictSchema>;
