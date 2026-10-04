import { describe, expect, it } from "vitest";

import { reconcileTurnRecord } from "./turn-record.js";

const agent = { type: "agentMessage", id: "a1", text: "done" };
const user = { type: "userMessage", id: "u1" };
const reasoning = { type: "reasoning", id: "r1" };
const edit = { type: "fileChange", id: "f1", changes: [] };

describe("reconcileTurnRecord", () => {
  it("treats the normal Codex shape as complete: the completion record carries only the final message", () => {
    // Every real session log that contains items has this shape (W2 measurement, 6 of 6 turns).
    const result = reconcileTurnRecord({
      completedItems: [agent],
      streamedItems: [user, reasoning, edit, agent],
      startedItemIds: ["u1", "r1", "f1", "a1"],
    });
    expect(result.partial).toBe(false);
    expect(result.reasons).toEqual([]);
    expect(result.omittedFromCompletion).toBe(3);
    expect(result.completionItemCount).toBe(1);
    expect(result.streamedItemCount).toBe(4);
  });

  it("returns every distinct item once, the completion record's items first", () => {
    const result = reconcileTurnRecord({
      completedItems: [agent],
      streamedItems: [user, reasoning, edit, agent],
      startedItemIds: ["u1", "r1", "f1", "a1"],
    });
    expect(result.items).toEqual([agent, user, reasoning, edit]);
  });

  it("is partial when the completion record holds an item the stream never showed", () => {
    const result = reconcileTurnRecord({
      completedItems: [agent, { type: "commandExecution", id: "c1" }],
      streamedItems: [agent],
      startedItemIds: ["a1"],
    });
    expect(result.partial).toBe(true);
    expect(result.missingFromStream).toEqual(["c1"]);
    expect(result.reasons.join(" ")).toContain("c1");
    expect(result.reasons.join(" ")).toContain("commandExecution");
  });

  it("is partial when an item started and never completed", () => {
    const result = reconcileTurnRecord({
      completedItems: [agent],
      streamedItems: [agent],
      startedItemIds: ["a1", "c9"],
    });
    expect(result.partial).toBe(true);
    expect(result.unfinishedItemIds).toEqual(["c9"]);
    expect(result.reasons.join(" ")).toContain("c9");
  });

  it("is partial when no stream was observed at all, and says so", () => {
    const result = reconcileTurnRecord({ completedItems: [agent] });
    expect(result.streamObserved).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.items).toEqual([agent]);
    expect(result.reasons.join(" ")).toContain("no stream");
  });

  it("does not claim to have checked starts it was never given", () => {
    const result = reconcileTurnRecord({ completedItems: [agent], streamedItems: [agent] });
    expect(result.startsObserved).toBe(false);
    expect(result.partial).toBe(false);
    expect(result.unfinishedItemIds).toEqual([]);
  });

  it("never makes the normal omission alone partial", () => {
    const result = reconcileTurnRecord({
      completedItems: [],
      streamedItems: [user, reasoning, edit],
      startedItemIds: ["u1", "r1", "f1"],
    });
    expect(result.omittedFromCompletion).toBe(3);
    expect(result.partial).toBe(false);
  });

  it("keys an item with no id by its content, so it never counts twice", () => {
    const anonymous = { type: "reasoning" };
    const result = reconcileTurnRecord({
      completedItems: [anonymous],
      streamedItems: [{ type: "reasoning" }],
      startedItemIds: [],
    });
    expect(result.items).toHaveLength(1);
  });

  it("does not flag a completion item with no id, which cannot be matched to the stream", () => {
    const result = reconcileTurnRecord({
      completedItems: [{ type: "agentMessage", text: "x" }],
      streamedItems: [agent],
      startedItemIds: ["a1"],
    });
    expect(result.missingFromStream).toEqual([]);
    expect(result.partial).toBe(false);
  });
});
