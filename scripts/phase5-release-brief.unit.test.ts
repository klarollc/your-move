import { describe, expect, it } from "vitest";

import { formatC17Status } from "./phase5-release-brief.js";

describe("Phase 5 C-17 release-brief status", () => {
  it("reports the successor owner disposition while preserving the walkthrough limits", () => {
    expect(
      formatC17Status(
        {
          criterionId: "C-17",
          disposition: "met",
          ruledOn: "2026-09-18",
        },
        true,
      ),
    ).toContain("met by owner disposition on 2026-09-18");
    expect(
      formatC17Status(
        {
          criterionId: "C-17",
          disposition: "met",
          ruledOn: "2026-09-18",
        },
        true,
      ),
    ).toContain("findings and environment omissions remain open");
  });

  it("does not infer satisfaction from a walkthrough filename alone", () => {
    expect(formatC17Status(null, true)).toContain("walkthrough record exists");
    expect(formatC17Status(null, true)).not.toContain("met by owner disposition");
  });
});

describe("Phase 5 C-17 scope exclusion", () => {
  const scope = {
    criterionId: "C-17",
    disposition: "out-of-scope",
    ruledOn: "2026-09-18",
  } as const;

  /**
   * Out of scope is not met, and a brief that blurs the two would hand the Release Reviewer a false
   * premise about what the build was asked to do. Scope takes precedence over every other C-17
   * source, because a criterion nobody intends to satisfy must not be counted as satisfied.
   */
  it("C-17: an out-of-scope ruling is reported as scope, never as satisfaction", () => {
    const status = formatC17Status(
      { criterionId: "C-17", disposition: "met", ruledOn: "2026-09-18" },
      true,
      scope,
    );
    expect(status).toContain("out of scope");
    expect(status).toContain("2026-09-18");
    expect(status).not.toContain("met by owner disposition");
    expect(status).not.toMatch(/satisfied/iu);
  });

  it("C-17: the scope ruling still names what it leaves unestablished", () => {
    const status = formatC17Status(null, false, scope);
    expect(status).toContain("out of scope");
    expect(status).toContain("never been verified");
    expect(status).toContain("keyboard operability");
  });
});
