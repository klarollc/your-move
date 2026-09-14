import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Phase 5 Task 7 — join the captured accessibility trees against the surface contract.
 *
 * The contract states, for every one of the twenty states, the accessible name a person should
 * encounter. The captures record the name they actually encounter. Nothing in this repository
 * compared the two until now, and a screenshot matrix cannot: a picture of the wrong label looks
 * exactly like a picture of the right one.
 *
 * This finds naming drift. It does not find bad design, bad hierarchy, or ugliness, and it is not
 * the Visual QA Reviewer's judgement or the owner's acceptance.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5/browser");
const VIEWPORTS = ["chromium-1440", "chromium-1280"] as const;

const contract = JSON.parse(
  await readFile(
    resolve(ROOT, "docs/evidence/phase-5/surface-contract/surface-contract.json"),
    "utf8",
  ),
) as {
  contract: {
    stateInventory: Array<{ id: string; accessibleName: string; nonColourCue: string }>;
  };
};

/**
 * Owner-ruled amendments, applied over the authored contract rather than into it.
 *
 * Decision 7-B amended two accessible names. Editing the Product Designer's artifact to agree would
 * have left no record that it ever said anything else, which is the defect that destroyed the RED
 * capture. So the authored file stays as authored, this overlay carries the ruling and its reason,
 * and what fidelity is checked against is visibly the contract *as amended, by whom, and why*.
 */
const amendments = JSON.parse(
  await readFile(resolve(ROOT, "docs/evidence/phase-5/surface-contract/amendments.json"), "utf8"),
) as {
  amendments: Array<{ stateId: string; field: string; authored: string; amendedTo: string }>;
};

const amendedName = (stateId: string, authored: string): { name: string; amended: boolean } => {
  const amendment = amendments.amendments.find(
    (entry) => entry.stateId === stateId && entry.field === "accessibleName",
  );
  if (!amendment) return { name: authored, amended: false };
  if (amendment.authored !== authored) {
    // The overlay claims to amend a value the contract no longer holds. Applying it anyway would
    // silently check against a name nobody wrote.
    throw new Error(`AMENDMENT_BASE_MISMATCH:${stateId}:${authored}`);
  }
  return { name: amendment.amendedTo, amended: true };
};

const manifest = JSON.parse(await readFile(resolve(OUT, "capture-manifest.json"), "utf8")) as {
  cells: Array<{ state: string; viewport: string; captured: boolean }>;
};

type Finding = {
  state: string;
  viewport: string;
  contractAccessibleName: string;
  amendedByOwner: boolean;
  present: boolean;
  nearest: string | null;
};

const findings: Finding[] = [];

for (const viewport of VIEWPORTS) {
  for (const entry of contract.contract.stateInventory) {
    const cell = manifest.cells.find(
      (item) => item.state === entry.id && item.viewport === viewport,
    );
    if (!cell?.captured) continue;

    const expected = amendedName(entry.id, entry.accessibleName);
    const snapshot = await readFile(resolve(OUT, viewport, `${entry.id}.aria.yaml`), "utf8");
    // The contract writes placeholders like `Evidence link: resolved, [artifact name]`, which the
    // build fills with the real artifact name. Treating the bracket as literal text reported four
    // correct implementations as drift — a guard that refuses material that works, which is the
    // failure mode this register has recorded more than once.
    const pattern = new RegExp(
      expected.name
        .split(/\[[^\]]*\]/u)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join(".+"),
      "u",
    );
    const present = pattern.test(snapshot);
    // When the exact name is absent, report the line that shares the most leading words with it, so
    // the report says what the build calls this instead of only that the contract's name is missing.
    const words = expected.name.toLowerCase().split(/\s+/u).filter(Boolean);
    const nearest = present
      ? null
      : (snapshot
          .split("\n")
          .map((line) => ({
            line: line.trim(),
            score: words.filter((word) => line.toLowerCase().includes(word)).length,
          }))
          .filter((candidate) => candidate.score > 0)
          .sort((a, b) => b.score - a.score)[0]?.line ?? null);

    findings.push({
      state: entry.id,
      viewport,
      contractAccessibleName: expected.name,
      amendedByOwner: expected.amended,
      present,
      nearest,
    });
  }
}

const drift = findings.filter((finding) => !finding.present);
const record = {
  schema: "cuckcode.phase5-fidelity.v1",
  status:
    "Mechanical name comparison only, against the authored contract as amended by decision 7-B. It is not a fidelity judgement and it is not owner acceptance.",
  amendmentsApplied: amendments.amendments.length,
  checkedAt: new Date().toISOString(),
  statesChecked: [...new Set(findings.map((finding) => finding.state))].length,
  namesMatching: findings.length - drift.length,
  namesDrifted: drift.length,
  drift,
};

await writeFile(
  resolve(OUT, "fidelity-check.json"),
  `${JSON.stringify(record, null, 2)}\n`,
  "utf8",
);

process.stdout.write(
  `${JSON.stringify({
    ok: drift.length === 0,
    checked: findings.length,
    drifted: [...new Set(drift.map((finding) => finding.state))],
  })}\n`,
);
