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

const manifest = JSON.parse(await readFile(resolve(OUT, "capture-manifest.json"), "utf8")) as {
  cells: Array<{ state: string; viewport: string; captured: boolean }>;
};

type Finding = {
  state: string;
  viewport: string;
  contractAccessibleName: string;
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

    const snapshot = await readFile(resolve(OUT, viewport, `${entry.id}.aria.yaml`), "utf8");
    // The contract writes placeholders like `Evidence link: resolved, [artifact name]`, which the
    // build fills with the real artifact name. Treating the bracket as literal text reported four
    // correct implementations as drift — a guard that refuses material that works, which is the
    // failure mode this register has recorded more than once.
    const pattern = new RegExp(
      entry.accessibleName
        .split(/\[[^\]]*\]/u)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join(".+"),
      "u",
    );
    const present = pattern.test(snapshot);
    // When the exact name is absent, report the line that shares the most leading words with it, so
    // the report says what the build calls this instead of only that the contract's name is missing.
    const words = entry.accessibleName.toLowerCase().split(/\s+/u).filter(Boolean);
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
      contractAccessibleName: entry.accessibleName,
      present,
      nearest,
    });
  }
}

const drift = findings.filter((finding) => !finding.present);
const record = {
  schema: "cuckcode.phase5-fidelity.v1",
  status:
    "Mechanical name comparison only. It is not a fidelity judgement and it is not owner acceptance.",
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
