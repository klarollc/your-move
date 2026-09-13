import { describe, expect, it } from "vitest";

import { AUTHORITY_DISCLOSURES, composeRole, type RoleBrief } from "./role-composition.js";

function brief(overrides: Partial<RoleBrief> = {}): RoleBrief {
  return {
    roleId: "release-reviewer",
    mandate:
      "Judge independently whether the work is what it claims to be, and refuse to certify what has not been established.",
    context: [
      "Provenance and attribution are correctness properties, not paperwork.",
      '"Not checked" and "passed" are different findings and must never be recorded the same way.',
    ],
    standards: [
      "Every claim is traced to the artifact that establishes it.",
      "Superseded artifacts are named as superseded.",
    ],
    evidence: ["A conclusion naming what was verified, what was not, and what remains open."],
    refusals: [
      "Does not review work it materially produced.",
      "Does not certify on the strength of a green suite alone.",
    ],
    boundaries: [...AUTHORITY_DISCLOSURES],
    ...overrides,
  };
}

function composedText(input: RoleBrief): string {
  const result = composeRole(input);
  if (!result.ok) throw new Error(`expected composition to succeed, got ${result.refusal.code}`);
  return result.text;
}

describe("role composition", () => {
  it("carries every field of the brief into the composed instruction", () => {
    const input = brief();
    const text = composedText(input);

    for (const value of [
      input.mandate,
      ...input.context,
      ...input.standards,
      ...input.evidence,
      ...input.refusals,
      ...input.boundaries,
    ]) {
      expect(text).toContain(value);
    }
    expect(text).toContain(input.roleId);
  });

  it("is deterministic — the same brief composes byte-identically", () => {
    const once = composedText(brief());
    // Asserted before the comparison: two empty strings are also byte-identical, so without this
    // the determinism check passes against a composer that emits nothing.
    expect(once).toContain(brief().mandate);
    expect(once).toBe(composedText(brief()));
  });

  it("orders output by the schema, not by the key order of the object handed in", () => {
    const forward = brief();
    const reordered = {
      boundaries: forward.boundaries,
      refusals: forward.refusals,
      evidence: forward.evidence,
      standards: forward.standards,
      context: forward.context,
      mandate: forward.mandate,
      roleId: forward.roleId,
    } as RoleBrief;

    const text = composedText(reordered);
    expect(text).toContain(forward.mandate);
    expect(text).toBe(composedText(forward));
  });

  it("reproduces the three authority disclosures verbatim, not paraphrased", () => {
    const text = composedText(brief());
    for (const disclosure of AUTHORITY_DISCLOSURES) {
      expect(text).toContain(disclosure);
    }
  });

  it("refuses a brief whose boundaries omit an authority disclosure", () => {
    const result = composeRole(brief({ boundaries: [AUTHORITY_DISCLOSURES[0]] }));

    expect(result).toStrictEqual({
      ok: false,
      refusal: {
        code: "AUTHORITY_DISCLOSURE_MISSING",
        detail: expect.stringContaining("cannot grant tools"),
      },
    });
  });

  it("refuses a brief whose boundaries paraphrase a disclosure", () => {
    const paraphrased = [
      AUTHORITY_DISCLOSURES[0],
      AUTHORITY_DISCLOSURES[1],
      "This overlay narrows authority and cannot grant tools or credentials.",
    ];
    const result = composeRole(brief({ boundaries: paraphrased }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("AUTHORITY_DISCLOSURE_MISSING");
  });

  it("refuses a brief carrying secret-shaped text", () => {
    const result = composeRole(
      brief({ context: ["Use the api_key sk-live-not-a-real-key when calling the service."] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("ROLE_SECRET_REJECTED");
  });

  it("refuses an empty or whitespace-only required field", () => {
    for (const override of [
      { mandate: "   " },
      { context: [] },
      { standards: ["  "] },
      { evidence: [] },
      { refusals: [] },
      { roleId: "" },
    ] as Partial<RoleBrief>[]) {
      const result = composeRole(brief(override));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.refusal.code).toBe("ROLE_FIELD_EMPTY");
    }
  });

  it("emits nothing that did not come from the brief or the fixed scaffolding", () => {
    // The composed role is the agent's whole identity channel. Anything in it that the brief did
    // not supply is text nobody approved, so the set of lines is checked rather than sampled.
    const input = brief();
    const supplied = new Set<string>([
      input.roleId,
      input.mandate,
      ...input.context,
      ...input.standards,
      ...input.evidence,
      ...input.refusals,
      ...input.boundaries,
    ]);

    const text = composedText(input);
    // An empty composition has no unaccounted lines either, so presence is asserted first.
    expect(text).toContain(input.mandate);

    const unaccounted = text
      .split("\n")
      .map((line) => line.replace(/^[-#\s]+/u, "").trim())
      .filter((line) => line.length > 0)
      .filter((line) => !supplied.has(line))
      .filter((line) => !SCAFFOLDING.has(line));

    expect(unaccounted).toStrictEqual([]);
  });
});

/** Every fixed line the composer is allowed to emit on its own. */
const SCAFFOLDING = new Set<string>([
  "Role",
  "Mandate",
  "Context",
  "Standards",
  "Evidence",
  "Refusals",
  "Boundaries",
]);
