import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { measureWorktreeSha256 } from "./worktree-digest.js";

let root = "";

const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

describe("measureWorktreeSha256", () => {
  it("is deterministic and covers tracked bytes plus non-ignored untracked files", async () => {
    root = await mkdtemp(join(tmpdir(), "your-move-digest-"));
    git("init", "--quiet");
    await writeFile(join(root, "tracked.txt"), "tracked\r\nbytes", "utf8");
    await writeFile(join(root, ".gitignore"), "ignored.txt\n", "utf8");
    await writeFile(join(root, "ignored.txt"), "excluded", "utf8");
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "nested", "untracked.txt"), "included", "utf8");
    git("add", "tracked.txt", ".gitignore");

    const first = await measureWorktreeSha256(root);
    const repeat = await measureWorktreeSha256(root);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(repeat).toBe(first);

    await writeFile(join(root, "ignored.txt"), "ignored changed", "utf8");
    expect(await measureWorktreeSha256(root)).toBe(first);
    await writeFile(join(root, "nested", "untracked.txt"), "included changed", "utf8");
    expect(await measureWorktreeSha256(root)).not.toBe(first);
  });

  it("binds tracked deletions and refuses submodule entries", async () => {
    root = await mkdtemp(join(tmpdir(), "your-move-digest-"));
    git("init", "--quiet");
    await writeFile(join(root, "tracked.txt"), "present", "utf8");
    git("add", "tracked.txt");
    const present = await measureWorktreeSha256(root);
    await rm(join(root, "tracked.txt"));
    const deleted = await measureWorktreeSha256(root);
    expect(deleted).not.toBe(present);

    const objectId = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: root,
      encoding: "utf8",
      input: "submodule",
    }).trim();
    git("update-index", "--add", "--cacheinfo", `160000,${objectId},embedded`);
    await expect(measureWorktreeSha256(root)).rejects.toThrow(/SUBMODULE/);
  });

  it("refuses a path outside a Git worktree", async () => {
    root = await mkdtemp(join(tmpdir(), "your-move-digest-outside-"));
    await expect(measureWorktreeSha256(root)).rejects.toThrow(/GIT_WORKTREE_REQUIRED/);
  });
});
