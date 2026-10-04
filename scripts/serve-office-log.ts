/**
 * serve-office-log.ts — owner-run.
 *
 * Usage:
 *   npm run serve:log -- log=<events.jsonl> [project=<id>] [port=4180] [origin=http://127.0.0.1:4173]
 *
 * Starts the loopback server on 127.0.0.1 against the event log and holds the log's single-writer
 * lock until it stops. Stop it (Ctrl+C) before running the runner, the evidence recorder or the
 * review CLI; they refuse while it holds the lock.
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
    const stop = () => {
      void server.close().finally(() => process.exit(0));
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  }
}
