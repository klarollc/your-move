export type RunSyncState = {
  runId: string;
  projectId: string;
  workItemId: string;
  packetId: string;
  snapshotId: string;
  status: "active" | "paused" | "waiting" | "blocked";
  packetValid?: boolean;
  pendingChanges: string[];
  outputLabel?: "stale_snapshot";
  promotionAllowed?: boolean;
  blockedReason?: string;
};
export type KnowledgeChange = {
  changeId: string;
  projectId: string;
  workItemIds: string[];
  critical: boolean;
  kind: string;
};
export function applyKnowledgeChange(
  runs: RunSyncState[],
  change: KnowledgeChange,
): RunSyncState[] {
  return runs.map((run) => {
    if (run.projectId !== change.projectId || !change.workItemIds.includes(run.workItemId))
      return { ...run };
    return {
      ...run,
      status: change.critical ? "paused" : run.status,
      packetValid: !change.critical,
      pendingChanges: [...run.pendingChanges, change.changeId],
      ...(change.critical
        ? { promotionAllowed: false }
        : { outputLabel: "stale_snapshot" as const, promotionAllowed: false }),
    };
  });
}
export function reachSafeCheckpoint(
  run: RunSyncState,
  result:
    | { ok: true; packetId: string; snapshotId: string; acknowledgedChanges: string[] }
    | { ok: false; reason: string },
): RunSyncState {
  if (!result.ok)
    return {
      ...run,
      status: "waiting",
      packetValid: false,
      promotionAllowed: false,
      blockedReason: result.reason,
    };
  const acknowledged = new Set(result.acknowledgedChanges);
  const current = { ...run };
  delete current.outputLabel;
  delete current.blockedReason;
  return {
    ...current,
    status: "active",
    packetId: result.packetId,
    snapshotId: result.snapshotId,
    packetValid: true,
    pendingChanges: run.pendingChanges.filter((id) => !acknowledged.has(id)),
    promotionAllowed: true,
  };
}
