import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * What evidence actually exists under docs/evidence/phase-5, read from the tree.
 *
 * Four briefs in this phase have told a role that some class of evidence did not exist when it did,
 * or omitted it entirely. Every one of those claims was hardcoded prose that was true the day it was
 * written. The roles answered accurately and the project nearly filed the answers as statements
 * about something else — and in one case spent a turn on it.
 *
 * So no brief states what evidence exists. They ask this, and this reads the directory.
 */
const ROOT = resolve(process.cwd());
const PHASE5 = resolve(ROOT, "docs/evidence/phase-5");

export type EvidenceInventory = Readonly<{
  present: string[];
  absent: string[];
  narrative: string;
}>;

const readJson = async <T>(path: string, fallback: T): Promise<T> => {
  const body = await readFile(resolve(PHASE5, path), "utf8").catch(() => "");
  return body ? (JSON.parse(body) as T) : fallback;
};

/** The provenance ledger covers the whole evidence tree, so it is read from the root, not phase-5. */
const readEvidenceFile = async (path: string): Promise<string> =>
  readFile(resolve(ROOT, "docs/evidence", path), "utf8").catch(() => "");

export async function buildEvidenceInventory(): Promise<EvidenceInventory> {
  const files = (await readdir(PHASE5, { recursive: true }).catch(() => [] as string[])).map(
    (name) => String(name).replaceAll("\\", "/"),
  );
  const has = (fragment: string): boolean => files.some((name) => name.includes(fragment));

  const manifest = await readJson<{
    presentCells: number;
    expectedCells: number;
    viewports: string[];
    unreachableStates: Array<{ state: string }>;
  }>("browser/capture-manifest.json", {
    presentCells: 0,
    expectedCells: 0,
    viewports: [],
    unreachableStates: [],
  });

  const fidelity = await readJson<{ namesMatching: number; namesDrifted: number }>(
    "browser/fidelity-check.json",
    { namesMatching: 0, namesDrifted: 0 },
  );

  const isolation = await readJson<{
    passCondition: string;
    observations: Array<{
      journey: string;
      requests: string[];
      externalRequests: string[];
      storageWrites: string[];
      credentialHits: string[];
      evidenceStates: string[];
      consoleLog: unknown[];
    }>;
  }>("browser/chromium-1440/isolation.json", { passCondition: "", observations: [] });

  const deliberate = await readJson<{ injectedViolation?: string }>(
    "browser/chromium-1440/isolation-deliberate-failure.json",
    {},
  );

  // Counted as distinct states, not as files: the same nine states are scanned at both viewports,
  // and reporting eighteen would overstate the coverage to whoever reads this.
  const scannedStates = new Set(
    files
      .filter((name) => name.includes("/a11y-scan-"))
      .map((name) => name.replace(/^.*\/a11y-scan-/u, "").replace(/\.json$/u, "")),
  );
  const scans = scannedStates.size;
  const zoom = await readJson<{
    horizontalOverflowPx?: number;
    emulatedBy?: string;
    emulationVerified?: { devicePixelRatio?: number; innerWidth?: number };
  }>("browser/chromium-1440/a11y-zoom-200.json", {});
  const motion = await readJson<{ elementsWithNonZeroDuration?: string[] }>(
    "browser/chromium-1440/a11y-reduced-motion.json",
    {},
  );

  const knowledge = await readJson<{
    disputedSubjects: string[];
    retrievalAfterResolution: { openConflicts: number };
  }>("shared-knowledge/scenario.json", {
    disputedSubjects: [],
    retrievalAfterResolution: { openConflicts: 0 },
  });

  const present: string[] = [];
  const absent: string[] = [];
  const lines: string[] = [];

  if (manifest.presentCells > 0) {
    present.push("rendered captures");
    lines.push(
      `  Browser captures: ${manifest.presentCells} of ${manifest.expectedCells} cells at ${manifest.viewports.join(" and ")}, every image byte-distinct, ${manifest.unreachableStates.length} state(s) the build cannot enter. Each capture has an accessibility tree beside it (docs/evidence/phase-5/browser/<viewport>/<state>.aria.yaml) and a journey record with the full console and network log.`,
    );
  } else {
    absent.push("rendered captures");
  }

  if (scans > 0) {
    present.push("automated accessibility runs");
    lines.push(
      // The zoom method is read from the record, not described here. This sentence used to say
      // "200% zoom emulated by halving the viewport" long after decision 9-C replaced that with real
      // device-metrics zoom — a brief describing a method the suite had stopped using.
      `  Accessibility: axe-core run on ${scans} states at each of ${manifest.viewports.length} viewports with zero violations; 200% zoom by ${zoom.emulatedBy ?? "an unrecorded method"}, with the emulation itself asserted (devicePixelRatio ${zoom.emulationVerified?.devicePixelRatio ?? "?"}, innerWidth ${zoom.emulationVerified?.innerWidth ?? "?"}) so a zoom test that did not zoom fails rather than passes, reporting ${zoom.horizontalOverflowPx ?? "?"}px of horizontal overflow; reflow at a narrow width is recorded separately in a11y-reflow-narrow.json and is not the same check; under reduced motion ${(motion.elementsWithNonZeroDuration ?? []).length} element(s) carry a non-zero transition or animation duration. Axe is a floor, not an accessibility verdict.`,
    );
  } else {
    absent.push("automated accessibility runs");
  }

  if (isolation.observations.length > 0) {
    present.push("isolation records");
    lines.push(
      // Every field the record actually carries, named. A summary of it omitted the credential scan
      // and the write scan, and the reviewer reading that summary correctly reported both missing.
      `  Isolation (docs/evidence/phase-5/browser/<viewport>/isolation.json): the defined procedure ran on ${isolation.observations.length} journeys — ${isolation.observations.map((entry) => entry.journey).join(", ")}. Per journey it records the complete request log (${isolation.observations.reduce((total, entry) => total + entry.requests.length, 0)} requests in total, ${isolation.observations.reduce((total, entry) => total + entry.externalRequests.length, 0)} of them external), the console log, a scan of the rendered document, console and persisted state for credential-shaped strings (${isolation.observations.reduce((total, entry) => total + entry.credentialHits.length, 0)} hits), every storage write target via patched localStorage, sessionStorage and indexedDB (${isolation.observations.reduce((total, entry) => total + entry.storageWrites.length, 0)} writes), and the resolution state of every evidence link. Pass condition: ${JSON.stringify(isolation.passCondition)}. Its deliberate-failure step injected ${JSON.stringify(deliberate.injectedViolation ?? "nothing")} and the detector caught it, so a clean result is a finding rather than a silence.`,
    );
  } else {
    absent.push("isolation records");
  }

  if (fidelity.namesMatching + fidelity.namesDrifted > 0) {
    present.push("contract-name fidelity check");
    lines.push(
      `  Fidelity: ${fidelity.namesMatching} contract accessible names matched against the captured trees, ${fidelity.namesDrifted} drifting.`,
    );
  }

  // Omitted from this inventory until 2026-09-14, so a reviewer assessing C-08 was told about the
  // in-process same-input test and the static unreachability scan and not about the two-run
  // comparison that actually answers the criterion. The absence of a line is a claim too.
  const determinism = await readJson<{
    artifactsCompared?: number;
    identical?: boolean;
    differing?: string[];
    excludedFromComparison?: Array<{ file: string; why: string }>;
    injected?: string[];
  }>("browser/determinism.json", {});
  if (determinism.artifactsCompared) {
    present.push("two-run determinism comparison");
    lines.push(
      `  Determinism (phase-5/browser/determinism.json): the whole capture ran twice through a real browser and ${determinism.artifactsCompared} artifacts were digested and compared, ${determinism.identical ? "all identical" : `${(determinism.differing ?? []).length} differing`}. Injected rather than ambient: ${(determinism.injected ?? []).join(", ")}. ${(determinism.excludedFromComparison ?? []).map((entry) => `${entry.file} is excluded because it ${entry.why}`).join("; ")}. A repeat inside one process shares that process's locale, timezone and module state, so the in-process test beside this one cannot see the class of non-determinism that varies between runs.`,
    );
  } else {
    absent.push("a two-run determinism comparison");
  }

  if (has("visual-qa/")) {
    present.push("visual QA annotation");
    lines.push(
      "  Visual QA: the promoted visual-qa-reviewer annotated the captures from accessibility trees and image digests, without seeing the images.",
    );
  } else {
    absent.push("visual QA annotation");
  }

  if (knowledge.disputedSubjects.length > 0) {
    present.push("shared-knowledge scenario");
    lines.push(
      `  Shared knowledge: contribution, retrieval and conflict resolution exercised over ${knowledge.disputedSubjects.length} real disputed subjects, ${knowledge.retrievalAfterResolution.openConflicts} conflicts left open.`,
    );
  }

  const ledgerText = await readEvidenceFile("provenance.jsonl");
  if (ledgerText.trim() !== "") {
    const entries = ledgerText
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as { op: string; producerKind?: string; artifact: string });
    const records = new Map<string, string>();
    for (const entry of entries) {
      if (entry.op === "record") records.set(entry.artifact, entry.producerKind ?? "unknown");
    }
    const unknown = [...records.values()].filter((kind) => kind === "unknown").length;
    present.push("artifact provenance ledger");
    lines.push(
      `  Provenance (docs/evidence/provenance.jsonl, schema at phase-5/provenance/schema.json): ${records.size} artifacts recorded with a content digest and a producer, ${entries.filter((entry) => entry.op === "supersede").length} supersession edges, append-only. Enforced by npm run phase5:provenance inside npm run verify: every file has a record, every recorded digest still matches, and no artifact that is still current may cite a superseded one outside a declared historical field. ${unknown} artifacts carry producerKind "unknown" — almost all pre-Phase-5, where no code in the tree writes the file and no record says who did. Those are stated as unestablished, never guessed, and whether that satisfies "every evidence artifact" is your judgement to make.`,
    );
  } else {
    absent.push("artifact provenance ledger");
  }

  const matrix = await readJson<{
    statesMeasured?: number;
    conditions?: Record<string, string>;
    observations?: Array<{ state: string; condition: string }>;
  }>("browser/chromium-1440/a11y-state-matrix.json", {});
  if (matrix.statesMeasured) {
    present.push("per-state reduced-motion and zoom matrix");
    lines.push(
      `  State matrix (phase-5/browser/<viewport>/a11y-state-matrix.json): all ${matrix.statesMeasured} contract states measured three times each — unconstrained, under reduced motion, and under 200% zoom — at both viewports, recording the rendered roles and accessible names, the data markers the non-colour cues are built from, every visible leaf's text, page-level horizontal overflow, clipped elements and animating elements. The two constrained readings must equal the baseline: the criterion says "preserve", which is a comparison rather than a property, so a build that swapped every name under zoom would fail rather than pass. Only rendered elements are counted; reading textContent instead let a label hidden by a zoom-width media query survive the check.`,
    );
  } else {
    absent.push("a per-state reduced-motion and zoom matrix");
  }

  const sideEffects = await readJson<{
    modulesScanned?: number;
    externalPackagesImported?: string[];
    findings?: Record<string, string[]>;
    entryPoints?: string[];
    whatThisCannotEstablish?: string[];
  }>("side-effect-review.json", {});
  if (sideEffects.modulesScanned) {
    const found = Object.entries(sideEffects.findings ?? {})
      .map(([category, hits]) => `${category} ${hits.length}`)
      .join(", ");
    present.push("static side-effect review");
    lines.push(
      `  Side effects, statically (phase-5/side-effect-review.json): the import graph was walked from ${(sideEffects.entryPoints ?? []).join(", ")} and all ${sideEffects.modulesScanned} reachable first-party modules were read, whether or not any journey executed them — ${found}. External packages imported by that graph: ${(sideEffects.externalPackagesImported ?? []).join(", ") || "none"}; their internals are not walked. This is the static half of C-11 and does not replace the behavioral isolation records, which speak only for the paths they walked. Its stated limits: ${(sideEffects.whatThisCannotEstablish ?? []).length} of them, in the artifact.`,
    );
  } else {
    absent.push("a static side-effect review");
  }

  const acceptance = await readJson<{
    ruling?: string;
    ruledOn?: string;
    perStateMarks?: string;
    lookedAt?: { plates?: number };
  }>("c-19-owner-acceptance.json", {});
  if (acceptance.ruling) {
    present.push("owner fidelity acceptance");
    lines.push(
      `  Owner fidelity acceptance (phase-5/c-19-owner-acceptance.json, evidence class human-visual-acceptance, ruled ${acceptance.ruledOn ?? "?"}): ${JSON.stringify(acceptance.ruling)} It covers ${acceptance.lookedAt?.plates ?? "?"} plates, each verified against its manifest digest before the ruling was filed. Per-state marks: ${acceptance.perStateMarks ?? "unrecorded"}`,
    );
  } else {
    absent.push("owner fidelity acceptance");
  }

  const waivers = await readJson<{
    waivers: Array<{
      criterionId: string;
      disposition: string;
      whatIsThereforeNotEstablished?: string[];
    }>;
  }>("acceptance-contract-waivers.json", { waivers: [] });
  if (waivers.waivers.length > 0) {
    present.push("owner waivers against the contract");
    lines.push(
      `  Owner waivers (phase-5/acceptance-contract-waivers.json): ${waivers.waivers.map((waiver) => `${waiver.criterionId} ${waiver.disposition}`).join(", ")}. A waived criterion is NOT a met criterion. The overlay states what each waiver leaves unestablished, and it requires you to report a waived criterion as "waived by owner" rather than folding it into a satisfied count.`,
    );
  }

  if (!has("screen-reader")) {
    absent.push(
      waivers.waivers.some((waiver) => waiver.criterionId === "C-17")
        ? "any screen-reader walkthrough record — C-17 was waived by the owner rather than performed, so no human listener has heard this interface"
        : "any screen-reader walkthrough record",
    );
  }
  absent.push("any browser other than Chromium");

  return {
    present,
    absent,
    narrative: `${lines.join("\n")}\n\n  Not present: ${absent.join("; ")}.`,
  };
}
