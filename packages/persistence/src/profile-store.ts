import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectStore } from "./project-store.js";
export function addNotebookEntry(
  store: ProjectStore,
  input: {
    entryId: string;
    agentId: string;
    content: string;
    classification: string;
    createdAt: string;
  },
) {
  if (
    ["project-fact", "requirement", "decision", "risk", "blocker", "evidence"].includes(
      input.classification,
    )
  )
    return { stored: false, routedToShared: true, status: "provisional" };
  const version = (
    store.database
      .prepare(
        "SELECT COALESCE(MAX(version),0)+1 AS v FROM notebook_entries WHERE project_id=? AND agent_id=?",
      )
      .get(projectId(store), input.agentId) as { v: number }
  ).v;
  store.database
    .prepare("INSERT INTO notebook_entries VALUES(?,?,?,?,?,?,?,?)")
    .run(
      input.entryId,
      projectId(store),
      input.agentId,
      version,
      1,
      input.content,
      input.classification,
      input.createdAt,
    );
  return { stored: true, routedToShared: false, version };
}
export function disableNotebook(store: ProjectStore, agentId: string, createdAt: string): void {
  const version = (
    store.database
      .prepare(
        "SELECT COALESCE(MAX(version),0)+1 AS v FROM notebook_entries WHERE project_id=? AND agent_id=?",
      )
      .get(projectId(store), agentId) as { v: number }
  ).v;
  store.database
    .prepare("INSERT INTO notebook_entries VALUES(?,?,?,?,?,?,?,?)")
    .run(
      `notebook-control-${agentId}-${version}`,
      projectId(store),
      agentId,
      version,
      0,
      "disabled",
      "control",
      createdAt,
    );
}
export function listNotebookHistory(store: ProjectStore, agentId: string) {
  return store.database
    .prepare(
      "SELECT entry_id AS entryId,version,enabled,content,classification,created_at AS createdAt FROM notebook_entries WHERE project_id=? AND agent_id=? ORDER BY version",
    )
    .all(projectId(store), agentId);
}
type Portable = {
  entryId: string;
  agentId: string;
  content: string;
  managerApprovalId: string;
  createdAt: string;
  revoked?: boolean;
};
export function promotePortableLesson(
  root: string,
  input: Portable & { forbiddenMarkers: string[] },
): void {
  if (
    input.forbiddenMarkers.some(
      (marker) => marker.length > 0 && input.content.toLowerCase().includes(marker.toLowerCase()),
    ) ||
    /[A-Za-z]:[\\/]/.test(input.content)
  )
    throw new Error("CUCKCODE_PROFILE_SANITIZATION_REQUIRED");
  mkdirSync(root, { recursive: true });
  const path = join(root, "portable-profile.json");
  const current = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Portable[]) : [];
  const next = [
    ...current,
    {
      entryId: input.entryId,
      agentId: input.agentId,
      content: input.content,
      managerApprovalId: input.managerApprovalId,
      createdAt: input.createdAt,
    },
  ];
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(next));
  renameSync(temporary, path);
}
export function readPortableProfile(root: string, agentId: string): Portable[] {
  const path = join(root, "portable-profile.json");
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, "utf8")) as Portable[]).filter(
    (e) => e.agentId === agentId && !e.revoked,
  );
}
function projectId(store: ProjectStore): string {
  return (
    (
      store.database.prepare("SELECT project_id FROM canonical_events LIMIT 1").get() as
        { project_id: string } | undefined
    )?.project_id ?? `project:${store.root}`
  );
}
