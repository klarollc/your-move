import { z } from "zod";

const safeRelativePath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.startsWith("\\") &&
      !/^[A-Za-z]:[\\/]/.test(value) &&
      !value.split(/[\\/]/).includes(".."),
  );
const recordSchema = z.object({
  schemaVersion: z.literal(1),
  recordType: z.enum([
    "artifact",
    "evidence",
    "knowledge",
    "source",
    "notebook",
    "portable-profile",
  ]),
  recordId: z.string().min(1),
  projectId: z.string().min(1),
  relativePath: safeRelativePath,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: z
    .array(z.object({ sourceId: z.string().min(1), version: z.number().int().positive() }))
    .min(1),
});
export type PersistenceRecord = z.infer<typeof recordSchema>;
export function parsePersistenceRecord(
  input: unknown,
):
  | { ok: true; value: PersistenceRecord }
  | { ok: false; error: { code: "INVALID_PERSISTENCE_RECORD"; details: string[] } } {
  const parsed = recordSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        error: {
          code: "INVALID_PERSISTENCE_RECORD",
          details: parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .sort(),
        },
      };
}
