import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { openProjectStore, type ProjectStore } from "./project-store.js";
import { listKickoffRecords, storeKickoffRecord } from "./kickoff-store.js";

let store: ProjectStore | undefined;
afterEach(() => store?.close());

describe("kickoff canonical persistence", () => {
  it("persists attributable briefing, entries, dissent, charter, and disposition across restart", () => {
    const root = mkdtempSync(join(tmpdir(), "cuckcode-kickoff-"));
    mkdirSync(root, { recursive: true });
    store = openProjectStore(root);
    for (const [recordId, kind, payload] of [
      [
        "briefing_1",
        "briefing",
        {
          briefingVersion: 1,
          roleIds: ["delivery", "design", "implementation", "test", "visual", "release"],
        },
      ],
      [
        "contribution_release",
        "contribution",
        {
          roleId: "release",
          agentId: "agent_release",
          disagreements: ["Independent review remains separate"],
        },
      ],
      [
        "synthesis_1",
        "synthesis",
        {
          disagreementRegister: [
            { roleId: "release", statement: "Independent review remains separate" },
          ],
        },
      ],
      ["charter_1", "charter", { version: 1, managerId: "manager_local", disposition: "approve" }],
    ] as const) {
      storeKickoffRecord(store, {
        recordId,
        kickoffId: "kickoff_1",
        projectId: "project_graybox",
        kind,
        revision: 1,
        payload,
      });
    }
    store.close();
    store = openProjectStore(root);

    const records = listKickoffRecords(store, "project_graybox", "kickoff_1");
    expect(records.map(({ kind }) => kind)).toEqual([
      "briefing",
      "charter",
      "contribution",
      "synthesis",
    ]);
    expect(JSON.stringify(records)).toContain("Independent review remains separate");
    expect(JSON.stringify(records)).toContain("manager_local");
  });

  it("rejects conflicting immutable record reuse and isolates projects", () => {
    const root = mkdtempSync(join(tmpdir(), "cuckcode-kickoff-"));
    store = openProjectStore(root);
    const record = {
      recordId: "briefing_1",
      kickoffId: "kickoff_1",
      projectId: "project_alpha",
      kind: "briefing" as const,
      revision: 1,
      payload: { briefingVersion: 1 },
    };
    storeKickoffRecord(store, record);
    expect(() =>
      storeKickoffRecord(store!, { ...record, payload: { briefingVersion: 2 } }),
    ).toThrow("KICKOFF_RECORD_CONFLICT");
    storeKickoffRecord(store, {
      ...record,
      recordId: "briefing_beta",
      kickoffId: "kickoff_beta",
      projectId: "project_beta",
    });
    expect(listKickoffRecords(store, "project_alpha", "kickoff_1")).toHaveLength(1);
  });
});
