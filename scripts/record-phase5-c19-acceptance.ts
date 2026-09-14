import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Records the owner's C-19 fidelity ruling against the exact plates it was made on.
 *
 * C-19 is the criterion no machinery can close: "Captures and diffs cannot satisfy the acceptance
 * half." This script therefore judges nothing. It takes a ruling the owner gave, verifies that every
 * plate still matches the manifest digest, and writes the record. If a plate had drifted since the
 * look, the ruling would be about bytes that are gone and the script refuses rather than filing it.
 *
 * `--marks <file>` takes the JSON block the contact sheet's Copy button produces, when the owner
 * supplies one. Without it the record says so, rather than implying per-state judgements that were
 * never handed over. States the owner did not mark are `not-looked-at` in the sheet's own output and
 * stay that way here: a state skipped and a state accepted are not the same claim.
 */
const ROOT = resolve(process.cwd());
const BROWSER = resolve(ROOT, "docs/evidence/phase-5/browser");
const VIEWPORTS = ["chromium-1440", "chromium-1280"] as const;

const argument = (name: string): string | null => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
};

const ruling = argument("--ruling");
const ruledOn = argument("--ruled-on") ?? new Date().toISOString().slice(0, 10);
const marksFile = argument("--marks");
if (!ruling) {
  process.stderr.write("--ruling is required; the owner's words, not a default\n");
  process.exit(1);
}

type Cell = { state: string; viewport: string; capture: string; captureSha256: string };

const manifest = JSON.parse(await readFile(resolve(BROWSER, "capture-manifest.json"), "utf8")) as {
  capturedAt: string;
  cells: Cell[];
};
const surface = JSON.parse(
  await readFile(
    resolve(ROOT, "docs/evidence/phase-5/surface-contract/surface-contract.json"),
    "utf8",
  ),
) as { requiredStates: string[] };

const marks = marksFile
  ? ((
      JSON.parse(await readFile(resolve(ROOT, marksFile), "utf8")) as {
        states?: Record<string, { fidelity?: string; note?: string }>;
      }
    ).states ?? {})
  : null;

const states: Record<string, unknown> = {};
for (const state of surface.requiredStates) {
  const plates: Record<string, string> = {};
  for (const viewport of VIEWPORTS) {
    const cell = manifest.cells.find(
      (entry) => entry.state === state && entry.viewport === viewport,
    );
    if (!cell) {
      process.stderr.write(`no capture recorded for ${state} at ${viewport}\n`);
      process.exit(1);
    }
    const actual = createHash("sha256")
      .update(await readFile(resolve(BROWSER, cell.capture)))
      .digest("hex")
      .slice(0, 16);
    if (actual !== cell.captureSha256) {
      process.stderr.write(
        `${cell.capture} has changed since the manifest was written; the ruling would describe ` +
          `bytes that are gone. Re-capture and look again before recording an acceptance.\n`,
      );
      process.exit(1);
    }
    plates[viewport] = actual;
  }
  const mark = marks?.[state];
  states[state] = {
    fidelity: mark?.fidelity ?? "accepted-without-a-per-state-mark",
    note: mark?.note ?? "",
    plates,
  };
}

const record = {
  schema: "cuckcode.phase5-c19-owner-look.v1",
  criterion: "C-19",
  statement:
    "The rendered component matches the art-direction contract for every state in the inventory.",
  evidenceClass: "human-visual-acceptance",
  evidenceClassRule:
    "MDD §18. This is the only class that approves art direction. The fidelity check, the determinism record and the forty captures are rendered and static evidence; none of them substitutes for this record, and this record does not substitute for any of them.",
  lookedAt: {
    surface: "the contact sheet, npm run phase5:contact-sheet",
    artifacts: "docs/evidence/phase-5/browser, twenty states at both D-07 viewports",
    capturedAt: manifest.capturedAt,
    plates: surface.requiredStates.length * VIEWPORTS.length,
  },
  ruling,
  ruledBy: "owner",
  ruledOn,
  decisionRecord: "docs/evidence/phase-5/decision-record-2026-09-14-c-19-fidelity-acceptance.md",
  perStateMarks: marks
    ? "supplied by the owner from the contact sheet's verdict block"
    : "not supplied. The contact sheet keeps marks in the viewer's own browser and they never reach the repository, so no per-state judgement is claimed here. The ruling is a whole-inventory acceptance with no exceptions recorded.",
  whatThisDoesNotEstablish: [
    "Nothing about behaviour. Every behavioural claim about these states rests on the component and core tests, which this record neither strengthens nor replaces.",
    "Nothing about what the component sounds like. C-17 was waived on the same day; no human listener has heard it.",
    "Nothing about future builds. The ruling is pinned to the plate digests below and says nothing about a capture taken after them.",
  ],
  visualQaContext:
    "Visual QA pass 2 marked all twenty states `partial`, stating for each one that the visual treatment could not be judged from an accessibility tree. That deferral is what this record answers.",
  states,
};

const out = resolve(ROOT, "docs/evidence/phase-5/c-19-owner-acceptance.json");
await writeFile(out, `${JSON.stringify(record, null, 2)}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    out: "docs/evidence/phase-5/c-19-owner-acceptance.json",
    states: surface.requiredStates.length,
    platesVerified: surface.requiredStates.length * VIEWPORTS.length,
    perStateMarks: marks !== null,
  })}\n`,
);
