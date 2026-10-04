import { describe, expect, it } from "vitest";

import { classifyKickoffTurnItems } from "./phase4-kickoff-session.js";

const fileChange = {
  id: "file_1",
  type: "fileChange",
  status: "completed",
  changes: [{ path: "src/result.ts", diff: "+result", kind: { type: "update", move_path: null } }],
};

const message = { id: "message_1", type: "agentMessage", text: "done" };

describe("kickoff turn item classification (DF-047)", () => {
  it("reports a streamed fileChange omitted from turn.items", () => {
    const result = classifyKickoffTurnItems({
      ok: true,
      turn: { items: [message] },
      streamedItems: [fileChange],
    });

    expect(result).toEqual({
      effects: [{ kind: "runtime.file", phase: "completed" }],
      unclassified: [],
    });
  });

  it("reports an item present in both sources once", () => {
    const result = classifyKickoffTurnItems({
      ok: true,
      turn: { items: [fileChange, message] },
      streamedItems: [fileChange],
    });

    expect(result.effects).toEqual([{ kind: "runtime.file", phase: "completed" }]);
  });

  it("fails closed on an unclassified streamed item", () => {
    const result = classifyKickoffTurnItems({
      ok: true,
      turn: { items: [message] },
      streamedItems: [{ id: "novel_1", type: "newRuntimeThing" }],
    });

    expect(result.unclassified).toEqual(["newRuntimeThing"]);
  });

  it("retains a streamed effect when the turn failed", () => {
    const result = classifyKickoffTurnItems({
      ok: false,
      turn: { items: [] },
      streamedItems: [fileChange],
    });

    expect(result.effects).toEqual([{ kind: "runtime.file", phase: "completed" }]);
  });
});
