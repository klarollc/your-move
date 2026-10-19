import { z } from "zod";

/** Projection-only loopback message; deliberately not a ProjectEvent. */
export const sharedLampVerdictMessageSchema = z
  .object({
    type: z.literal("lamp.verdict"),
    attemptId: z.string().min(1),
    utteranceId: z.string().min(1),
    verdict: z.enum(["lamp", "no-lamp"]),
    ts: z.string().datetime({ offset: true }),
  })
  .strict();

export type LampVerdictMessage = z.infer<typeof sharedLampVerdictMessageSchema>;
