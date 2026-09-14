import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5/browser");
const VIEWPORT = "chromium-1440";

/**
 * The brief for the Visual QA Reviewer's Task 7 annotation.
 *
 * The reviewer is given the contract, the capture manifest, and the accessibility tree of every
 * captured state — not the images. That limit is stated to it plainly rather than hidden, because a
 * reviewer that believes it has seen a picture will write as though it has, and this project would
 * then hold an annotation of an image nobody looked at.
 *
 * It is told what the mechanical checks already found, so it does not spend its turn rediscovering
 * name drift, and it is asked for the judgement those checks cannot make.
 *
 * The first version of this brief omitted the accessibility and isolation runs entirely. The
 * reviewer correctly reported that no such checks had been shown to it and recommended performing
 * work that already existed — a true answer to a question nobody should have asked. Both runs are
 * now included, as the artifacts they wrote rather than as an assurance from the author, along with
 * the prior annotation and the fact that the build has changed underneath it.
 */
export async function buildVisualQaBrief(): Promise<string> {
  const contract = JSON.parse(
    await readFile(
      resolve(ROOT, "docs/evidence/phase-5/surface-contract/surface-contract.json"),
      "utf8",
    ),
  ) as {
    contract: {
      artDirectionContract: unknown;
      stateInventory: Array<{
        id: string;
        visualTreatment: string;
        nonColourCue: string;
        accessibleName: string;
      }>;
      responsiveRules: string[];
      contentLengthRules: string[];
      reducedMotion: string[];
    };
  };

  const manifest = JSON.parse(await readFile(resolve(OUT, "capture-manifest.json"), "utf8")) as {
    cells: Array<{
      state: string;
      viewport: string;
      captured: boolean;
      captureSha256: string | null;
    }>;
    unreachableStates: Array<{ state: string; reason: string }>;
  };

  const fidelity = JSON.parse(await readFile(resolve(OUT, "fidelity-check.json"), "utf8")) as {
    drift: Array<{ state: string; contractAccessibleName: string; nearest: string | null }>;
  };

  const readJson = async <T>(path: string, fallback: T): Promise<T> => {
    const body = await readFile(path, "utf8").catch(() => "");
    return body ? (JSON.parse(body) as T) : fallback;
  };

  const scans = await Promise.all(
    (await readdir(resolve(OUT, VIEWPORT)))
      .filter((name) => name.startsWith("a11y-scan-"))
      .sort()
      .map(async (name) =>
        readJson<{ state: string; violations: unknown[]; rulesPassed: number }>(
          resolve(OUT, VIEWPORT, name),
          { state: name, violations: [], rulesPassed: 0 },
        ),
      ),
  );

  const zoom = await readJson<Record<string, unknown>>(
    resolve(OUT, VIEWPORT, "a11y-zoom-200.json"),
    {},
  );
  const motion = await readJson<Record<string, unknown>>(
    resolve(OUT, VIEWPORT, "a11y-reduced-motion.json"),
    {},
  );
  const content = await readJson<Record<string, unknown>>(
    resolve(OUT, VIEWPORT, "a11y-content-length.json"),
    {},
  );
  const isolation = await readJson<{
    passCondition: string;
    observations: Array<{ journey: string; externalRequests: string[]; storageWrites: string[] }>;
  }>(resolve(OUT, VIEWPORT, "isolation.json"), { passCondition: "", observations: [] });
  const deliberateFailure = await readJson<Record<string, unknown>>(
    resolve(OUT, VIEWPORT, "isolation-deliberate-failure.json"),
    {},
  );

  const priorPass = await readJson<{
    annotation: {
      verdict?: string;
      findings?: Array<{ severity: string; statement: string }>;
    } | null;
  }>(resolve(ROOT, "docs/evidence/phase-5/visual-qa/pass-1.json"), { annotation: null });

  const inventory = contract.contract.stateInventory
    .map(
      (entry) =>
        `  ${entry.id}\n     treatment: ${entry.visualTreatment}\n     non-colour cue: ${entry.nonColourCue}\n     accessible name: ${entry.accessibleName}`,
    )
    .join("\n");

  const snapshots: string[] = [];
  for (const entry of contract.contract.stateInventory) {
    const cell = manifest.cells.find(
      (item) => item.state === entry.id && item.viewport === VIEWPORT,
    );
    const body = await readFile(resolve(OUT, VIEWPORT, `${entry.id}.aria.yaml`), "utf8").catch(
      () => "",
    );
    snapshots.push(
      `--- ${entry.id} (captured: ${cell?.captured ? "yes" : "NO"}, image sha256: ${cell?.captureSha256 ?? "none"})\n${body.trim()}`,
    );
  }

  const drift = [...new Map(fidelity.drift.map((entry) => [entry.state, entry])).values()]
    .map(
      (entry) =>
        `  ${entry.state}: the contract says "${entry.contractAccessibleName}"; the build renders ${entry.nearest ?? "nothing resembling it"}`,
    )
    .join("\n");

  const unreachable = manifest.unreachableStates
    .map((entry) => `  ${entry.state}: ${entry.reason}`)
    .join("\n");

  return `THE ART-DIRECTION CONTRACT

${JSON.stringify(contract.contract.artDirectionContract, null, 2)}

THE TWENTY-STATE INVENTORY the build is annotated against

${inventory}

RESPONSIVE RULES

${contract.contract.responsiveRules.map((rule) => `  - ${rule}`).join("\n")}

CONTENT-LENGTH RULES

${contract.contract.contentLengthRules.map((rule) => `  - ${rule}`).join("\n")}

REDUCED-MOTION RULES

${contract.contract.reducedMotion.map((rule) => `  - ${rule}`).join("\n")}

WHAT WAS CAPTURED, AND WHAT YOU ARE ACTUALLY BEING SHOWN

Captures exist for both approved viewports, 1440x900 and 1280x800. You are being given the
accessibility tree of each state at ${VIEWPORT} and the sha256 of each image. **You are not being
shown the images and you cannot see them.** Say so wherever it limits you rather than writing as
though you had looked. Every image is byte-distinct from every other, which rules out one state
being filed twice; it says nothing about whether any of them looks right.

WHAT ELSE WAS RUN, AS ARTIFACTS RATHER THAN AS AN ASSURANCE

An earlier version of this brief omitted this section, and the reviewer reading it correctly reported
that no such checks had been shown to it. These files are in the capture directory and you are being
told what they contain.

Automated accessibility scans, ${VIEWPORT} (axe-core, one run per state):
${scans.map((scan) => `  ${scan.state}: ${scan.violations.length} violations, ${scan.rulesPassed} rules passed`).join("\n")}

  Axe is a floor. It checks the rules it encodes and says nothing about whether a person can operate
  this, so a clean scan is not an accessibility verdict.

200% zoom, emulated by halving the viewport: horizontal overflow
${JSON.stringify(zoom.horizontalOverflowPx)}px, console errors ${JSON.stringify((zoom.consoleErrors as unknown[] | undefined)?.length ?? 0)}, preserved
${JSON.stringify(zoom.preserved)}.

Reduced motion: elements carrying a non-zero transition or animation duration —
${JSON.stringify(motion.elementsWithNonZeroDuration)}. Checked over ${JSON.stringify(motion.checkedEvery)}.

Content length: title clipped ${JSON.stringify(content.titleClipped)}, summary clipped
${JSON.stringify(content.summaryClipped)}.

Isolation, ${isolation.observations.length} journeys: every one recorded
${JSON.stringify(isolation.observations.map((entry) => entry.externalRequests.length))} external requests and
${JSON.stringify(isolation.observations.map((entry) => entry.storageWrites.length))} storage writes. A deliberate
violation was then injected and caught: ${JSON.stringify(deliberateFailure.injectedViolation ?? "none")}.

What none of the above covers: a screen-reader walkthrough, any browser other than Chromium, and
whether any of this looks right.

A PRIOR ANNOTATION EXISTS, AND IT DESCRIBES AN EARLIER BUILD

Verdict ${JSON.stringify(priorPass.annotation?.verdict ?? "none")}. Its findings were:
${(priorPass.annotation?.findings ?? []).map((finding) => `  [${finding.severity}] ${finding.statement}`).join("\n") || "  none"}

All of them were ruled on by the owner and the build has changed since. **Do not assume they were
fixed and do not assume they were not.** The trees below are the current build; check against those.
Your annotation is your own, not a diff against that one.

STATES THE BUILD CANNOT ENTER

${unreachable || "  none"}

NAME DRIFT THE MECHANICAL CHECK ALREADY FOUND — do not spend your turn rediscovering these

${drift || "  none"}

THE ACCESSIBILITY TREE OF EACH CAPTURED STATE

${snapshots.join("\n\n")}

YOUR TASK

Annotate this current build against the contract. Return one JSON object:

{
  "stateAnnotations": [
    {"stateId": "pending",
     "contractSatisfied": "yes" | "partial" | "no" | "cannot-tell-without-seeing",
     "observed": "what the captured tree actually shows for this state",
     "gap": "what departs from the contract, or empty"}
  ],
  "findings": [
    {"severity": "blocking" | "significant" | "minor",
     "statement": "...",
     "evidence": "the state and the line of the tree that shows it",
     "recommendation": "..."}
  ],
  "requiresHumanEyes": ["what no capture and no tree can settle, and why"],
  "verdict": "NEEDS WORK" | "READY FOR OWNER FIDELITY ACCEPTANCE",
  "verdictReason": "..."
}

Annotate all twenty states. A state you cannot judge from a tree is "cannot-tell-without-seeing" —
that answer is expected for anything that is genuinely about appearance, and claiming to have judged
it would be worse than saying so.

Your brief requires you to treat a diff as detection of change and never as approval of taste, and
to refuse to let a green suite stand in for a look. An annotation that finds nothing is the outcome
this project treats as suspicious.

One JSON object. No prose outside it, no code fence.`;
}
