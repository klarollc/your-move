import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  applyKnowledgeChange,
  assembleContextPacket,
  reachSafeCheckpoint,
  type ContextRecord,
  type RunSyncState,
} from "@cuckcode/application";
import { stableStringify } from "@cuckcode/domain";
import {
  createProjectBackup,
  exportProject,
  openProjectStore,
  rebuildKnowledgeIndex,
  recordPacketReceipt,
  searchKnowledge,
  storeContent,
  upsertKnowledge,
  verifyProjectIntegrity,
  type StoredKnowledge,
} from "@cuckcode/persistence";

const hash = (value: unknown) => createHash("sha256").update(stableStringify(value)).digest("hex");
const record = (
  knowledgeId: string,
  projectId: string,
  status: string,
  content: string,
  revision: number,
  sourceId: string,
): StoredKnowledge => ({
  knowledgeId,
  projectId,
  status,
  classification: "project",
  title: knowledgeId,
  content,
  provenance: [{ sourceId, version: revision }],
  revision,
  authorized: true,
});
const contextRecords = (records: StoredKnowledge[]): ContextRecord[] =>
  records.map((item) => ({
    id: item.knowledgeId,
    layer: item.status === "provisional" ? "provisional" : "supporting",
    content: item.content,
    status: item.status,
    authorized: item.authorized,
    ...(item.status === "contested" ? { conflicted: true } : {}),
  }));

export function runSharedKnowledgeAcceptance(input: {
  projectAlphaRoot: string;
  projectBetaRoot: string;
  recoveryRoot: string;
}) {
  const alpha = openProjectStore(input.projectAlphaRoot);
  const beta = openProjectStore(input.projectBetaRoot);
  const lifecycle: string[] = [];
  upsertKnowledge(
    alpha,
    record("alpha_rule", "project_alpha", "provisional", "Use indigo", 1, "agent_researcher"),
  );
  lifecycle.push("provisional");
  upsertKnowledge(
    alpha,
    record("alpha_canary", "project_alpha", "approved", "alphacanary", 1, "manager"),
  );
  upsertKnowledge(
    beta,
    record("beta_canary", "project_beta", "approved", "betacanary", 1, "manager"),
  );
  const contribution = searchKnowledge(alpha, {
    projectId: "project_alpha",
    query: "indigo",
    classifications: ["project"],
  });

  upsertKnowledge(
    alpha,
    record("alpha_rule", "project_alpha", "contested", "Use amber", 2, "agent_reviewer"),
  );
  lifecycle.push("contested");
  const contested = searchKnowledge(alpha, {
    projectId: "project_alpha",
    query: "amber",
    classifications: ["project"],
  });
  const initialPacket = assembleContextPacket({
    packetId: "packet_before_resolution",
    projectId: "project_alpha",
    snapshotId: "snapshot_1",
    policyVersion: 1,
    maxBytes: 4096,
    maxRecords: 20,
    records: contextRecords(contested),
  });
  const runs: RunSyncState[] = ["researcher", "reviewer"].map((role) => ({
    runId: `run_${role}`,
    projectId: "project_alpha",
    workItemId: `work_${role}`,
    packetId: initialPacket.packetId,
    snapshotId: initialPacket.snapshotId,
    status: "active",
    packetValid: true,
    pendingChanges: [],
    promotionAllowed: true,
  }));
  const paused = applyKnowledgeChange(runs, {
    changeId: "change_resolution_required",
    projectId: "project_alpha",
    workItemIds: runs.map((run) => run.workItemId),
    critical: true,
    kind: "knowledge.contested",
  });

  upsertKnowledge(alpha, {
    ...record("alpha_rule", "project_alpha", "approved", "Use indigo", 3, "manager"),
    provenance: [
      { sourceId: "agent_researcher", version: 1 },
      { sourceId: "agent_reviewer", version: 2 },
      { sourceId: "manager", version: 3 },
    ],
  });
  lifecycle.push("approved");
  const resolved = searchKnowledge(alpha, {
    projectId: "project_alpha",
    query: "indigo",
    classifications: ["project"],
  });
  const rebuildBefore = hash(resolved);
  rebuildKnowledgeIndex(alpha, "project_alpha");
  const rebuilt = searchKnowledge(alpha, {
    projectId: "project_alpha",
    query: "indigo",
    classifications: ["project"],
  });
  const rebuildAfter = hash(rebuilt);
  const packetInput = {
    packetId: "packet_after_resolution",
    projectId: "project_alpha",
    snapshotId: "snapshot_2",
    policyVersion: 1,
    maxBytes: 4096,
    maxRecords: 20,
    records: contextRecords(rebuilt),
  };
  const packet = assembleContextPacket(packetInput);
  const refreshed = paused.map((run) =>
    reachSafeCheckpoint(run, {
      ok: true,
      packetId: packet.packetId,
      snapshotId: packet.snapshotId,
      acknowledgedChanges: ["change_resolution_required"],
    }),
  );
  refreshed.forEach((run) =>
    recordPacketReceipt(alpha, {
      packetId: `${packet.packetId}:${run.runId}`,
      projectId: "project_alpha",
      runId: run.runId,
      snapshotId: packet.snapshotId,
      status: "valid",
      knowledgeIds: packet.contents.map((item) => item.id),
      qualificationId: `qualification_${run.runId}`,
      completedWorkIds: ["research_complete"],
    }),
  );
  const resolutionRecipients = Number(
    alpha.database
      .prepare("SELECT count(*) FROM packet_receipts WHERE snapshot_id=? AND status='valid'")
      .pluck()
      .get(packet.snapshotId),
  );
  storeContent(alpha, {
    recordId: "evidence_resolution",
    projectId: "project_alpha",
    kind: "evidence",
    mediaType: "text/plain",
    classification: "project",
    bytes: Buffer.from("manager approved indigo"),
  });

  const alphaCanaryCrossed =
    searchKnowledge(beta, {
      projectId: "project_beta",
      query: "alphacanary",
      classifications: ["project"],
    }).length > 0;
  const betaCanaryCrossed =
    searchKnowledge(alpha, {
      projectId: "project_alpha",
      query: "betacanary",
      classifications: ["project"],
    }).length > 0;
  const schemaHash = hash({ alpha: alpha.schema(), beta: beta.schema() });
  const backup = createProjectBackup(alpha, join(input.recoveryRoot, "alpha-backup"));
  const exported = exportProject(alpha, join(input.recoveryRoot, "alpha-export"));
  alpha.close();
  beta.close();

  const restarted = openProjectStore(input.projectAlphaRoot);
  const restart = hash(
    searchKnowledge(restarted, {
      projectId: "project_alpha",
      query: "indigo",
      classifications: ["project"],
    }),
  );
  restarted.close();
  const backupStore = openProjectStore(join(input.recoveryRoot, "alpha-backup"));
  const backupIntegrity = verifyProjectIntegrity(backupStore).databaseIntegrity;
  backupStore.close();
  const exportStore = openProjectStore(join(input.recoveryRoot, "alpha-export"));
  const exportIntegrity = verifyProjectIntegrity(exportStore).databaseIntegrity;
  exportStore.close();

  return {
    lifecycle,
    retrieval: {
      provisionalFound: contribution[0]?.status === "provisional",
      contestedFound: contested[0]?.status === "contested",
      approvedFound: resolved[0]?.status === "approved",
    },
    isolation: { alphaCanaryCrossed, betaCanaryCrossed },
    propagation: {
      pausedBeforeAction: paused.every(
        (run) => run.status === "paused" && run.packetValid === false,
      ),
      refreshedAtCheckpoint: refreshed.every(
        (run) =>
          run.status === "active" && run.packetValid === true && run.pendingChanges.length === 0,
      ),
    },
    resolutionRecipients,
    recovery: { backupIntegrity, exportIntegrity },
    hashes: {
      schema: schemaHash,
      rebuildBefore,
      rebuildAfter,
      restart,
      backupDatabase: backup.databaseHash,
      exportDatabase: exported.databaseHash,
      packet: hash(packet),
      packetRepeat: hash(assembleContextPacket(packetInput)),
    },
  };
}
