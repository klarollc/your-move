/**
 * record-work-evidence.ts — owner-run (workflow-proof W5f).
 *
 * Usage:
 *   npm run work:evidence -- log=<events.jsonl> work=<work_id> kind=<obligation kind> \
 *     result=passed|failed [output=<saved output file>] [note="..."] [actor=<id>] [project=<id>]
 *
 * Records one owner-run check result as verified evidence on a work item. It does not run the
 * check. See record-work-evidence-core.ts for the rules and the single-writer caveat.
 */
import { withLogLock } from "../apps/server/src/log-lock.js";
import { parseEvidenceArgs, recordWorkEvidence } from "./record-work-evidence-core.js";

const parsed = parseEvidenceArgs(process.argv.slice(2));
if (!parsed.ok) {
  for (const issue of parsed.issues) console.error(`record-work-evidence: ${issue}`);
  process.exitCode = 2;
} else {
  const locked = await withLogLock(parsed.value.logPath, "evidence", () =>
    recordWorkEvidence({ ...parsed.value, now: new Date().toISOString() }),
  );
  if (!locked.locked) {
    console.error(`record-work-evidence: refused (${locked.code}): ${locked.detail}`);
    process.exit(1);
  }
  const result = locked.value;
  if (!result.ok) {
    console.error(`record-work-evidence: refused (${result.code})`);
    for (const issue of result.issues) console.error(`  ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(
      `recorded ${result.eventId}; the log is now at revision ${String(result.revision)}`,
    );
    if (result.outputSha256) console.log(`output digest ${result.outputSha256}`);
    console.log(
      result.doneSupported
        ? "every evidence obligation now has verified passing evidence"
        : `still unsatisfied: ${result.unsatisfied.join(", ")}`,
    );
  }
}
