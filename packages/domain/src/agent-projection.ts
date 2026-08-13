import { buildActionableRecords, type ActionableRecord } from "./reciprocal-records.js";
import type { CanonicalProjectSnapshot } from "./replay.js";

export type AgentActionableState = { projectId: string | null; items: ActionableRecord[] };

export function projectAgentActionableState(
  snapshot: CanonicalProjectSnapshot,
): AgentActionableState {
  return { projectId: snapshot.project.projectId, items: buildActionableRecords(snapshot) };
}
