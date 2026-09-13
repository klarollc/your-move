import { readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createControlledCodexHome } from "./controlled-home.js";

describe("controlled Codex home", () => {
  it("creates a fresh home containing exactly the composed role instruction", async () => {
    const instruction = "# Role\n\nUse only the reviewed role contract.";
    const home = await createControlledCodexHome({ parentDirectory: tmpdir(), instruction });

    expect(await readdir(home.path)).toEqual(["AGENTS.md"]);
    expect(await readFile(home.instructionPath, "utf8")).toBe(`${instruction}\n`);
    await home.dispose();
  });
});
