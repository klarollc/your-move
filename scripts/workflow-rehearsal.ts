/**
 * Writes the W10 rehearsal transcript for the owner's review. Regenerated on demand; the output
 * directory is git-ignored. Fake runtime only: no Codex process, no network.
 *
 *   npm run workflow:rehearsal
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { renderRehearsal, runRehearsal } from "./workflow-rehearsal-core.js";

const OUT = resolve(process.cwd(), "docs/evidence/workflow/rehearsal");
const work = await mkdtemp(join(tmpdir(), "cuckcode-rehearsal-"));
try {
  const results = await runRehearsal(work);
  await mkdir(OUT, { recursive: true });
  const target = join(OUT, "rehearsal.md");
  await writeFile(target, renderRehearsal(results), "utf8");
  const failed = results.flatMap((r) => r.checks.filter((c) => !c.ok));
  process.stdout.write(
    `${String(results.length)} scenarios, ${String(failed.length)} failed checks. Transcript: docs/evidence/workflow/rehearsal/rehearsal.md\n`,
  );
  if (failed.length > 0) process.exitCode = 1;
} finally {
  await rm(work, { recursive: true, force: true });
}
