/**
 * The `posture.recorded` payload (workflow-proof W6a, spec §4, P-2).
 *
 * One record per attempt: the runner reads the posture back from the runtime and records what was
 * requested, what was granted and what the role is declared able to do. It is a measured fact, not
 * evidence a manager asks for, and it carries no state: the schema is strict, so a payload that
 * tries to supply a state or a verdict is refused by name.
 */
import { z } from "zod";

import { postureRecordSchema, type PostureRecord } from "./posture.js";
import type { WorkPayloadResult } from "./work-payloads.js";

export const postureRecordedPayloadSchema = z
  .object({
    workItemId: z.string().regex(/^work_[A-Za-z0-9][A-Za-z0-9._-]*$/),
    runId: z.string().min(1),
    posture: postureRecordSchema,
  })
  .strict();

export type PostureRecordedPayload = Readonly<{
  workItemId: string;
  runId: string;
  posture: PostureRecord;
}>;

export function validatePostureRecordedPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<PostureRecordedPayload> {
  const parsed = postureRecordedPayloadSchema.safeParse(payload);
  if (parsed.success) return { ok: true, value: parsed.data as PostureRecordedPayload };
  const issues = parsed.error.issues.flatMap((found) =>
    found.code === "unrecognized_keys"
      ? found.keys.map((key) => `${key}: field is not allowed in a posture record`)
      : [`${found.path.join(".") || "(root)"}: ${found.message}`],
  );
  return { ok: false, issues };
}
