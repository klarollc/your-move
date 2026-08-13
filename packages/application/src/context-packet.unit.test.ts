import { describe, expect, it } from "vitest";
import { assembleContextPacket, type ContextRecord } from "./context-packet.js";
const records: ContextRecord[] = [
  { id: "foundation", layer: "foundation", content: "scope", status: "approved", authorized: true },
  { id: "work", layer: "work", content: "task", status: "approved", authorized: true },
  {
    id: "source",
    layer: "supporting",
    content: "support",
    status: "authoritative",
    authorized: true,
  },
  {
    id: "secret",
    layer: "supporting",
    content: "SECRET TITLE",
    status: "approved",
    authorized: false,
  },
  {
    id: "rejected",
    layer: "provisional",
    content: "rejected text",
    status: "rejected",
    authorized: true,
  },
];
describe("context packets", () => {
  it("is byte deterministic and ordered by policy", () => {
    const input = {
      packetId: "packet_1",
      projectId: "project_alpha",
      snapshotId: "snapshot_1",
      policyVersion: 1,
      maxBytes: 1000,
      maxRecords: 10,
      records,
    };
    expect(assembleContextPacket(input)).toEqual(
      assembleContextPacket({ ...input, records: [...records].reverse() }),
    );
    expect(assembleContextPacket(input).contents.map((r) => r.id)).toEqual([
      "foundation",
      "work",
      "source",
    ]);
  });
  it("records omissions and never silently drops mandatory controls", () => {
    const packet = assembleContextPacket({
      packetId: "packet_1",
      projectId: "project_alpha",
      snapshotId: "snapshot_1",
      policyVersion: 1,
      maxBytes: 8,
      maxRecords: 2,
      records,
    });
    expect(packet.omissions.map((o) => o.id)).toContain("source");
    expect(packet.errors).toContainEqual({
      code: "MANDATORY_CONTEXT_EXCEEDS_BUDGET",
      recordId: "foundation",
    });
    expect(JSON.stringify(packet)).not.toContain("SECRET TITLE");
    expect(JSON.stringify(packet)).not.toContain("rejected text");
  });
});
