import { posix, win32 } from "node:path";
import { expect, test } from "vitest";

import {
  checkObservedPosture,
  describeInstructionSources,
  isInsideWorktree,
  judgeTracerTurn,
  lastAgentMessageText,
  parseResultLine,
  type ItemClassifier,
} from "./tracer-guards.js";

// Mirrors the real table's shape; the runner injects the real `classifyItem`.
const classify: ItemClassifier = (type) =>
  (({
    agentMessage: "text",
    reasoning: "text",
    userMessage: "text",
    fileChange: "effect",
    commandExecution: "effect",
    mcpToolCall: "effect",
  })[type] as "text" | "effect" | undefined) ?? "unclassified";

const WT = "/work/wt";
const turn = (items: unknown[], over: Record<string, unknown> = {}) => ({
  id: "t1",
  status: "completed",
  items,
  ...over,
});
const edit = (path: string, extra: Record<string, unknown> = {}) => ({
  type: "fileChange",
  id: "f",
  status: "completed",
  changes: [{ path, diff: "", kind: { type: "update", move_path: null } }],
  ...extra,
});
const msg = (text: string) => ({ type: "agentMessage", id: "m", text });
const judge = (t: unknown, pathApi = posix, worktree = WT) =>
  judgeTracerTurn({ turn: t, threadId: "th", expectedTurnId: "t1", worktree, classify, pathApi });

test("paths: inside, relative, traversal, root, .git, absolute outside", () => {
  expect(isInsideWorktree(WT, "packages/a.ts")).toBe(true);
  expect(isInsideWorktree(WT, "/work/wt/packages/a.ts")).toBe(true);
  expect(isInsideWorktree(WT, "../x.ts")).toBe(false);
  expect(isInsideWorktree(WT, "a/../../x.ts")).toBe(false);
  expect(isInsideWorktree(WT, "/work/wt-evil/x.ts")).toBe(false); // prefix lookalike
  expect(isInsideWorktree(WT, "/etc/passwd")).toBe(false);
  expect(isInsideWorktree(WT, ".")).toBe(false);
  expect(isInsideWorktree(WT, ".git")).toBe(false);
  expect(isInsideWorktree(WT, ".git/config")).toBe(false);
  expect(isInsideWorktree(WT, ".github/x.yml")).toBe(true);
  expect(isInsideWorktree(WT, "")).toBe(false);
});

test("paths: windows drive letters and case", () => {
  const root = "C:\\Users\\nater\\CuckCode\\.worktrees\\tracer";
  expect(isInsideWorktree(root, "packages\\a.ts", win32)).toBe(true);
  expect(isInsideWorktree(root, `${root}\\a.ts`, win32)).toBe(true);
  expect(isInsideWorktree(root, "D:\\x.ts", win32)).toBe(false);
  expect(isInsideWorktree(root, "..\\CuckCode\\a.ts", win32)).toBe(false);
  expect(isInsideWorktree(root, ".git", win32)).toBe(false);
});

test("result line: must start a line; last wins; prose mention ignored", () => {
  expect(parseResultLine("TRACER_RESULT: done — test green")).toEqual({
    verdict: "done",
    summary: "test green",
  });
  expect(parseResultLine("I will end with TRACER_RESULT: done later")).toBe(null);
  expect(parseResultLine("`TRACER_RESULT: done` is the format")).toBe(null);
  expect(parseResultLine("TRACER_RESULT: maybe")).toBe(null);
  expect(parseResultLine("TRACER_RESULT: blocked - x\nTRACER_RESULT: done - y")).toEqual({
    verdict: "done",
    summary: "y",
  });
  expect(parseResultLine("TRACER_RESULT: donezo")).toBe(null);
});

test("last agent message is read from the item, not the whole turn", () => {
  expect(lastAgentMessageText([msg("a"), { type: "reasoning" }, msg("b")])).toBe("b");
  expect(lastAgentMessageText([{ type: "reasoning" }])).toBe(null);
});

test("judge: edits inside the worktree pass and are recorded", () => {
  const v = judge(turn([edit("a.ts"), msg("TRACER_RESULT: done — ok")]));
  expect(v.ok).toBe(true);
  if (v.ok) {
    expect(v.fileChanges.map((c) => c.path)).toEqual(["a.ts"]);
    expect(v.resultLine?.verdict).toBe("done");
  }
});

test("judge: an edit outside the worktree stops the run", () => {
  const v = judge(turn([edit("../../etc/x")]));
  expect(v.ok).toBe(false);
  if (!v.ok) expect(v.code).toBe("FILE_CHANGE_OUTSIDE_WORKTREE");
});

test("judge: a rename whose target escapes stops the run", () => {
  const item = edit("a.ts");
  (item.changes[0] as { kind: unknown }).kind = { type: "update", move_path: "/tmp/a.ts" };
  const v = judge(turn([item]));
  expect(v.ok).toBe(false);
  if (!v.ok) expect(v.code).toBe("FILE_CHANGE_OUTSIDE_WORKTREE");
});

test("judge: commands and other effects still stop the run", () => {
  for (const type of ["commandExecution", "mcpToolCall"]) {
    const v = judge(turn([{ type }, msg("x")]));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("EXTERNAL_EFFECT_OBSERVED");
  }
});

test("judge: unclassified type, failed edit, unreadable edit, wrong turn", () => {
  let v = judge(turn([{ type: "brandNewThing" }]));
  expect(!v.ok && v.code).toBe("UNCLASSIFIED_ITEM_TYPE");
  v = judge(turn([edit("a.ts", { status: "failed" })]));
  expect(!v.ok && v.code).toBe("FILE_CHANGE_NOT_COMPLETED");
  v = judge(turn([edit("a.ts", { changes: [] })]));
  expect(!v.ok && v.code).toBe("FILE_CHANGE_UNREADABLE");
  v = judge(turn([msg("x")], { id: "other" }));
  expect(!v.ok && v.code).toBe("TURN_COMPLETION_INVALID");
  v = judge(turn([msg("x")], { status: "failed" }));
  expect(!v.ok && v.code).toBe("TURN_COMPLETION_INVALID");
});

test("posture: workspaceWrite, no network, approval never — read back, not requested", () => {
  const ok = { sandbox: { type: "workspaceWrite", networkAccess: false }, approvalPolicy: "never" };
  expect(checkObservedPosture(ok).ok).toBe(true);
  expect(
    checkObservedPosture({ ...ok, sandbox: { type: "readOnly", networkAccess: false } }).ok,
  ).toBe(false);
  expect(
    checkObservedPosture({ ...ok, sandbox: { type: "workspaceWrite", networkAccess: true } }).ok,
  ).toBe(false);
  expect(checkObservedPosture({ ...ok, approvalPolicy: "on-request" }).ok).toBe(false);
  expect(checkObservedPosture({}).ok).toBe(false);
});

test("instruction sources: paths are named for diagnosis; malformed reports are stated", () => {
  expect(
    describeInstructionSources({ instructionSources: ["/h/AGENTS.md", "/wt/AGENTS.md"] }),
  ).toBe('instructionSources (2): ["/h/AGENTS.md","/wt/AGENTS.md"]');
  expect(describeInstructionSources({ instructionSources: [] })).toBe("instructionSources (0): []");
  expect(describeInstructionSources({ instructionSources: [1] })).toContain("<non-string entry>");
  expect(describeInstructionSources({})).toBe("instructionSources: not reported as a list");
  expect(describeInstructionSources(null)).toBe("instructionSources: not reported as a list");
});
