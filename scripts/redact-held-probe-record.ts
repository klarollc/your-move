import { readFile, writeFile } from "node:fs/promises";

import { redactProbeRecord } from "./codex-probe-surface.js";

/**
 * Follow-up Task 6, owner ruling 2026-09-27: one pass of a held probe record through
 * `redactProbeRecord`.
 *
 *   tsx scripts/redact-held-probe-record.ts <held.json> <evidence.json>
 *
 * The output is never overwritten, and the held original is left where it is.
 */
const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error("USAGE: redact-held-probe-record.ts <held.json> <evidence.json>");
}
const redacted = redactProbeRecord(
  JSON.parse(await readFile(input, "utf8")) as Record<string, unknown>,
);
await writeFile(output, `${JSON.stringify(redacted, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
process.stdout.write(`${JSON.stringify({ written: output })}\n`);
