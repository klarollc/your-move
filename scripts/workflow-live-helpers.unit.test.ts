import { createHash } from "node:crypto";
import { posix, win32 } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildWorkflowPrompt,
  checkAllowance,
  parsePorcelain,
  relativizeChanges,
  verifyContextFiles,
  type AttemptLedgerEntry,
} from "./workflow-live-helpers.js";

describe("parsePorcelain", () => {
  it("lists modified, added, deleted and untracked paths, sorted and unique", () => {
    const out = [
      " M src/b.ts",
      "A  src/a.ts",
      " D gone.ts",
      "?? new/file.ts",
      " M src/b.ts",
      "",
    ].join("\n");
    expect(parsePorcelain(out)).toEqual(["gone.ts", "new/file.ts", "src/a.ts", "src/b.ts"]);
  });

  it("lists both sides of a rename", () => {
    expect(parsePorcelain("R  old.ts -> new.ts\n")).toEqual(["new.ts", "old.ts"]);
  });

  it("unquotes paths git quotes for spaces", () => {
    expect(parsePorcelain('?? "dir with space/a b.ts"\n')).toEqual(["dir with space/a b.ts"]);
  });

  it("returns nothing for a clean tree", () => {
    expect(parsePorcelain("")).toEqual([]);
    expect(parsePorcelain("\n")).toEqual([]);
  });
});

describe("relativizeChanges", () => {
  it("makes absolute and relative POSIX paths worktree-relative", () => {
    const changes = [
      { path: "/w/src/a.ts", kind: "update", movePath: null },
      { path: "src/b.ts", kind: "add", movePath: null },
    ];
    expect(relativizeChanges("/w", changes, posix)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("handles Windows drive paths and backslashes, and includes a move target", () => {
    const changes = [
      { path: "C:\\w\\src\\a.ts", kind: "update", movePath: null },
      { path: "old.ts", kind: "update", movePath: "C:\\w\\new.ts" },
    ];
    expect(relativizeChanges("C:\\w", changes, win32)).toEqual(["new.ts", "old.ts", "src/a.ts"]);
  });
});

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

describe("verifyContextFiles", () => {
  it("returns the file contents when every digest matches", () => {
    const result = verifyContextFiles([{ path: "src/a.ts", sha256: sha("export {}\n") }], () =>
      Buffer.from("export {}\n"),
    );
    expect(result).toEqual({ ok: true, files: [{ path: "src/a.ts", content: "export {}\n" }] });
  });

  it("names a file whose digest no longer matches, and a file that is missing", () => {
    const result = verifyContextFiles(
      [
        { path: "a.ts", sha256: sha("one") },
        { path: "b.ts", sha256: sha("two") },
      ],
      (path) => (path === "a.ts" ? Buffer.from("changed") : null),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" | ")).toContain("a.ts");
    expect(result.issues.join(" | ")).toContain("b.ts");
  });
});

describe("buildWorkflowPrompt", () => {
  const contract = {
    outcome: "Implement slugify so the test passes",
    exclusions: ["no other files"],
    acceptanceCriteria: ["the test is green"],
    dependencies: ["pinned Codex"],
    evidenceObligations: [{ kind: "test-run", description: "RED then GREEN" }],
    permissionCeiling: {
      sandboxMode: "workspace-write" as const,
      approvalPolicy: "never",
      networkAccess: false as const,
      windowsSandbox: "unelevated" as const,
    },
    stopConditions: ["turn cap"],
    definitionOfDone: "owner acceptance",
    contextRefs: [],
  };
  const prompt = buildWorkflowPrompt({
    contract,
    contextFiles: [{ path: "src/slugify.ts", content: "export const slugify = () => '';\n" }],
    marker: "TRACER_RESULT:",
  });

  it("states the contract fields and inlines each file under its path", () => {
    for (const text of [
      "Implement slugify so the test passes",
      "no other files",
      "the test is green",
      "RED then GREEN",
      "turn cap",
      "owner acceptance",
      "src/slugify.ts",
      "export const slugify = () => '';",
    ]) {
      expect(prompt).toContain(text);
    }
  });

  it("tells the role what it can and cannot do, and how to end", () => {
    expect(prompt).toContain("cannot read files");
    expect(prompt).toContain("cannot run commands");
    expect(prompt).toContain("TRACER_RESULT: done");
    expect(prompt).toContain("TRACER_RESULT: blocked");
    expect(prompt.toLowerCase()).toContain("ambigu");
  });
});

const entry = (over: Partial<AttemptLedgerEntry>): AttemptLedgerEntry => ({
  runId: "r",
  surface: "B",
  workItemId: "work_slug",
  observedAt: "2026-10-04T10:00:00.000Z",
  turnsUsed: 3,
  outcome: "turn_cap",
  transcriptSha256: null,
  ...over,
});
const limits = { maxAttempts: 10, maxTurnsPerAttempt: 10, turnCeiling: 100 };

describe("checkAllowance", () => {
  it("allows a first attempt the full per-attempt turns", () => {
    expect(checkAllowance([], "B", limits)).toEqual({ ok: true, turnsAvailable: 10 });
  });

  it("counts attempts and turns per surface, not across surfaces", () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      entry({ runId: `a${String(i)}`, surface: "A", outcome: i % 2 ? "turn_cap" : "hard_stop" }),
    );
    expect(checkAllowance(entries, "A", limits)).toMatchObject({
      ok: false,
      code: "ALLOWANCE_EXHAUSTED",
    });
    expect(checkAllowance(entries, "B", limits)).toEqual({ ok: true, turnsAvailable: 10 });
  });

  it("limits turns to what is left under the ceiling", () => {
    const entries = Array.from({ length: 9 }, (_, i) =>
      entry({ runId: `a${String(i)}`, turnsUsed: 10, outcome: i % 2 ? "turn_cap" : "hard_stop" }),
    );
    expect(checkAllowance(entries, "B", limits)).toEqual({ ok: true, turnsAvailable: 10 });
    const more = [...entries, entry({ runId: "z", turnsUsed: 5, outcome: "claim_unsupported" })];
    expect(checkAllowance(more, "B", { ...limits, maxAttempts: 11 })).toEqual({
      ok: true,
      turnsAvailable: 5,
    });
  });

  it("applies the stop rule: two consecutive attempts that ended for the same reason", () => {
    const entries = [
      entry({ runId: "1", outcome: "hard_stop" }),
      entry({ runId: "2", outcome: "hard_stop" }),
    ];
    expect(checkAllowance(entries, "B", limits)).toMatchObject({ ok: false, code: "STOP_RULE" });
  });

  it("does not apply the stop rule across a different outcome, a success, or another surface", () => {
    expect(
      checkAllowance(
        [entry({ runId: "1", outcome: "hard_stop" }), entry({ runId: "2", outcome: "turn_cap" })],
        "B",
        limits,
      ),
    ).toMatchObject({ ok: true });
    expect(
      checkAllowance(
        [
          entry({ runId: "1", outcome: "review_requested" }),
          entry({ runId: "2", outcome: "review_requested" }),
        ],
        "B",
        limits,
      ),
    ).toMatchObject({ ok: true });
    expect(
      checkAllowance(
        [
          entry({ runId: "1", surface: "A", outcome: "hard_stop" }),
          entry({ runId: "2", outcome: "hard_stop" }),
        ],
        "B",
        limits,
      ),
    ).toMatchObject({ ok: true });
  });
});
