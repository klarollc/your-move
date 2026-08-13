import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  addNotebookEntry,
  disableNotebook,
  listNotebookHistory,
  promotePortableLesson,
  readPortableProfile,
} from "./profile-store.js";
import { openProjectStore } from "./project-store.js";
const roots: string[] = [];
const make = (p: string) => {
  const r = mkdtempSync(join(tmpdir(), p));
  roots.push(r);
  return r;
};
afterEach(() => roots.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));
describe("notebook and portable profile isolation", () => {
  it("versions notebook history and routes project facts", () => {
    const s = openProjectStore(make("cuckcode-notebook-"));
    expect(
      addNotebookEntry(s, {
        entryId: "note_1",
        agentId: "agent_1",
        content: "I prefer concise handoffs",
        classification: "preference",
        createdAt: "2026-08-13T00:00:00.000Z",
      }),
    ).toMatchObject({ stored: true });
    expect(
      addNotebookEntry(s, {
        entryId: "note_2",
        agentId: "agent_1",
        content: "Project Alpha secret requirement",
        classification: "project-fact",
        createdAt: "2026-08-13T00:00:01.000Z",
      }),
    ).toMatchObject({ stored: false, routedToShared: true });
    disableNotebook(s, "agent_1", "2026-08-13T00:00:02.000Z");
    expect(listNotebookHistory(s, "agent_1")).toHaveLength(2);
    s.close();
  });
  it("blocks project canaries from portable promotion and isolates roots", () => {
    const profileRoot = make("cuckcode-profile-");
    const projectA = openProjectStore(make("cuckcode-a-"));
    const projectB = openProjectStore(make("cuckcode-b-"));
    expect(() =>
      promotePortableLesson(profileRoot, {
        entryId: "profile_1",
        agentId: "agent_1",
        content: "Use CANARY_ALPHA from C:\\ClientA",
        managerApprovalId: "approval_1",
        createdAt: "2026-08-13T00:00:00.000Z",
        forbiddenMarkers: ["CANARY_ALPHA", "ClientA"],
      }),
    ).toThrow("CUCKCODE_PROFILE_SANITIZATION_REQUIRED");
    promotePortableLesson(profileRoot, {
      entryId: "profile_2",
      agentId: "agent_1",
      content: "Confirm assumptions before handoff",
      managerApprovalId: "approval_2",
      createdAt: "2026-08-13T00:00:01.000Z",
      forbiddenMarkers: ["CANARY_ALPHA"],
    });
    expect(JSON.stringify(readPortableProfile(profileRoot, "agent_1"))).not.toContain(
      "CANARY_ALPHA",
    );
    expect(projectA.root).not.toBe(projectB.root);
    projectA.close();
    projectB.close();
  });
});
