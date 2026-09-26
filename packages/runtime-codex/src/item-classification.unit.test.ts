import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CODEX_PIN } from "./codex-pin.js";
import { ITEM_CLASSIFICATION, classifyItem, classifyTurnItems } from "./item-classification.js";

type Schema = {
  definitions: { ThreadItem: { oneOf: Array<{ properties: { type: { enum: string[] } } }> } };
};

const pinnedVocabulary = (): string[] => {
  const schema = JSON.parse(
    readFileSync(
      join(
        import.meta.dirname,
        "..",
        "protocol",
        CODEX_PIN,
        "schemas",
        "v2",
        "TurnCompletedNotification.json",
      ),
      "utf8",
    ),
  ) as Schema;
  return schema.definitions.ThreadItem.oneOf.flatMap((entry) => entry.properties.type.enum).sort();
};

describe("turn item classification", () => {
  it("classifies exactly the item vocabulary of the pinned Codex, no more and no less", () => {
    expect(Object.keys(ITEM_CLASSIFICATION).sort()).toEqual(pinnedVocabulary());
  });

  it("counts only the text channel as text (CX-2)", () => {
    const text = Object.entries(ITEM_CLASSIFICATION)
      .filter(([, kind]) => kind === "text")
      .map(([type]) => type)
      .sort();
    expect(text).toEqual(["agentMessage", "contextCompaction", "plan", "reasoning", "userMessage"]);
  });

  it("counts the item types the old lists missed as effects", () => {
    for (const type of ["functionCallOutput", "imageView", "subAgentActivity", "hookPrompt"]) {
      expect(classifyItem(type), type).toBe("effect");
    }
  });

  it("does not know a type it has not been told about", () => {
    expect(classifyItem("teleport")).toBe("unclassified");
  });

  it("sorts a turn's items into effects and unclassified types, ignoring text", () => {
    expect(
      classifyTurnItems([
        { type: "reasoning" },
        { type: "agentMessage", text: "ok" },
        { type: "commandExecution" },
        { type: "teleport" },
        { nottype: true },
      ]),
    ).toEqual({ effects: ["commandExecution"], unclassified: ["teleport", "unknown"] });
  });
});
