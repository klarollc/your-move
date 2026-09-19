/**
 * Artifact provenance and supersession — C-18, and the close of charter gap 3.
 *
 * The criterion has two halves and the second is the one with teeth: "Each artifact carries its
 * origin and, when replaced, a link to what superseded it; **a superseded artifact can never be
 * cited as current**." Recording origins is bookkeeping. Refusing a stale citation is the part that
 * would have caught DF-015, where release pass 1 reported 4 of 21 and pass 3 reported 11 of 21 on an
 * implementation that had not changed, because the briefs were built from different pictures of the
 * same tree.
 *
 * The owner ruled the sidecar shape on 2026-09-14: an append-only ledger beside the evidence, never
 * a field written into the evidence. Marking an accepted artifact superseded by editing it is the
 * mutation that produced D4-P-001 and D4-P-003, and the immutability guard exists to stop exactly
 * that. Appending a line mutates nothing.
 *
 * Schema: docs/evidence/phase-5/provenance/schema.json
 */

/**
 * `implementer` is kept distinct from `agent` deliberately. Decision 5-A says the promoted role
 * agents did not write the implementation and the packet must state that limit rather than let the
 * phase read as the stronger result; collapsing the two here would erase exactly that distinction
 * in the record that is supposed to preserve it.
 */
export type ProducerKind = "script" | "suite" | "agent" | "implementer" | "owner" | "unknown";

export type RecordEntry = {
  op: "record";
  artifact: string;
  sha256: string;
  bytes: number;
  recordedAt: string;
  producerKind: ProducerKind;
  producedBy: string | null;
  authorizedBy: string | null;
};

export type SupersedeEntry = {
  op: "supersede";
  artifact: string;
  supersededBy: string;
  recordedAt: string;
  why: string;
};

export type LedgerEntry = RecordEntry | SupersedeEntry;

/**
 * Fields whose values name an artifact *because* it is no longer current. A citation inside one of
 * these is a citation of history, which is the only honest way to refer to something superseded.
 * Everything outside them is read as a claim about what is current now.
 */
export const HISTORICAL_FIELDS = new Set([
  "previousPasses",
  "supersedes",
  "supersededBy",
  "supersededPasses",
  "supersededPassAliases",
  "notToBeConfusedWith",
  // Added 2026-09-18 for the C-17 scope overlay, which must point at the waiver, the disposition
  // and the review passes that refused to certify. A field named for the history it holds makes no
  // current claim; borrowing an existing name that means something else is the `amendments.json`
  // defect, where a `supersedes` field did not mean supersession.
  "historyPreserved",
]);

/** The ledger cannot record itself without regress. Excluded by name, never by a pattern. */
export const LEDGER_PATH = "provenance.jsonl";

const EVIDENCE_PREFIX = "docs/evidence/";

/** Both spellings appear across the tree; they name the same file and must compare equal. */
export const normaliseArtifactPath = (value: string): string =>
  value.replaceAll("\\", "/").replace(/^\.\//u, "").replace(EVIDENCE_PREFIX, "");

/**
 * Reads a ledger, refusing malformed lines by name rather than skipping them.
 *
 * A parser that silently drops what it cannot read turns a corrupt ledger into a short one, and a
 * short ledger reads as "these artifacts have no provenance" — the very condition the guard is
 * supposed to detect. Same shape as the persisted-state refusal in the Decision Notice core.
 */
export function parseLedger(text: string): { entries: LedgerEntry[]; refusals: string[] } {
  const entries: LedgerEntry[] = [];
  const refusals: string[] = [];
  const lines = text.split("\n");

  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") continue;
    const at = `line ${index + 1}`;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      refusals.push(`${at}: not JSON`);
      continue;
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      refusals.push(`${at}: not an object`);
      continue;
    }
    const entry = value as Record<string, unknown>;
    if (entry.op === "record") {
      if (typeof entry.artifact !== "string" || typeof entry.sha256 !== "string") {
        refusals.push(`${at}: record entry without an artifact and digest`);
        continue;
      }
      entries.push(entry as unknown as RecordEntry);
      continue;
    }
    if (entry.op === "supersede") {
      if (typeof entry.artifact !== "string" || typeof entry.supersededBy !== "string") {
        refusals.push(`${at}: supersede entry without both ends of the edge`);
        continue;
      }
      entries.push(entry as unknown as SupersedeEntry);
      continue;
    }
    refusals.push(`${at}: unknown op ${JSON.stringify(entry.op)}`);
  }

  return { entries, refusals };
}

export const serialiseLedger = (entries: LedgerEntry[]): string =>
  entries.map((entry) => JSON.stringify(entry)).join("\n") + (entries.length > 0 ? "\n" : "");

/** The latest record entry per artifact. A re-recorded artifact is the later line, not the first. */
export function currentRecords(entries: LedgerEntry[]): Map<string, RecordEntry> {
  const records = new Map<string, RecordEntry>();
  for (const entry of entries) {
    if (entry.op === "record") records.set(normaliseArtifactPath(entry.artifact), entry);
  }
  return records;
}

export function supersededArtifacts(entries: LedgerEntry[]): Map<string, string> {
  const superseded = new Map<string, string>();
  for (const entry of entries) {
    if (entry.op === "supersede") {
      superseded.set(
        normaliseArtifactPath(entry.artifact),
        normaliseArtifactPath(entry.supersededBy),
      );
    }
  }
  return superseded;
}

/** P-1: an artifact on disk with no record entry has no established origin. */
export function artifactsMissingFromLedger(
  filesOnDisk: string[],
  entries: LedgerEntry[],
): string[] {
  const records = currentRecords(entries);
  return filesOnDisk
    .map(normaliseArtifactPath)
    .filter((path) => path !== LEDGER_PATH && !records.has(path))
    .sort();
}

/** A ledger entry naming a file that is not there any more. Kept separate: it is a different fault. */
export function ledgerEntriesWithoutAFile(filesOnDisk: string[], entries: LedgerEntry[]): string[] {
  const onDisk = new Set(filesOnDisk.map(normaliseArtifactPath));
  return [...currentRecords(entries).keys()].filter((path) => !onDisk.has(path)).sort();
}

/**
 * P-2: a recorded digest that no longer describes the file.
 *
 * Superseded artifacts are exempt for a reason worth stating: being superseded is precisely the
 * claim that this file is no longer the current one, so a drifted digest there is not news. For
 * everything else a drift means the provenance record describes bytes that are gone.
 */
export function staleRecords(
  digestsOnDisk: Map<string, string>,
  entries: LedgerEntry[],
): Array<{ artifact: string; recorded: string; actual: string }> {
  const superseded = supersededArtifacts(entries);
  const stale: Array<{ artifact: string; recorded: string; actual: string }> = [];
  for (const [artifact, record] of currentRecords(entries)) {
    if (superseded.has(artifact)) continue;
    const actual = digestsOnDisk.get(artifact);
    if (actual !== undefined && actual !== record.sha256) {
      stale.push({ artifact, recorded: record.sha256, actual });
    }
  }
  return stale.sort((a, b) => a.artifact.localeCompare(b.artifact));
}

/**
 * Every artifact path named anywhere inside a parsed value, except under a historical field.
 *
 * The walk skips the whole subtree beneath a historical key rather than just its immediate value:
 * `previousPasses` holds an array, and a rule that only exempted scalars would fail every file that
 * uses the convention correctly.
 */
export function citedArtifacts(value: unknown, withinHistory = false): string[] {
  if (withinHistory) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    const looksLikeAPath =
      trimmed.startsWith(EVIDENCE_PREFIX) || /^phase-\d[\w/.-]*\.(?:json|md|jsonl)$/u.test(trimmed);
    return looksLikeAPath ? [normaliseArtifactPath(trimmed)] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => citedArtifacts(item));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      citedArtifacts(child, HISTORICAL_FIELDS.has(key)),
    );
  }
  return [];
}

/**
 * P-3, the enforcement half of C-18.
 *
 * `previousPasses` values are bare filenames — "pass-1.json" — so a citation is resolved against the
 * citing artifact's own directory before it is judged. Resolving against the repository root instead
 * would make every relative citation miss, and a guard that matches nothing passes everything.
 */
export function supersededCitations(
  citingArtifact: string,
  parsed: unknown,
  entries: LedgerEntry[],
): Array<{ citedBy: string; cited: string; supersededBy: string }> {
  const superseded = supersededArtifacts(entries);
  const citing = normaliseArtifactPath(citingArtifact);
  if (superseded.has(citing)) return [];

  const directory = citing.includes("/") ? citing.slice(0, citing.lastIndexOf("/")) : "";
  const found: Array<{ citedBy: string; cited: string; supersededBy: string }> = [];

  for (const cited of new Set(citedArtifacts(parsed))) {
    for (const candidate of [cited, directory === "" ? cited : `${directory}/${cited}`]) {
      const replacement = superseded.get(candidate);
      if (replacement !== undefined && candidate !== citing) {
        found.push({ citedBy: citing, cited: candidate, supersededBy: replacement });
        break;
      }
    }
  }
  return found.sort((a, b) => a.cited.localeCompare(b.cited));
}

/** P-4: the committed ledger must survive, in order, as a prefix of the new one. */
export function appendOnlyViolation(previous: string, next: string): string | null {
  const previousLines = previous.split("\n").filter((line) => line.trim() !== "");
  const nextLines = next.split("\n").filter((line) => line.trim() !== "");
  if (nextLines.length < previousLines.length) {
    return `the ledger lost ${previousLines.length - nextLines.length} line(s); it may only grow`;
  }
  for (const [index, line] of previousLines.entries()) {
    if (nextLines[index] !== line)
      return `line ${index + 1} was rewritten; the ledger is append-only`;
  }
  return null;
}

/**
 * Supersession derived from the pass-N convention, and only from it.
 *
 * `supersedes` is deliberately not a source. amendments.json carries `"supersedes":
 * "…/surface-contract.json"` and does not supersede it — it amends two names in a contract that
 * stays authoritative and stays cited everywhere. Deriving an edge from that field would mark the
 * live contract superseded and then forbid every honest citation of it. The schema records this
 * rather than quietly working around it.
 */
export function derivePassSupersessions(
  files: string[],
  aliases: ReadonlyMap<string, number> = new Map(),
): Array<{ artifact: string; supersededBy: string }> {
  const byDirectory = new Map<string, Array<{ path: string; pass: number }>>();

  for (const raw of files) {
    const path = normaliseArtifactPath(raw);
    const name = path.slice(path.lastIndexOf("/") + 1);
    const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const numbered = /^pass-(\d+)\.json$/u.exec(name);
    const pass = numbered ? Number(numbered[1]) : aliases.get(path);
    if (pass === undefined) continue;
    const group = byDirectory.get(directory) ?? [];
    group.push({ path, pass });
    byDirectory.set(directory, group);
  }

  const edges: Array<{ artifact: string; supersededBy: string }> = [];
  for (const group of byDirectory.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => a.pass - b.pass);
    const latest = ordered[ordered.length - 1] as { path: string; pass: number };
    for (const entry of ordered.slice(0, -1)) {
      edges.push({ artifact: entry.path, supersededBy: latest.path });
    }
  }
  return edges.sort((a, b) => a.artifact.localeCompare(b.artifact));
}
