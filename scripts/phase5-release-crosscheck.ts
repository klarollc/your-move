/**
 * Did the Release Reviewer's verdict claim more than the evidence supports?
 *
 * One verdict is checkable and the other is not. `NEEDS WORK` asserts something is missing, and
 * something always is, so there is nothing to catch. `ELIGIBLE FOR OWNER APPROVAL` asserts every
 * condition for approval is met, and three of them demonstrably are not: a criterion still blocked
 * on an unfinished schema, a screen-reader walkthrough nobody has performed, and an owner acceptance
 * that by definition only the owner can give.
 *
 * The check is therefore deliberately one-sided, and that asymmetry is the point. A reviewer is free
 * to say the phase is not ready for any reason it likes. It is not free to say the phase *is* ready
 * while naming, in its own answer, the things that are not done.
 *
 * Extracted and unit-tested from the start, because the Visual QA cross-check was not, and it spent
 * its first outing accusing an honest annotation of dishonesty.
 */

export type ReleaseVerdict = {
  verdict?: unknown;
  outstanding?: unknown;
  artifactVersions?: unknown;
  criterionFindings?: unknown;
};

export const ELIGIBLE = "ELIGIBLE FOR OWNER APPROVAL";
export const NEEDS_WORK = "NEEDS WORK";

export function releaseOverclaims(
  value: ReleaseVerdict,
  unmet: ReadonlyArray<{ id: string; why: string }>,
): string[] {
  const found: string[] = [];
  const verdict = String(value.verdict ?? "");

  if (verdict === ELIGIBLE) {
    for (const criterion of unmet) {
      found.push(`${verdict} while ${criterion.id} is unmet: ${criterion.why}`);
    }
  }

  // A verdict that names no artifact version is a verdict about an unnamed thing. The Phase 5 gate
  // requires approval to reference exact artifact and evidence versions, and a reviewer that cannot
  // say which build it reviewed has not produced something the owner can approve against.
  const versions = value.artifactVersions;
  const named =
    versions !== null &&
    typeof versions === "object" &&
    Object.keys(versions as Record<string, unknown>).length > 0;
  if (!named) found.push("the verdict names no artifact or evidence version");

  // Claiming a criterion is satisfied when the reviewer also lists it as outstanding is not a
  // judgement call; it is a contradiction inside one answer.
  const outstanding = new Set(
    (Array.isArray(value.outstanding) ? value.outstanding : []).map((entry) => String(entry)),
  );
  const findings = Array.isArray(value.criterionFindings) ? value.criterionFindings : [];
  for (const entry of findings) {
    const record = entry as { criterionId?: unknown; satisfied?: unknown };
    const id = String(record.criterionId ?? "");
    if (record.satisfied === true && outstanding.has(id)) {
      found.push(`${id} is reported satisfied and outstanding in the same verdict`);
    }
  }

  return [...new Set(found)];
}
