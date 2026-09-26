import { readFile, writeFile } from "node:fs/promises";

import { rewriteSessionLog } from "@cuckcode/runtime-codex";

/**
 * Follow-up Task 3 (F3.4): one pass of the held smoke log through the same redaction new logs get.
 *
 *   tsx scripts/redact-held-session-log.ts <held.jsonl> <evidence.jsonl> --home <home directory>
 *
 * The home directory is an argument, not this machine's, because the log was captured on another.
 * The output is never overwritten, and the held original is left where it is.
 */
const [input, output, flag, home] = process.argv.slice(2);
if (!input || !output || flag !== "--home" || !home) {
  throw new Error("USAGE: redact-held-session-log.ts <held.jsonl> <evidence.jsonl> --home <dir>");
}
const rewritten = rewriteSessionLog(await readFile(input, "utf8"), home);
await writeFile(output, rewritten, { encoding: "utf8", flag: "wx" });
process.stdout.write(
  `${JSON.stringify({ written: output, lines: rewritten.trim().split("\n").length })}\n`,
);
