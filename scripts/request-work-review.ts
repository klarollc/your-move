/**
 * request-work-review.ts — owner-run (workflow-proof W5h).
 *
 * Usage:
 *   npm run work:review -- log=<events.jsonl> work=<work_id> [actor=<id>] [project=<id>]
 *
 * Moves an active work item to review_requested once the role has claimed done and every evidence
 * obligation has verified passing evidence. See request-work-review-core.ts for the rules.
 */
import { withLogLock } from "../apps/server/src/log-lock.js";
import { parseReviewArgs, requestWorkReview } from "./request-work-review-core.js";

const parsed = parseReviewArgs(process.argv.slice(2));
if (!parsed.ok) {
  for (const issue of parsed.issues) console.error(`request-work-review: ${issue}`);
  process.exitCode = 2;
} else {
  const locked = await withLogLock(parsed.value.logPath, "review", () =>
    requestWorkReview({ ...parsed.value, now: new Date().toISOString() }),
  );
  if (!locked.locked) {
    console.error(`request-work-review: refused (${locked.code}): ${locked.detail}`);
    process.exit(1);
  }
  const result = locked.value;
  if (!result.ok) {
    console.error(`request-work-review: refused (${result.code})`);
    for (const issue of result.issues) console.error(`  ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(
      `review requested (${result.eventId}); the log is now at revision ${String(result.revision)}`,
    );
  }
}
