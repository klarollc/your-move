import { describe, expect, it } from "vitest";

import {
  appendOnlyViolation,
  artifactsMissingFromLedger,
  isRegeneratedArtifact,
  citedArtifacts,
  currentRecords,
  derivePassSupersessions,
  ledgerEntriesWithoutAFile,
  parseLedger,
  retractedEdges,
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
  it("C-18: names an artifact on disk with no entry, and ignores the ledger itself", () => {
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

  it("C-18: reports a digest that no longer describes the file", () => {
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

  it("C-18: catches a current artifact citing a superseded one", () => {
    const brief = { sources: ["docs/evidence/phase-5/release-review/pass-1.json"] };
    expect(supersededCitations("phase-5/brief.json", brief, entries)).toStrictEqual([
      {
        citedBy: "phase-5/brief.json",
        cited: "phase-5/release-review/pass-1.json",
        supersededBy: "phase-5/release-review/pass-3.json",
      },
    ]);
  });

  it("C-18: allows a later pass to name the passes it replaced", () => {
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

  it("C-18: refuses a rewritten line even when the length is unchanged", () => {
    expect(appendOnlyViolation(first, `${JSON.stringify(record("phase-5/z.json"))}\n`)).toMatch(
      /line 1 was rewritten/u,
    );
  });
});

/**
 * These cases were written against the pre-2026-09-19 signature, when every pass in a directory
 * formed one sequence. They still describe the behaviour *within* a class, so they are kept as
 * written and given a classifier that puts everything in the same one. The class rule itself has
 * its own describe below, where the distinction is the subject rather than a detail.
 */
const derive = (
  files: string[],
  aliases: ReadonlyMap<string, number> = new Map(),
  classOf: (path: string) => string = () => "product",
) => derivePassSupersessions(files, aliases, classOf);

describe("supersession derivation", () => {
  it("C-18: supersedes every pass but the highest, per directory", () => {
    expect(
      derive([
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
    const edges = derive(["phase-5/r/pass-9.json", "phase-5/r/pass-10.json"]);
    expect(edges).toStrictEqual([
      { artifact: "phase-5/r/pass-9.json", supersededBy: "phase-5/r/pass-10.json" },
    ]);
  });

  it("includes an aliased pass written before the convention existed", () => {
    const edges = derive(
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
    expect(derive(["phase-5/only/pass-1.json"])).toStrictEqual([]);
  });

  it("never derives an edge from a supersedes field", () => {
    // amendments.json says "supersedes": ".../surface-contract.json" and does not supersede it.
    // Acting on that field would mark the live contract superseded and forbid every citation of it.
    const edges = derive(["phase-5/surface-contract/amendments.json"]);
    expect(edges).toStrictEqual([]);
    expect(supersededArtifacts([])).toStrictEqual(new Map());
  });

  it("does not cross directories", () => {
    expect(
      derive(["phase-5/verification/pass-2.json", "phase-5/visual-qa/pass-1.json"]),
    ).toStrictEqual([]);
  });
});

describe("a field that holds preserved history", () => {
  const entries = [record("phase-5/old.json"), supersede("phase-5/old.json", "phase-5/new.json")];

  /**
   * P-3 exists so a CURRENT claim cannot rest on a superseded artifact. A field whose declared
   * purpose is to name what is preserved as history makes no current claim, and the scope overlay
   * needs one: the waiver, the disposition and the refusing review passes are exactly what it must
   * point at. The field is named for what it holds rather than borrowing a name that means
   * something else — `amendments.json` already carried a `supersedes` that did not mean
   * supersession, and that was recorded as a defect, not a pattern to copy.
   */
  it("C-18, P-3: a citation inside historyPreserved is not a current claim", () => {
    expect(
      supersededCitations(
        "phase-5/scope.json",
        { historyPreserved: ["phase-5/old.json"] },
        entries,
      ),
    ).toStrictEqual([]);
  });

  /**
   * The anti-blinding half. Widening an exemption is how a guard stops guarding, so the same
   * citation in an ordinary field must still be caught. This passes before the widening too, and is
   * recorded as the mutation check rather than as evidence of the new behaviour.
   */
  it("C-18, P-3: the same citation in an ordinary field is still refused", () => {
    expect(
      supersededCitations("phase-5/scope.json", { seeAlso: ["phase-5/old.json"] }, entries),
    ).toStrictEqual([
      {
        citedBy: "phase-5/scope.json",
        cited: "phase-5/old.json",
        supersededBy: "phase-5/new.json",
      },
    ]);
  });
});

describe("P-6, retracting an edge that should never have been derived", () => {
  const unsupersede = (artifact: string, supersededBy: string): LedgerEntry => ({
    op: "unsupersede",
    artifact,
    supersededBy,
    recordedAt: "2026-09-19T00:00:00.000Z",
    why: "derived from a convention it does not fit",
    authorizedBy: "docs/evidence/phase-5/decision-record-2026-09-19-supersession-retraction.md",
  });

  /**
   * The case this op exists for. Three failed release attempts each superseded everything below
   * them, so the ledger said the current release review was a connection error. Retracting the
   * wrong edge has to restore the earlier correct one, not merely delete the claim — an artifact
   * that drops out of the superseded set entirely is reported as current, which for pass-1 through
   * pass-4 would be a second wrong answer.
   */
  it("C-18, P-6: withdraws the pair and falls back to the earlier correct edge", () => {
    const entries = [
      supersede("phase-5/r/pass-1.json", "phase-5/r/pass-5.json"),
      supersede("phase-5/r/pass-1.json", "phase-5/r/pass-8.json"),
      unsupersede("phase-5/r/pass-1.json", "phase-5/r/pass-8.json"),
    ];
    expect(supersededArtifacts(entries).get("phase-5/r/pass-1.json")).toBe("phase-5/r/pass-5.json");
  });

  /**
   * Pair-keying, stated as a test because the alternative is so much easier to write. A retraction
   * that exempted the artifact would make pass-5 permanently unsupersedable, so a pass-9 that
   * genuinely replaced it could never say so, and the bug would have become a property of the
   * artifact rather than of one derivation.
   */
  // Passed before the change too. Recorded as a mutation check, not as evidence of new
  // behaviour — widening an exemption is how a guard stops guarding.
  it("P-6: is keyed on the pair, so an edge naming another artifact survives", () => {
    const entries = [
      supersede("phase-5/r/pass-1.json", "phase-5/r/pass-5.json"),
      supersede("phase-5/r/pass-1.json", "phase-5/r/pass-8.json"),
      unsupersede("phase-5/r/pass-1.json", "phase-5/r/pass-5.json"),
    ];
    expect(supersededArtifacts(entries).get("phase-5/r/pass-1.json")).toBe("phase-5/r/pass-8.json");
  });

  it("P-6: retracting the only edge leaves the artifact current", () => {
    const entries = [
      supersede("phase-5/r/pass-5.json", "phase-5/r/pass-8.json"),
      unsupersede("phase-5/r/pass-5.json", "phase-5/r/pass-8.json"),
    ];
    expect(supersededArtifacts(entries).has("phase-5/r/pass-5.json")).toBe(false);
  });

  /**
   * A retraction withdraws the edges recorded before it and does not immunise the pair. If the
   * same edge is asserted again afterwards that is a new claim, and a reader that ignored it would
   * be silently overriding the ledger's latest line.
   */
  // Passed before the change too. Recorded as a mutation check, not as evidence of new
  // behaviour — widening an exemption is how a guard stops guarding.
  it("P-6: a later edge naming the same pair is a new claim, not a retracted one", () => {
    const entries = [
      supersede("phase-5/r/a.json", "phase-5/r/b.json"),
      unsupersede("phase-5/r/a.json", "phase-5/r/b.json"),
      supersede("phase-5/r/a.json", "phase-5/r/b.json"),
    ];
    expect(supersededArtifacts(entries).get("phase-5/r/a.json")).toBe("phase-5/r/b.json");
  });

  /**
   * P-6's reach, asserted rather than asserted-in-prose. The danger in adding a retraction op to an
   * append-only ledger is that it becomes a general edit mechanism, so the claim that it touches
   * exactly one supersede pair and no record entry is the thing that has to be falsifiable.
   */
  // Passed before the change too. Recorded as a mutation check, not as evidence of new
  // behaviour — widening an exemption is how a guard stops guarding.
  it("P-6: changes no record entry", () => {
    const records = [
      record("phase-5/r/pass-1.json", "1".repeat(64)),
      record("phase-5/r/pass-8.json", "8".repeat(64)),
    ];
    const before = currentRecords([
      ...records,
      supersede("phase-5/r/pass-1.json", "phase-5/r/pass-8.json"),
    ]);
    const after = currentRecords([
      ...records,
      supersede("phase-5/r/pass-1.json", "phase-5/r/pass-8.json"),
      unsupersede("phase-5/r/pass-1.json", "phase-5/r/pass-8.json"),
    ]);
    expect(after).toStrictEqual(before);
  });

  it("P-6: refuses a retraction with no authorising decision record", () => {
    const { entries, refusals } = parseLedger(
      JSON.stringify({
        op: "unsupersede",
        artifact: "phase-5/r/a.json",
        supersededBy: "phase-5/r/b.json",
        recordedAt: "2026-09-19T00:00:00.000Z",
        why: "no authority",
      }),
    );
    expect(entries).toStrictEqual([]);
    expect(refusals).toStrictEqual([
      "line 1: unsupersede entry without an authorising decision record",
    ]);
  });

  it("P-6: refuses a retraction missing an end of the edge", () => {
    const { refusals } = parseLedger(
      JSON.stringify({ op: "unsupersede", artifact: "phase-5/r/a.json" }),
    );
    expect(refusals).toStrictEqual(["line 1: unsupersede entry without both ends of the edge"]);
  });

  it("parses a well-formed retraction", () => {
    const { entries, refusals } = parseLedger(
      JSON.stringify(unsupersede("phase-5/r/a.json", "phase-5/r/b.json")),
    );
    expect(refusals).toStrictEqual([]);
    expect(entries).toHaveLength(1);
  });
});

describe("supersession applies within a class", () => {
  // Release review, 2026-09-18: passes 6, 7 and 8 each carry verdict null after a failed turn.
  const classOf = (path: string) => (/pass-[678]\.json$/u.test(path) ? "verdictless" : "product");

  /**
   * The defect, as a test. Ordering a failed attempt alongside the passes that produced verdicts
   * made a connection error the current release review — and P-3 then forbade every honest
   * citation of the verdict that was actually current.
   */
  it("C-18: a verdictless pass never retires a pass that carries a verdict", () => {
    const files = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `phase-5/release-review/pass-${n}.json`);
    const edges = derivePassSupersessions(files, new Map(), classOf);

    expect(edges).toStrictEqual([
      ...[1, 2, 3, 4].map((n) => ({
        artifact: `phase-5/release-review/pass-${n}.json`,
        supersededBy: "phase-5/release-review/pass-5.json",
      })),
      ...[6, 7].map((n) => ({
        artifact: `phase-5/release-review/pass-${n}.json`,
        supersededBy: "phase-5/release-review/pass-8.json",
      })),
    ]);
  });

  it("leaves a class with one member alone", () => {
    const edges = derivePassSupersessions(
      ["phase-5/r/pass-1.json", "phase-5/r/pass-2.json"],
      new Map(),
      (path) => (path.endsWith("pass-2.json") ? "verdictless" : "product"),
    );
    expect(edges).toStrictEqual([]);
  });

  it("orders an aliased pass inside its own class", () => {
    const edges = derivePassSupersessions(
      [
        "phase-5/verification/verification.json",
        "phase-5/verification/pass-2.json",
        "phase-5/verification/pass-3.json",
      ],
      new Map([["phase-5/verification/verification.json", 1]]),
      (path) => (path.endsWith("pass-3.json") ? "verdictless" : "product"),
    );
    expect(edges).toStrictEqual([
      {
        artifact: "phase-5/verification/verification.json",
        supersededBy: "phase-5/verification/pass-2.json",
      },
    ]);
  });
});

describe("retracted pairs, reported to the builder", () => {
  const unsupersede = (artifact: string, supersededBy: string): LedgerEntry => ({
    op: "unsupersede",
    artifact,
    supersededBy,
    recordedAt: "2026-09-19T00:00:00.000Z",
    why: "derived from a convention it does not fit",
    authorizedBy: "docs/evidence/phase-5/decision-record-2026-09-19-supersession-retraction.md",
  });

  it("P-6: names a pair a retraction currently holds withdrawn", () => {
    expect([
      ...retractedEdges([
        supersede("phase-5/r/a.json", "phase-5/r/b.json"),
        unsupersede("phase-5/r/a.json", "phase-5/r/b.json"),
      ]),
    ]).toStrictEqual(["phase-5/r/a.json\u0000phase-5/r/b.json"]);
  });

  /**
   * A pair asserted again after its retraction is not withdrawn any more. Reporting it as retracted
   * would make the builder refuse an edge the ledger's own latest line asks for.
   */
  it("P-6: a pair re-asserted after its retraction is not withdrawn", () => {
    expect([
      ...retractedEdges([
        supersede("phase-5/r/a.json", "phase-5/r/b.json"),
        unsupersede("phase-5/r/a.json", "phase-5/r/b.json"),
        supersede("phase-5/r/a.json", "phase-5/r/b.json"),
      ]),
    ]).toStrictEqual([]);
  });
});

describe("regenerated evidence", () => {
  it("excludes the git-ignored rehearsal transcript but not committed workflow evidence", () => {
    expect(isRegeneratedArtifact("workflow/rehearsal/rehearsal.md")).toBe(true);
    expect(isRegeneratedArtifact("workflow\\rehearsal\\rehearsal.md")).toBe(true);
    expect(isRegeneratedArtifact("workflow/attempts.json")).toBe(false);
    expect(isRegeneratedArtifact("workflow/transcripts/a.json")).toBe(false);
    expect(isRegeneratedArtifact("phase-5/rehearsal/x.md")).toBe(false);
  });
});
