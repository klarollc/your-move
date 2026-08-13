import { describe, expect, it } from "vitest";

import { evaluateQualification, validateSixRoleRoster } from "./staffing.js";

describe("staffing contracts", () => {
  it("never lets an exception waive a mandatory qualification failure", () => {
    expect(
      evaluateQualification({
        checks: [
          { checkId: "identity", category: "identity", mandatory: true, passed: false },
          { checkId: "style", category: "advisory", mandatory: false, passed: false },
        ],
        exceptions: ["identity", "style"],
      }),
    ).toEqual({ qualified: false, blockingCheckIds: ["identity"], exceptedCheckIds: ["style"] });
  });

  it("requires six distinct identities for a complete six-role roster", () => {
    const assignments = [
      ["delivery-lead", "agent_1"],
      ["product-designer", "agent_2"],
      ["implementation-engineer", "agent_3"],
      ["test-engineer", "agent_4"],
      ["visual-qa-reviewer", "agent_5"],
      ["release-reviewer", "agent_5"],
    ].map(([roleId, agentId]) => ({ roleId: roleId!, agentId: agentId! }));

    expect(validateSixRoleRoster(assignments)).toEqual({
      ok: false,
      code: "SIX_DISTINCT_IDENTITIES_REQUIRED",
      missingRoleIds: [],
      duplicateAgentIds: ["agent_5"],
    });
  });
});
