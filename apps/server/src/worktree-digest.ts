import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readlink } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

type TrackedPath = Readonly<{ pathBytes: Buffer; mode: string }>;
type DigestEntry = Readonly<{
  path: string;
  type: "file" | "symlink" | "deleted";
  executable: boolean;
  bytes: Buffer;
}>;

/**
 * Hash the current checkout using a versioned, platform-independent encoding.
 * Git supplies the tracked and non-ignored untracked path set; bytes come from the worktree.
 */
export async function measureWorktreeSha256(path: string): Promise<string> {
  const requestedRoot = resolve(path);
  const topLevel = git(requestedRoot, ["rev-parse", "--show-toplevel"], "GIT_WORKTREE_REQUIRED")
    .toString("utf8")
    .trim();
  const root = resolve(topLevel);
  const tracked = parseTracked(
    git(root, ["ls-files", "--stage", "-z"], "WORKTREE_GIT_READ_FAILED"),
  );
  const untracked = parsePaths(
    git(root, ["ls-files", "--others", "--exclude-standard", "-z"], "WORKTREE_GIT_READ_FAILED"),
  );
  const byPath = new Map<string, TrackedPath>();

  for (const entry of tracked) {
    const pathText = decodePath(entry.pathBytes);
    if (entry.mode === "160000") throw new Error(`WORKTREE_SUBMODULE_UNSUPPORTED:${pathText}`);
    if (byPath.has(pathText)) throw new Error(`WORKTREE_INDEX_CONFLICT:${pathText}`);
    byPath.set(pathText, entry);
  }
  for (const pathBytes of untracked) {
    const pathText = decodePath(pathBytes);
    if (!byPath.has(pathText)) byPath.set(pathText, { pathBytes, mode: "100644" });
  }

  const entries: DigestEntry[] = [];
  const trackedPaths = new Set(tracked.map(({ pathBytes }) => decodePath(pathBytes)));
  for (const entry of byPath.values()) {
    const relativePath = decodePath(entry.pathBytes);
    const absolutePath = resolve(root, ...relativePath.split("/"));
    const fromRoot = relative(root, absolutePath);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
      throw new Error(`WORKTREE_PATH_ESCAPES_ROOT:${relativePath}`);
    }
    let info;
    try {
      info = await lstat(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && trackedPaths.has(relativePath)) {
        entries.push({
          path: relativePath,
          type: "deleted",
          executable: entry.mode === "100755",
          bytes: Buffer.alloc(0),
        });
        continue;
      }
      throw new Error(`WORKTREE_PATH_UNREADABLE:${relativePath}`, { cause: error });
    }
    if (info.isSymbolicLink()) {
      const target = await readlink(absolutePath, { encoding: "buffer" });
      entries.push({ path: relativePath, type: "symlink", executable: false, bytes: target });
    } else if (info.isFile()) {
      const bytes = await readFile(absolutePath);
      entries.push({
        path: relativePath,
        type: "file",
        executable: entry.mode === "100755" || (info.mode & 0o111) !== 0,
        bytes,
      });
    } else {
      throw new Error(`WORKTREE_ENTRY_TYPE_UNSUPPORTED:${relativePath}`);
    }
  }

  entries.sort((left, right) =>
    Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8")),
  );
  const hash = createHash("sha256");
  hash.update(Buffer.from("your-move-worktree-sha256-v1\0", "utf8"));
  for (const entry of entries) {
    addLengthPrefixed(hash, Buffer.from(entry.path.replaceAll("\\", "/"), "utf8"));
    addLengthPrefixed(hash, Buffer.from(entry.type, "ascii"));
    hash.update(Buffer.from([entry.executable ? 1 : 0]));
    addLengthPrefixed(hash, entry.bytes);
  }
  return hash.digest("hex");
}

function parseTracked(output: Buffer): TrackedPath[] {
  const result: TrackedPath[] = [];
  for (const row of nulRows(output)) {
    const tab = row.indexOf(0x09);
    if (tab < 0) throw new Error("WORKTREE_GIT_INDEX_MALFORMED");
    const header = row.subarray(0, tab).toString("ascii");
    const match = /^(\d{6}) [a-f0-9]{40,64} ([0-3])$/u.exec(header);
    if (!match) throw new Error("WORKTREE_GIT_INDEX_MALFORMED");
    if (match[2] !== "0") throw new Error(`WORKTREE_INDEX_CONFLICT_STAGE:${match[2]}`);
    const pathBytes = Buffer.from(row.subarray(tab + 1));
    decodePath(pathBytes);
    result.push({ pathBytes, mode: match[1]! });
  }
  return result;
}

function parsePaths(output: Buffer): Buffer[] {
  return nulRows(output).map((entry) => {
    decodePath(entry);
    return Buffer.from(entry);
  });
}

function nulRows(output: Buffer): Buffer[] {
  if (output.length === 0) return [];
  const rows: Buffer[] = [];
  let start = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== 0) continue;
    rows.push(output.subarray(start, index));
    start = index + 1;
  }
  if (start !== output.length) throw new Error("WORKTREE_GIT_PATH_LIST_TRUNCATED");
  return rows;
}

function decodePath(bytes: Buffer): string {
  const path = bytes.toString("utf8");
  if (path.length === 0 || path.includes("\0") || !Buffer.from(path, "utf8").equals(bytes)) {
    throw new Error("WORKTREE_PATH_ENCODING_UNSUPPORTED");
  }
  return path.replaceAll("\\", "/");
}

function git(root: string, args: string[], failureCode: string): Buffer {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "buffer",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      maxBuffer: 16 * 1024 * 1024,
    }) as Buffer;
  } catch {
    throw new Error(failureCode);
  }
}

function addLengthPrefixed(hash: ReturnType<typeof createHash>, bytes: Buffer): void {
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  hash.update(length);
  hash.update(bytes);
}
