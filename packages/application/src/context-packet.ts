import { stableStringify } from "@cuckcode/domain";
export type ContextRecord = {
  id: string;
  layer: "foundation" | "work" | "dependencies" | "role" | "supporting" | "provisional";
  content: string;
  status: string;
  authorized: boolean;
  stale?: boolean;
  conflicted?: boolean;
};
const priority: Record<ContextRecord["layer"], number> = {
  foundation: 0,
  work: 1,
  dependencies: 2,
  role: 3,
  supporting: 4,
  provisional: 5,
};
export function assembleContextPacket(input: {
  packetId: string;
  projectId: string;
  snapshotId: string;
  policyVersion: number;
  maxBytes: number;
  maxRecords: number;
  records: ContextRecord[];
}) {
  const permitted = input.records
    .filter((r) => r.authorized && !["rejected", "superseded"].includes(r.status))
    .sort((a, b) => priority[a.layer] - priority[b.layer] || a.id.localeCompare(b.id));
  const contents: ContextRecord[] = [];
  const omissions: { id: string; reason: string }[] = [];
  const errors: { code: string; recordId: string }[] = [];
  let usedBytes = 0;
  for (const record of permitted) {
    const bytes = new TextEncoder().encode(stableStringify(record)).byteLength;
    const mandatory = record.layer === "foundation" || record.layer === "work";
    if (contents.length >= input.maxRecords || usedBytes + bytes > input.maxBytes) {
      if (mandatory) errors.push({ code: "MANDATORY_CONTEXT_EXCEEDS_BUDGET", recordId: record.id });
      else
        omissions.push({
          id: record.id,
          reason: contents.length >= input.maxRecords ? "record_limit" : "byte_limit",
        });
      continue;
    }
    contents.push(record);
    usedBytes += bytes;
  }
  return {
    schemaVersion: 1,
    packetId: input.packetId,
    projectId: input.projectId,
    snapshotId: input.snapshotId,
    policyVersion: input.policyVersion,
    contents,
    omissions,
    errors,
    usedBytes,
    maxBytes: input.maxBytes,
  };
}
