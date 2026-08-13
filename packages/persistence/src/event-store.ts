import { createHash } from "node:crypto";
import { parseProjectEvent, type ProjectEvent } from "@cuckcode/contracts";
import { stableStringify } from "@cuckcode/domain";
import type { ProjectStore } from "./project-store.js";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function appendEvents(
  store: ProjectStore,
  projectId: string,
  input: readonly unknown[],
): void {
  const parsed = input.map((value) => {
    const result = parseProjectEvent(value);
    if (!result.ok) throw new Error("CUCKCODE_INVALID_EVENT");
    if (result.value.projectId !== projectId) throw new Error("CUCKCODE_EVENT_PROJECT_MISMATCH");
    return result.value;
  });
  store.database.transaction(() => {
    for (const event of parsed) {
      const json = stableStringify(event);
      const contentHash = hash(json);
      const existing = store.database
        .prepare("SELECT content_hash FROM canonical_events WHERE event_id=?")
        .get(event.eventId) as { content_hash: string } | undefined;
      if (existing) {
        if (existing.content_hash !== contentHash) throw new Error("CUCKCODE_EVENT_ID_CONFLICT");
        continue;
      }
      store.database
        .prepare("INSERT INTO canonical_events VALUES(?,?,?,?,?,?,?)")
        .run(
          event.eventId,
          event.projectId,
          event.occurredAt,
          event.receivedAt,
          event.kind,
          json,
          contentHash,
        );
    }
  })();
}
export function readEvents(store: ProjectStore, projectId: string): ProjectEvent[] {
  return (
    store.database
      .prepare(
        "SELECT canonical_json FROM canonical_events WHERE project_id=? ORDER BY occurred_at, received_at, event_id",
      )
      .all(projectId) as { canonical_json: string }[]
  ).map((row) => JSON.parse(row.canonical_json) as ProjectEvent);
}
