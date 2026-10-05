/**
 * serve-office-log.ts — owner-run.
 *
 * Usage:
 *   npm run serve:log -- log=<events.jsonl> [project=<id>] [port=4180] [origin=http://127.0.0.1:4173]
 *     [runner-worktree=<absolute-path> runner-model=<id> runner-reasoning-effort=<level>]
 *     [runner-needs=relative/path.ts,...]
 *
 * Starts the loopback server on 127.0.0.1 against the event log and holds the log's single-writer
 * lock until it stops. Surface B may start a configured runner only when the server process also
 * has CUCKCODE_LIVE_WORKFLOW=1. The server releases and reacquires its lock around that child; no
 * live attempt starts merely because the server was launched.
 */
import { parseLaunchArgs, startLogServer } from "../apps/server/src/launch.js";

const parsed = parseLaunchArgs(process.argv.slice(2));
if (!parsed.ok) {
  for (const issue of parsed.issues) console.error(`serve-office-log: ${issue}`);
  process.exitCode = 2;
} else {
  const started = await startLogServer(parsed.value);
  if (!started.ok) {
    console.error(`serve-office-log: refused (${started.code}): ${started.detail}`);
    process.exitCode = 1;
  } else {
    const { server } = started;
    if (server.reclaimedNote) console.warn(`serve-office-log: ${server.reclaimedNote}`);
    console.log(`serving ${parsed.value.logPath} at ${server.url}`);
    console.log(
      `allowed origin ${parsed.value.allowedOrigin}; lock ${server.lockPath}; Ctrl+C to stop`,
    );
    console.log(
      `Surface B runner ${parsed.value.runner && process.env.CUCKCODE_LIVE_WORKFLOW === "1" ? "available by explicit opt-in" : "unavailable"}; server start does not launch a run`,
    );
    const stop = () => {
      void server.close().finally(() => process.exit(0));
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  }
}
