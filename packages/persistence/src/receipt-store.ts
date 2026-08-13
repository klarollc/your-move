import type { ProjectStore } from "./project-store.js";
type PacketReceipt = {
  packetId: string;
  projectId: string;
  runId: string;
  snapshotId: string;
  status: "valid" | "invalid";
  knowledgeIds: string[];
  qualificationId: string;
  completedWorkIds: string[];
};
export function recordPacketReceipt(store: ProjectStore, input: PacketReceipt): void {
  store.database
    .prepare("INSERT OR REPLACE INTO packet_receipts VALUES(?,?,?,?,?,?)")
    .run(
      input.packetId,
      input.projectId,
      input.runId,
      input.snapshotId,
      input.status,
      JSON.stringify({ kind: "packet", ...input }),
    );
}
export function hasCurrentContext(
  store: ProjectStore,
  runId: string,
  snapshotId: string,
  knowledgeId: string,
): boolean {
  const row = store.database
    .prepare(
      "SELECT packet_json FROM packet_receipts WHERE run_id=? AND snapshot_id=? AND status='valid' ORDER BY packet_id DESC LIMIT 1",
    )
    .get(runId, snapshotId) as { packet_json: string } | undefined;
  return row
    ? (JSON.parse(row.packet_json) as PacketReceipt).knowledgeIds.includes(knowledgeId)
    : false;
}
export function reusableReconnectState(
  store: ProjectStore,
  runId: string,
  snapshotId: string,
): { qualificationId: string; completedWorkIds: string[] } | undefined {
  const row = store.database
    .prepare(
      "SELECT packet_json FROM packet_receipts WHERE run_id=? AND snapshot_id=? AND status='valid' ORDER BY packet_id DESC LIMIT 1",
    )
    .get(runId, snapshotId) as { packet_json: string } | undefined;
  if (!row) return undefined;
  const packet = JSON.parse(row.packet_json) as PacketReceipt;
  return { qualificationId: packet.qualificationId, completedWorkIds: packet.completedWorkIds };
}
type Feedback = {
  feedbackId: string;
  projectId: string;
  runId: string;
  actorId: string;
  version: number;
  content: string;
  createdAt: string;
};
export function recordFeedback(store: ProjectStore, input: Feedback): void {
  store.database
    .prepare("INSERT INTO packet_receipts VALUES(?,?,?,?,?,?)")
    .run(
      `feedback:${input.feedbackId}`,
      input.projectId,
      input.runId,
      "feedback",
      "pending",
      JSON.stringify({ kind: "feedback", ...input }),
    );
}
export function deliverFeedbackAtCheckpoint(
  store: ProjectStore,
  runId: string,
  checkpointId: string,
) {
  return store.database.transaction(() => {
    const rows = store.database
      .prepare(
        "SELECT packet_id,packet_json FROM packet_receipts WHERE run_id=? AND snapshot_id='feedback' AND status='pending' ORDER BY packet_id",
      )
      .all(runId) as { packet_id: string; packet_json: string }[];
    const delivered = rows.map((row) => {
      const feedback = JSON.parse(row.packet_json) as Feedback;
      store.database
        .prepare("UPDATE packet_receipts SET status='delivered' WHERE packet_id=?")
        .run(row.packet_id);
      return {
        feedbackId: feedback.feedbackId,
        actorId: feedback.actorId,
        version: feedback.version,
        content: feedback.content,
        checkpointId,
        disposition: "delivered",
      };
    });
    return delivered;
  })();
}
