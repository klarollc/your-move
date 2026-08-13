import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSharedKnowledgeAcceptance } from "../packages/testing/src/shared-knowledge-scenario.js";

const roots = {
  projectAlphaRoot: mkdtempSync(join(tmpdir(), "cuckcode-proof-alpha-")),
  projectBetaRoot: mkdtempSync(join(tmpdir(), "cuckcode-proof-beta-")),
  recoveryRoot: mkdtempSync(join(tmpdir(), "cuckcode-proof-recovery-")),
};
try {
  process.stdout.write(`${JSON.stringify(runSharedKnowledgeAcceptance(roots), null, 2)}\n`);
} finally {
  Object.values(roots).forEach((root) => rmSync(root, { recursive: true, force: true }));
}
