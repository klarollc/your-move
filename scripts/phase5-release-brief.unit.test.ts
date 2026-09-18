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
