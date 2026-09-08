import { describe, expect, it } from "vitest";

import {
  checkBindingPreconditions,
  type BindingCandidate,
  type PromotedContract,
} from "./kickoff-preflight.js";

const NOW = 1_757_370_000_000;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const ROLE_IDS = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
];

function promoted(): PromotedContract[] {
  return ROLE_IDS.map((roleId) => ({
    roleId,
    sourceSha256: `source-${roleId}`,
    overlaySha256: `overlay-${roleId}`,
  }));
}

function bindings(mutate: (entries: BindingCandidate[]) => BindingCandidate[] = (e) => e) {
  return mutate(
    ROLE_IDS.map((roleId, index) => ({
      roleId,
      agentId: `agent_${index}`,
      bindingId: `binding_${index}`,
      qualified: true,
      roleContractVersion: `source-${roleId}:overlay-${roleId}`,
      evaluatedAt: NOW - 1000,
      exceptionExpiries: [],
    })),
  );
}

function run(entries: BindingCandidate[], now = NOW) {
  return checkBindingPreconditions({
    bindings: entries,
    promoted: promoted(),
    now,
    maxQualificationAgeMs: MAX_AGE,
  });
}

function codes(result: ReturnType<typeof run>) {
  return result.ok ? [] : result.failures.map((failure) => failure.code);
}

describe("kickoff binding preconditions", () => {
  it("accepts six distinct, promoted, qualified, current bindings", () => {
    expect(run(bindings())).toEqual({ ok: true });
  });

  it("rejects a roster missing a role", () => {
    expect(codes(run(bindings((entries) => entries.slice(0, 5))))).toContain(
      "SIX_DISTINCT_IDENTITIES_REQUIRED",
    );
  });

  it("rejects one agent bound to two roles, because six roles is not six identities", () => {
    const result = run(
      bindings((entries) =>
        entries.map((entry, index) => (index === 5 ? { ...entry, agentId: "agent_0" } : entry)),
      ),
    );
    expect(codes(result)).toContain("SIX_DISTINCT_IDENTITIES_REQUIRED");
  });

  it("rejects a role whose contract was never promoted", () => {
    const result = checkBindingPreconditions({
      bindings: bindings(),
      promoted: promoted().slice(0, 5),
      now: NOW,
      maxQualificationAgeMs: MAX_AGE,
    });
    expect(codes(result)).toContain("ROLE_NOT_PROMOTED");
  });

  it("rejects an agent whose qualification did not pass", () => {
    const result = run(
      bindings((entries) =>
        entries.map((entry, index) => (index === 2 ? { ...entry, qualified: false } : entry)),
      ),
    );
    expect(codes(result)).toContain("QUALIFICATION_FAILED");
    expect(result.ok === false && result.failures[0]?.detail).toBeTruthy();
  });

  it("rejects a qualification older than the maximum age", () => {
    const result = run(
      bindings((entries) =>
        entries.map((entry, index) =>
          index === 1 ? { ...entry, evaluatedAt: NOW - MAX_AGE - 1 } : entry,
        ),
      ),
    );
    expect(codes(result)).toContain("QUALIFICATION_STALE");
  });

  it("accepts a qualification exactly at the age boundary rather than off by one", () => {
    const result = run(
      bindings((entries) =>
        entries.map((entry, index) =>
          index === 1 ? { ...entry, evaluatedAt: NOW - MAX_AGE } : entry,
        ),
      ),
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a qualification evaluated against a different contract version than the promoted one", () => {
    const result = run(
      bindings((entries) =>
        entries.map((entry, index) =>
          index === 4 ? { ...entry, roleContractVersion: "source-old:overlay-old" } : entry,
        ),
      ),
    );
    expect(codes(result)).toContain("QUALIFICATION_VERSION_MISMATCH");
  });

  it("rejects an expired qualification exception", () => {
    const result = run(
      bindings((entries) =>
        entries.map((entry, index) =>
          index === 3 ? { ...entry, exceptionExpiries: [NOW - 1] } : entry,
        ),
      ),
    );
    expect(codes(result)).toContain("EXCEPTION_EXPIRED");
  });

  it("reports every failure rather than stopping at the first", () => {
    const result = run(
      bindings((entries) =>
        entries.map((entry, index) => {
          if (index === 0) return { ...entry, qualified: false };
          if (index === 1) return { ...entry, evaluatedAt: NOW - MAX_AGE - 1 };
          if (index === 2) return { ...entry, roleContractVersion: "source-old:overlay-old" };
          return entry;
        }),
      ),
    );

    // One preflight run should tell the operator everything that is wrong. Fixing one problem
    // only to discover the next is how a bounded live run burns its budget on setup.
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        "QUALIFICATION_FAILED",
        "QUALIFICATION_STALE",
        "QUALIFICATION_VERSION_MISMATCH",
      ]),
    );
  });

  it("names the role in every failure, so a report is actionable without a lookup", () => {
    const result = run(
      bindings((entries) =>
        entries.map((entry, index) => (index === 2 ? { ...entry, qualified: false } : entry)),
      ),
    );
    expect(
      result.ok === false &&
        result.failures.some((f) => f.detail.includes("implementation-engineer")),
    ).toBe(true);
  });
});
