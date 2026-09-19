import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  appendOnlyViolation,
  artifactsMissingFromLedger,
  derivePassSupersessions,
  ledgerEntriesWithoutAFile,
  normaliseArtifactPath,
  parseLedger,
  retractedEdges,
  serialiseLedger,
  currentRecords,
  staleRecords,
  supersededArtifacts,
  supersededCitations,
  LEDGER_PATH,
  type LedgerEntry,
  type ProducerKind,
  type RecordEntry,
} from "./phase5-provenance.ts";

/**
 * Builds and checks the evidence provenance ledger. Closes charter gap 3; unblocks C-18.
 *
 * Run with no arguments it checks; run with --write it appends what is missing. Checking by default
 * is the point: the guard has to be able to fail in CI without a build step quietly making it pass.
 */
const ROOT = resolve(process.cwd());
const EVIDENCE = resolve(ROOT, "docs/evidence");
const WRITE = process.argv.includes("--write");
const run = promisify(execFile);

/**
 * Who produced what, declared rather than inferred.
 *
 * The first matching rule wins and anything unmatched is recorded as `unknown` — never guessed. An
 * invented origin is worse than an absent one, because it reads as established. The count of
 * unattributed artifacts is printed on every run so it stays visible instead of settling into the
 * background.
 */
const PRODUCERS: Array<{
  prefix: string;
  kind: ProducerKind;
  producedBy: string;
  authorizedBy: string | null;
}> = [
  {
    prefix: "phase-5/browser/",
    kind: "suite",
    producedBy:
      "tests/visual, tests/accessibility and tests/e2e, via scripts/capture-phase5-browser.ts",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/surface-contract/surface-contract.json",
    kind: "agent",
    producedBy: "product-designer, Task 3",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/surface-contract/",
    kind: "owner",
    producedBy: "owner ruling, recorded beside the authored contract",
    authorizedBy: "phase-5/decision-record-2026-09-14-task-9-remediation.md",
  },
  {
    prefix: "phase-5/verification/",
    kind: "agent",
    producedBy: "test-engineer, Task 6",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/visual-qa/",
    kind: "agent",
    producedBy: "visual-qa, Task 7",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/release-review/",
    kind: "agent",
    producedBy: "release-reviewer, Task 9",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/shared-knowledge/",
    kind: "script",
    producedBy: "scripts/build-phase5-knowledge-scenario.ts",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/acceptance-contract.json",
    kind: "script",
    producedBy: "scripts/build-phase5-acceptance-contract.ts",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/red-evidence.json",
    kind: "script",
    producedBy: "scripts/build-phase5-red-evidence.ts",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/provenance/",
    kind: "owner",
    producedBy: "owner ruling 2026-09-14, closing charter gap 3",
    authorizedBy: "phase-5/decision-record-2026-09-14-c-18-provenance.md",
  },
  {
    prefix: "phase-5/c-19-owner-acceptance.json",
    kind: "owner",
    producedBy: "owner fidelity ruling, recorded by scripts/record-phase5-c19-acceptance.ts",
    authorizedBy: "phase-5/decision-record-2026-09-14-c-19-fidelity-acceptance.md",
  },
  {
    prefix: "phase-5/acceptance-contract-waivers.json",
    kind: "owner",
    producedBy: "owner waiver, recorded beside the frozen contract",
    authorizedBy: "phase-5/decision-record-2026-09-14-c-17-waiver.md",
  },
  {
    prefix: "phase-5/task-",
    kind: "implementer",
    producedBy: "the conventional implementation session, per Decision 5-A",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/green-evidence.md",
    kind: "implementer",
    producedBy: "the conventional implementation session, per Decision 5-A",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  {
    prefix: "phase-5/turn-ledger.json",
    kind: "implementer",
    producedBy: "the conventional implementation session, per Decision 5-A",
    authorizedBy: "phase-5/approved-charter-v1.md",
  },
  // The only two pre-Phase-5 producers establishable from code in the tree. Everything else from
  // phases 0 to 4 stays unknown: no script writes it and no record says who did.
  {
    prefix: "phase-4/layout-trials/",
    kind: "suite",
    producedBy: "tests/visual/phase-4-layout-trial.spec.ts",
    authorizedBy: null,
  },
  {
    prefix: "phase-4/live-kickoff/role-exercises/",
    kind: "script",
    producedBy: "scripts/run-role-exercises.ts",
    authorizedBy: null,
  },
  {
    prefix: "phase-5/decision-record-",
    kind: "owner",
    producedBy: "owner",
    authorizedBy: null,
  },
  {
    prefix: "phase-5/approved-charter-v1.md",
    kind: "owner",
    producedBy: "owner, approving the Task 17 manager charter",
    authorizedBy: null,
  },
  // Cross-phase owner rulings and the corrections recorded under them. Both were written by hand
  // in the session that carried the ruling, so neither has a producing script to name.
  {
    prefix: "decision-record-",
    kind: "owner",
    producedBy: "owner",
    authorizedBy: null,
  },
  {
    prefix: "phase-4/live-kickoff/task-17-run/correction-",
    kind: "owner",
    producedBy: "owner ruling S-B, recorded beside the artifacts it corrects",
    authorizedBy: "decision-record-2026-09-14-scripts-typecheck.md",
  },
  {
    prefix: "phase-6/",
    kind: "script",
    producedBy: "scripts/build-phase6-*.ts and scripts/freeze-phase6-fixture.ts",
    authorizedBy: "phase-6/decision-record-2026-09-13-golden-states-approved.md",
  },
];

/** Passes written before the pass-N convention existed. Declared, with the reason, in the schema. */
const PASS_ALIASES = new Map([["phase-5/verification/verification.json", 1]]);

const listFiles = async (directory: string, prefix = ""): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory())
      files.push(...(await listFiles(resolve(directory, entry.name), relative)));
    else files.push(relative);
  }
  return files;
};

const attribute = (
  artifact: string,
): Pick<RecordEntry, "producerKind" | "producedBy" | "authorizedBy"> => {
  const match = PRODUCERS.find((rule) => artifact.startsWith(rule.prefix));
  if (!match) return { producerKind: "unknown", producedBy: null, authorizedBy: null };
  return {
    producerKind: match.kind,
    producedBy: match.producedBy,
    authorizedBy: match.authorizedBy,
  };
};

const files = (await listFiles(EVIDENCE)).filter((path) => path !== LEDGER_PATH);

const digests = new Map<string, string>();
const sizes = new Map<string, number>();
for (const artifact of files) {
  const body = await readFile(resolve(EVIDENCE, artifact));
  digests.set(artifact, createHash("sha256").update(body).digest("hex"));
  sizes.set(artifact, body.byteLength);
}

const ledgerFile = resolve(EVIDENCE, LEDGER_PATH);
const existingText = await readFile(ledgerFile, "utf8").catch(() => "");
const { entries: existing, refusals } = parseLedger(existingText);
if (refusals.length > 0) {
  process.stderr.write(`the ledger has unreadable lines:\n  ${refusals.join("\n  ")}\n`);
  process.exit(1);
}

const recordedAt = new Date().toISOString();
const additions: LedgerEntry[] = [];

for (const artifact of artifactsMissingFromLedger(files, existing)) {
  additions.push({
    op: "record",
    artifact,
    sha256: digests.get(artifact) as string,
    bytes: sizes.get(artifact) as number,
    recordedAt,
    ...attribute(artifact),
  });
}

/**
 * An artifact that was regenerated gets a fresh record appended rather than its old line edited.
 *
 * P-2 is not "artifacts never change" — regenerating the acceptance contract is ordinary work. It is
 * "the ledger never silently describes bytes that are gone". Appending satisfies that and leaves
 * both digests in the history, which is the audit trail the whole ledger exists for. The count is
 * reported separately from first-time records so an absorbed change stays visible.
 */
const reRecorded: string[] = [];
for (const { artifact } of staleRecords(digests, existing)) {
  reRecorded.push(artifact);
  additions.push({
    op: "record",
    artifact,
    sha256: digests.get(artifact) as string,
    bytes: sizes.get(artifact) as number,
    recordedAt,
    ...attribute(artifact),
  });
}

/**
 * An attribution corrected after the fact is also an append, never an edit.
 *
 * Without this there is no way to fix a wrong origin at all: the rule map changes, and the ledger
 * keeps serving the attribution it happened to be built with. Appending a corrected record leaves
 * the earlier claim in the history, which is what makes a correction auditable rather than quiet.
 */
const reAttributed: string[] = [];
const recordsNow = currentRecords(existing);
for (const artifact of files) {
  const record = recordsNow.get(artifact);
  if (!record || reRecorded.includes(artifact)) continue;
  const now = attribute(artifact);
  const changed =
    record.producerKind !== now.producerKind ||
    record.producedBy !== now.producedBy ||
    record.authorizedBy !== now.authorizedBy;
  if (!changed) continue;
  reAttributed.push(artifact);
  additions.push({
    op: "record",
    artifact,
    sha256: digests.get(artifact) as string,
    bytes: sizes.get(artifact) as number,
    recordedAt,
    ...now,
  });
}

/**
 * What a review's product is called, declared per schema. Mirrors `supersessionDerivation
 * .withinAClass.productFieldBySchema` in the schema document, ruled 2026-09-19.
 *
 * The three review kinds name their product differently, so there is no single key to read. The
 * tempting shortcut — every failed pass begins its status with "NOT ACCEPTED." — is the greps-prose
 * defect: it passes on whatever phrasing it is handed and fails silently on the next wording.
 */
const PRODUCT_FIELD_BY_SCHEMA = new Map([
  ["cuckcode.phase5-release-review.v1", "verdict"],
  ["cuckcode.phase5-verification.v1", "assessment"],
  ["cuckcode.phase5-visual-qa.v1", "annotation"],
]);

const PASS_NAME = /^pass-(\d+)\.json$/u;

const passNumbers = new Map<string, number>();
const passClasses = new Map<string, string>();
const unclassifiedPasses: string[] = [];

for (const artifact of files) {
  const path = normaliseArtifactPath(artifact);
  const name = path.slice(path.lastIndexOf("/") + 1);
  const numbered = PASS_NAME.exec(name);
  const pass = numbered ? Number(numbered[1]) : PASS_ALIASES.get(path);
  if (pass === undefined) continue;
  passNumbers.set(path, pass);

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolve(EVIDENCE, path), "utf8"));
  } catch {
    unclassifiedPasses.push(`${path}: not readable as JSON`);
    continue;
  }
  const schema = (parsed as { schema?: unknown }).schema;
  if (typeof schema !== "string" || !PRODUCT_FIELD_BY_SCHEMA.has(schema)) {
    // Refused, never defaulted. Defaulting to carries-a-product would let a new failed review kind
    // retire a verdict; defaulting the other way would stop a new review kind superseding anything
    // at all. Both are silent, so neither is allowed.
    unclassifiedPasses.push(
      `${path}: schema ${JSON.stringify(schema)} has no declared product field`,
    );
    continue;
  }
  const field = PRODUCT_FIELD_BY_SCHEMA.get(schema) as string;
  if (!(field in (parsed as Record<string, unknown>))) {
    unclassifiedPasses.push(`${path}: schema ${schema} declares ${field}, which the file omits`);
    continue;
  }
  passClasses.set(
    path,
    (parsed as Record<string, unknown>)[field] === null ? "productless" : "product",
  );
}

const alreadySuperseded = supersededArtifacts(existing);
const retracted = retractedEdges(existing);
const retractionConflicts: string[] = [];

/**
 * Derivation is skipped entirely when any pass could not be classified. A partial derivation would
 * emit some edges and not others, and a half-applied ordering is harder to see than none at all.
 */
const derived =
  unclassifiedPasses.length === 0
    ? derivePassSupersessions(files, PASS_ALIASES, (path) => passClasses.get(path) as string)
    : [];

for (const edge of derived) {
  if (retracted.has(`${edge.artifact}\u0000${edge.supersededBy}`)) {
    // The rule and the ruling disagree. Skipping quietly would let the next build undo a
    // retraction, which is the abuse P-6 exists to forbid, so it is reported and the gate fails.
    retractionConflicts.push(
      `${edge.artifact} -> ${edge.supersededBy} is retracted, and the derivation still produces it`,
    );
    continue;
  }
  if (alreadySuperseded.get(edge.artifact) === edge.supersededBy) continue;
  additions.push({
    op: "supersede",
    artifact: edge.artifact,
    supersededBy: edge.supersededBy,
    recordedAt,
    why: "a later pass of the same review; the highest-numbered pass of its class is the current one",
  });
}

const next = [...existing, ...additions];
const nextText = serialiseLedger(next);

if (WRITE && additions.length > 0) {
  const violation = appendOnlyViolation(existingText, nextText);
  if (violation) {
    process.stderr.write(`refusing to write: ${violation}\n`);
    process.exit(1);
  }
  await writeFile(ledgerFile, nextText, "utf8");
}

const active = WRITE ? next : existing;

/**
 * The declaration/derivation cross-check. An artifact that says which passes preceded it and a
 * ledger that disagrees cannot both be right, and the disagreement is the interesting signal — it
 * means either the convention was broken or the alias list is stale.
 */
const declarationConflicts: string[] = [];
const superseded = supersededArtifacts(active);
for (const artifact of files.filter((path) => path.endsWith(".json"))) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolve(EVIDENCE, artifact), "utf8"));
  } catch {
    continue;
  }
  const declared = (parsed as { previousPasses?: unknown }).previousPasses;
  if (!Array.isArray(declared)) continue;
  const citing = normaliseArtifactPath(artifact);
  const directory = citing.slice(0, citing.lastIndexOf("/"));
  for (const previous of declared) {
    if (typeof previous !== "string") continue;
    const path = normaliseArtifactPath(
      previous.includes("/") ? previous : `${directory}/${previous}`,
    );
    // `previousPasses` declares ordering, which is the first half. Requiring supersession outright
    // was the earlier rule and it is wrong across classes: passes 6, 7 and 8 each declare pass-5 a
    // previous pass and must not supersede it.
    const citingNumber = passNumbers.get(citing);
    const declaredNumber = passNumbers.get(path);
    if (declaredNumber === undefined || citingNumber === undefined) {
      declarationConflicts.push(`${citing} declares ${path} a previous pass; it is not a pass`);
      continue;
    }
    if (declaredNumber >= citingNumber) {
      declarationConflicts.push(
        `${citing} declares ${path} a previous pass; it is not earlier in the sequence`,
      );
      continue;
    }
    // The second half, and the one that still cross-checks the ledger: an earlier pass of the
    // *same* class is one this pass replaced, so the ledger has to say so.
    if (passClasses.get(citing) === passClasses.get(path) && superseded.get(path) === undefined) {
      declarationConflicts.push(
        `${citing} declares ${path} a previous pass of the same class; the ledger does not record it superseded`,
      );
    }
  }
}

const citations: Array<{ citedBy: string; cited: string; supersededBy: string }> = [];
for (const artifact of files.filter((path) => path.endsWith(".json"))) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolve(EVIDENCE, artifact), "utf8"));
  } catch {
    continue;
  }
  citations.push(...supersededCitations(artifact, parsed, active));
}

const missing = artifactsMissingFromLedger(files, active);
const orphaned = ledgerEntriesWithoutAFile(files, active);
const stale = staleRecords(digests, active);
// Counted over the *current* record for each artifact, not over every line ever written. Counting
// all lines would keep reporting an attribution that a later correction already replaced.
const unattributed = [...currentRecords(active).values()]
  .filter((entry) => entry.producerKind === "unknown")
  .map((entry) => entry.artifact)
  .sort();

const ok =
  missing.length === 0 &&
  orphaned.length === 0 &&
  stale.length === 0 &&
  citations.length === 0 &&
  retractionConflicts.length === 0 &&
  unclassifiedPasses.length === 0 &&
  declarationConflicts.length === 0;

process.stdout.write(
  `${JSON.stringify(
    {
      ok,
      mode: WRITE ? "write" : "check",
      artifacts: files.length,
      ledgerLines: active.length,
      appended: WRITE ? additions.length : 0,
      wouldAppend: WRITE ? 0 : additions.length,
      reRecorded: WRITE ? reRecorded : [],
      wouldReRecord: WRITE ? [] : reRecorded,
      reAttributed: WRITE ? reAttributed : [],
      wouldReAttribute: WRITE ? [] : reAttributed,
      supersededArtifacts: superseded.size,
      unattributed: unattributed.length,
      missingFromLedger: missing,
      ledgerEntriesWithoutAFile: orphaned,
      staleDigests: stale,
      supersededCitations: citations,
      retractions: retracted.size,
      retractionConflicts,
      unclassifiedPasses,
      declarationConflicts,
    },
    null,
    2,
  )}\n`,
);

if (!ok) process.exitCode = 1;

// A ledger that is committed and then edited is not append-only, whatever the file says. Checked
// against the committed copy rather than against a copy this process just wrote itself.
if (!WRITE && existingText !== "") {
  const committed = await run("git", ["show", `HEAD:docs/evidence/${LEDGER_PATH}`], {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  }).catch(() => null);
  if (committed) {
    const violation = appendOnlyViolation(committed.stdout, existingText);
    if (violation) {
      process.stderr.write(
        `the working copy of the ledger is not an append of the committed one: ${violation}\n`,
      );
      process.exitCode = 1;
    }
  }
}
