import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runSqliteProof } from "../packages/persistence/src/sqlite-proof.js";

const projectRoot = await mkdtemp(join(tmpdir(), "cuckcode-phase0-report-"));

try {
  const report = await runSqliteProof({ projectRoot });
  console.log(JSON.stringify({ ...report, databasePath: "<temporary-project-root>" }, null, 2));
} finally {
  await rm(projectRoot, { force: true, recursive: true });
}
