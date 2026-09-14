import { describe, expect, it } from "vitest";

import {
  appendOnlyViolation,
  artifactsMissingFromLedger,
  citedArtifacts,
  derivePassSupersessions,
  ledgerEntriesWithoutAFile,
  parseLedger,
  staleRecords,
  supersededArtifacts,
  supersededCitations,
  type LedgerEntry,
} from "./phase5-provenance.js";

/**
 * C-18's enforcement half, tested before anything relies on it.
 *
 * The one that matters is P-3. "A superseded artifact can never be cited as current" is the clause
 * that would have caught DF-015, and a guard for it can fail in two opposite directions: letting a
 * stale citation through, and refusing an honest historical one. `previousPasses` exists precisely
 * so a later pass can name the earlier ones; a rule that flagged those would make the convention
 * unusable and would be quietly switched off.
 */

const record = (artifact: string, sha256 = "a".repeat(64)): LedgerEntry => ({
  op: "record",
  artifact,
  sha256,
  bytes: 10,
  recordedAt: "2026-09-14T00:00:00.000Z",
  producerKind: "script",
  producedBy: "scripts/x.ts",
  authorizedBy: null,
});

const supersede = (artifact: string, supersededBy: string): LedgerEntry => ({
  op: "supersede",
  artifact,
  supersededBy,
  recordedAt: "2026-09-14T00:00:00.000Z",
  why: "a later pass",
});

describe("ledger parsing", () => {
  it("refuses malformed lines by name instead of dropping them", () => {
    const text = [
      JSON.stringify(record("phase-5/a.json")),
      "{not json",
      JSON.stringify({ op: "record", artifact: "phase-5/b.json" }),
      JSON.stringify({ op: "rewrite", artifact: "phase-5/c.json" }),
      JSON.stringify([1, 2]),
      "",
    ].join("\n");

    const { entries, refusals } = parseLedger(text);

    // One good line survives; the four bad ones are named, not silently skipped. A parser that
    // dropped them would report three artifacts as having no provenance at all.
    expect(entries).toHaveLength(1);
    expect(refusals).toStrictEqual([
      "line 2: not JSON",
      "line 3: record entry without an artifact and digest",
      'line 4: unknown op "rewrite"',
      "line 5: not an object",
    ]);
  });

  it("treats a later record for the same artifact as the current one", () => {
    const { entries } = parseLedger(
      [
        JSON.stringify(record("phase-5/a.json", "1".repeat(64))),
        JSON.stringify(record("phase-5/a.json", "2".repeat(64))),
      ].join("\n"),
    );
    expect(staleRecords(new Map([["phase-5/a.json", "2".repeat(64)]]), entries)).toStrictEqual([]);
  });
});

describe("P-1 and P-2, coverage and drift", () => {
  it("names an artifact on disk with no entry, and ignores the ledger itself", () => {
    const entries = [record("phase-5/a.json")];
    expect(
      artifactsMissingFromLedger(["phase-5/a.json", "phase-5/b.json", "provenance.jsonl"], entries),
    ).toStrictEqual(["phase-5/b.json"]);
  });

  it("accepts either spelling of the same path", () => {
    const entries = [record("docs/evidence/phase-5/a.json")];
    expect(artifactsMissingFromLedger(["phase-5/a.json"], entries)).toStrictEqual([]);
  });

  it("names an entry whose file is gone separately from a missing entry", () => {
    const entries = [record("phase-5/a.json"), record("phase-5/gone.json")];
    expect(ledgerEntriesWithoutAFile(["phase-5/a.json"], entries)).toStrictEqual([
      "phase-5/gone.json",
    ]);
  });

  it("reports a digest that no longer describes the file", () => {
    const entries = [record("phase-5/a.json", "1".repeat(64))];
    expect(staleRecords(new Map([["phase-5/a.json", "9".repeat(64)]]), entries)).toStrictEqual([
      { artifact: "phase-5/a.json", recorded: "1".repeat(64), actual: "9".repeat(64) },
    ]);
  });

  it("exempts a superseded artifact from the drift check", () => {
    // Being superseded is the claim that this file is no longer current, so its digest moving is
    // not news. Flagging it would make every historical artifact a permanent failure.
    const entries = [
      record("phase-5/pass-1.json", "1".repeat(64)),
      supersede("phase-5/pass-1.json", "phase-5/pass-2.json"),
    ];
    expect(staleRecords(new Map([["phase-5/pass-1.json", "9".repeat(64)]]), entries)).toStrictEqual(
      [],
    );
  });
});

describe("P-3, a superseded artifact cited as current", () => {
  const entries = [
    record("phase-5/release-review/pass-1.json"),
    record("phase-5/release-review/pass-3.json"),
    supersede("phase-5/release-review/pass-1.json", "phase-5/release-review/pass-3.json"),
  ];

  it("catches a current artifact citing a superseded one", () => {
    const brief = { sources: ["docs/evidence/phase-5/release-review/pass-1.json"] };
    expect(supersededCitations("phase-5/brief.json", brief, entries)).toStrictEqual([
      {
        citedBy: "phase-5/brief.json",
        cited: "phase-5/release-review/pass-1.json",
        supersededBy: "phase-5/release-review/pass-3.json",
      },
    ]);
  });

  it("allows a later pass to name the passes it replaced", () => {
    // The direction this gets wrong more easily. previousPasses exists to name history, and the
    // values are bare filenames resolved against the citing artifact's own directory.
    const passThree = { pass: 3, previousPasses: ["pass-1.json", "pass-2.json"] };
    expect(
      supersededCitations("phase-5/release-review/pass-3.json", passThree, entries),
    ).toStrictEqual([]);
  });

  it("does not police an artifact that is itself superseded", () => {
    const passOne = { sources: ["docs/evidence/phase-5/release-review/pass-1.json"] };
    expect(
      supersededCitations("phase-5/release-review/pass-1.json", passOne, entries),
    ).toStrictEqual([]);
  });

  it("skips the whole subtree under a historical field, not just its scalar", () => {
    const nested = { supersedes: { was: ["docs/evidence/phase-5/release-review/pass-1.json"] } };
    expect(citedArtifacts(nested)).toStrictEqual([]);
  });

  it("still reads paths outside historical fields", () => {
    expect(citedArtifacts({ a: "phase-5/x.json", b: "not a path", c: 4 })).toStrictEqual([
      "phase-5/x.json",
    ]);
  });
});

describe("P-4, append-only", () => {
  const first = `${JSON.stringify(record("phase-5/a.json"))}\n`;

  it("accepts an append", () => {
    expect(
      appendOnlyViolation(first, `${first}${JSON.stringify(record("phase-5/b.json"))}\n`),
    ).toBeNull();
  });

  it("refuses a shortened ledger", () => {
    expect(appendOnlyViolation(first, "")).toMatch(/may only grow/u);
  });

  it("refuses a rewritten line even when the length is unchanged", () => {
    expect(appendOnlyViolation(first, `${JSON.stringify(record("phase-5/z.json"))}\n`)).toMatch(
      /line 1 was rewritten/u,
    );
  });
});

describe("supersession derivation", () => {
  it("supersedes every pass but the highest, per directory", () => {
    expect(
      derivePassSupersessions([
        "phase-5/release-review/pass-1.json",
        "phase-5/release-review/pass-2.json",
        "phase-5/release-review/pass-3.json",
        "phase-5/visual-qa/pass-1.json",
        "phase-5/visual-qa/pass-2.json",
      ]),
    ).toStrictEqual([
      {
        artifact: "phase-5/release-review/pass-1.json",
        supersededBy: "phase-5/release-review/pass-3.json",
      },
      {
        artifact: "phase-5/release-review/pass-2.json",
        supersededBy: "phase-5/release-review/pass-3.json",
      },
      { artifact: "phase-5/visual-qa/pass-1.json", supersededBy: "phase-5/visual-qa/pass-2.json" },
    ]);
  });

  it("orders by number, not by filename", () => {
    // "pass-10.json" sorts before "pass-9.json" as a string, which would make pass 9 supersede
    // pass 10 and leave the stale one current.
    const edges = derivePassSupersessions(["phase-5/r/pass-9.json", "phase-5/r/pass-10.json"]);
    expect(edges).toStrictEqual([
      { artifact: "phase-5/r/pass-9.json", supersededBy: "phase-5/r/pass-10.json" },
    ]);
  });

  it("includes an aliased pass written before the convention existed", () => {
    const edges = derivePassSupersessions(
      ["phase-5/verification/verification.json", "phase-5/verification/pass-2.json"],
      new Map([["phase-5/verification/verification.json", 1]]),
    );
    expect(edges).toStrictEqual([
      {
        artifact: "phase-5/verification/verification.json",
        supersededBy: "phase-5/verification/pass-2.json",
      },
    ]);
  });

  it("leaves a sole pass alone", () => {
    expect(derivePassSupersessions(["phase-5/only/pass-1.json"])).toStrictEqual([]);
  });

  it("never derives an edge from a supersedes field", () => {
    // amendments.json says "supersedes": ".../surface-contract.json" and does not supersede it.
    // Acting on that field would mark the live contract superseded and forbid every citation of it.
    const edges = derivePassSupersessions(["phase-5/surface-contract/amendments.json"]);
    expect(edges).toStrictEqual([]);
    expect(supersededArtifacts([])).toStrictEqual(new Map());
  });

  it("does not cross directories", () => {
    expect(
      derivePassSupersessions([
        "phase-5/verification/pass-2.json",
        "phase-5/visual-qa/pass-1.json",
      ]),
    ).toStrictEqual([]);
  });
});
