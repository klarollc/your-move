import { describe, expect, it } from "vitest";

import { ELIGIBLE, NEEDS_WORK, releaseOverclaims } from "./phase5-release-crosscheck.js";

const unmet = [
  { id: "C-17", why: "no screen-reader walkthrough has been performed" },
  { id: "C-18", why: "blocked on the provenance schema, gap 3" },
];

const versions = { "decision-notice.ts": "abc123" };

describe("release verdict cross-check", () => {
  it("accepts NEEDS WORK whatever else is outstanding", () => {
    // The asymmetry is deliberate: a reviewer may refuse for any reason, including reasons this
    // check knows nothing about.
    expect(releaseOverclaims({ verdict: NEEDS_WORK, artifactVersions: versions }, unmet)).toEqual(
      [],
    );
  });

  it("refuses eligibility while a named criterion is unmet", () => {
    expect(releaseOverclaims({ verdict: ELIGIBLE, artifactVersions: versions }, unmet)).toEqual([
      `${ELIGIBLE} while C-17 is unmet: no screen-reader walkthrough has been performed`,
      `${ELIGIBLE} while C-18 is unmet: blocked on the provenance schema, gap 3`,
    ]);
  });

  it("accepts eligibility when nothing is unmet", () => {
    expect(releaseOverclaims({ verdict: ELIGIBLE, artifactVersions: versions }, [])).toEqual([]);
  });

  it("refuses a verdict that names no artifact version", () => {
    expect(releaseOverclaims({ verdict: NEEDS_WORK }, [])).toEqual([
      "the verdict names no artifact or evidence version",
    ]);
    expect(releaseOverclaims({ verdict: NEEDS_WORK, artifactVersions: {} }, [])).toEqual([
      "the verdict names no artifact or evidence version",
    ]);
  });

  it("refuses a criterion reported satisfied and outstanding at once", () => {
    expect(
      releaseOverclaims(
        {
          verdict: NEEDS_WORK,
          artifactVersions: versions,
          outstanding: ["C-19"],
          criterionFindings: [
            { criterionId: "C-19", satisfied: true },
            { criterionId: "C-01", satisfied: true },
          ],
        },
        [],
      ),
    ).toEqual(["C-19 is reported satisfied and outstanding in the same verdict"]);
  });
});
