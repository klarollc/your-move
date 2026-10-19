import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Docker build context excludes TypeScript incremental build state", () => {
  const ignoredPaths = readFileSync(path.join(root, ".dockerignore"), "utf8")
    .split(/\r?\n/)
    .map((entry) => entry.trim());

  assert.ok(
    ignoredPaths.includes("**/*.tsbuildinfo"),
    "stale TypeScript build metadata can make a clean Docker build omit dist output",
  );
});

test("runtime image pruning happens after workspace builds and before runtime copy", () => {
  const dockerfile = readFileSync(path.join(root, "Dockerfile"), "utf8");
  const webBuild = dockerfile.indexOf("RUN npm run build --workspace @cuckcode/web");
  const serverBuild = dockerfile.indexOf("RUN npm run build --workspace @cuckcode/server");
  const prune = dockerfile.indexOf("RUN npm prune --omit=dev");
  const runtimeStage = dockerfile.indexOf("AS runtime");

  assert.ok(webBuild >= 0 && serverBuild > webBuild, "both workspaces must build before pruning");
  assert.ok(
    prune > serverBuild && prune < runtimeStage,
    "prune dev dependencies before copying runtime files",
  );
});
