import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Phase 5, decision 9-B — two complete capture runs, compared byte for byte.
 *
 * C-08 was established by a test that feeds the same inputs twice inside one process, plus a static
 * scan showing the component source cannot name `Date`, `Math.random` or a timer. Both are real
 * evidence and neither is what the criterion asks: a repeat inside one process shares that process's
 * locale, timezone and module state, so it cannot see the class of non-determinism that matters —
 * a value that varies between runs rather than between calls.
 *
 * So the whole capture runs twice, through a real browser, and every artifact is digested from both.
 *
 * Two files are excluded by name and the record says so: they stamp the wall clock into their own
 * contents, which is a property of the recording rather than of the thing recorded. Excluding them
 * silently would be the more convenient lie.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5/browser");

/** Artifacts that carry the time they were written, and so can never match across runs. */
const WALL_CLOCK_STAMPED = ["isolation.json", "isolation-deliberate-failure.json"];

const PLAYWRIGHT_CLI = resolve(ROOT, "node_modules/@playwright/test/cli.js");
const VIEWPORTS = ["chromium-1440", "chromium-1280"] as const;

const capture = async (): Promise<{ ok: boolean; output: string }> => {
  try {
    const { stdout, stderr } = await run(
      process.execPath,
      [
        PLAYWRIGHT_CLI,
        "test",
        "--grep",
        "@(visual|a11y|e2e) Phase 5",
        ...VIEWPORTS.flatMap((name) => ["--project", name]),
      ],
      {
        cwd: ROOT,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, CUCKCODE_REGENERATE_EVIDENCE: "1" },
      },
    );
    return { ok: true, output: `${stdout}${stderr}` };
  } catch (cause) {
    const error = cause as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      output: `${error.message ?? ""}\n${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
};

/** Every capture artifact, by relative path, digested. */
const snapshot = async (): Promise<Record<string, string>> => {
  const entries: Record<string, string> = {};
  for (const viewport of VIEWPORTS) {
    for (const name of (await readdir(resolve(OUT, viewport)).catch(() => [] as string[])).sort()) {
      if (WALL_CLOCK_STAMPED.includes(name)) continue;
      const body = await readFile(resolve(OUT, viewport, name));
      entries[`${viewport}/${name}`] = createHash("sha256").update(body).digest("hex").slice(0, 16);
    }
  }
  return entries;
};

const first = await capture();
if (!first.ok) {
  process.stderr.write(`first capture run failed:\n${first.output.slice(-4000)}\n`);
  process.exit(1);
}
const runA = await snapshot();

const second = await capture();
if (!second.ok) {
  process.stderr.write(`second capture run failed:\n${second.output.slice(-4000)}\n`);
  process.exit(1);
}
const runB = await snapshot();

const paths = [...new Set([...Object.keys(runA), ...Object.keys(runB)])].sort();
const differing = paths.filter((path) => runA[path] !== runB[path]);
const onlyInOne = paths.filter((path) => !runA[path] || !runB[path]);

const record = {
  schema: "cuckcode.phase5-determinism.v1",
  status:
    "Two complete capture runs through a real browser, digested and compared. This is what C-08 asks for; the in-process same-input test and the static unreachability scan remain and are not replaced by it.",
  ranAt: new Date().toISOString(),
  decisionRecord: "docs/evidence/phase-5/decision-record-2026-09-14-task-9-remediation.md",
  injected: ["clock", "id source", "evidence fixture", "animation policy", "storage adapter"],
  excludedFromComparison: WALL_CLOCK_STAMPED.map((name) => ({
    file: name,
    why: "stamps the wall clock into its own contents, which is a property of the recording rather than of the thing recorded",
  })),
  artifactsCompared: paths.length,
  identical: differing.length === 0 && onlyInOne.length === 0,
  differing,
  presentInOnlyOneRun: onlyInOne,
  runA,
  runB,
};

await writeFile(resolve(OUT, "determinism.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify({
    ok: record.identical,
    artifactsCompared: paths.length,
    differing: differing.length,
    presentInOnlyOneRun: onlyInOne.length,
  })}\n`,
);
if (!record.identical) process.exitCode = 1;
