import { describe, expect, it } from "vitest";

import { parseContractDraft, renderProse } from "./work-contract.js";

const valid = {
  outcome: "Owners can see their provider connection status on one page.",
  scope: ["Status line per provider", "Plain wording for each state"],
  exclusions: ["Billing", "Multiple users"],
  acceptanceCriteria: ["Status shows connected, disconnected, or needs renewal"],
  permissionCeiling: "draft_only",
};

describe("parseContractDraft", () => {
  it("accepts a well-formed draft", () => {
    const result = parseContractDraft(JSON.stringify(valid));
    expect(result.ok).toBe(true);
  });

  it("accepts a draft wrapped in a Markdown code fence", () => {
    const result = parseContractDraft("```json\n" + JSON.stringify(valid) + "\n```");
    expect(result.ok).toBe(true);
  });

  it("rejects extra keys (strict schema)", () => {
    const result = parseContractDraft(
      JSON.stringify({ ...valid, permissionCeiling: "draft_only", runNow: true }),
    );
    expect(result).toEqual({ ok: false, code: "CONTRACT_DRAFT_INVALID" });
  });

  it("rejects any permission ceiling other than draft_only", () => {
    const result = parseContractDraft(
      JSON.stringify({ ...valid, permissionCeiling: "workspace_write" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a draft with no acceptance criteria", () => {
    const result = parseContractDraft(JSON.stringify({ ...valid, acceptanceCriteria: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects non-JSON model output", () => {
    expect(parseContractDraft("Sure! Here is your draft.").ok).toBe(false);
  });
});

describe("renderProse", () => {
  it("renders only plain prose: no braces, brackets, or schema keys", () => {
    const parsed = parseContractDraft(JSON.stringify(valid));
    if (!parsed.ok) throw new Error("fixture invalid");
    const prose = renderProse(parsed.contract);
    const ownerText = [
      prose.achieve,
      ...prose.inScope,
      ...prose.outOfScope,
      ...prose.doneWhen,
    ].join("\n");
    expect(ownerText).not.toMatch(/[{}]/);
    expect(ownerText).not.toMatch(/permissionCeiling|acceptanceCriteria|draft_only/);
    expect(prose.doneWhen).toEqual(valid.acceptanceCriteria);
    expect(prose.outOfScope).toEqual(valid.exclusions);
  });
});
