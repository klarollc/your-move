import { describe, expect, it } from "vitest";

import {
  checkReview,
  composeSideEffectReview,
  importSpecifiers,
  resolveSpecifier,
  scanModule,
  stripComments,
} from "./phase5-side-effect-review.js";

/**
 * C-11's static half, tested in both directions.
 *
 * Every failure this scan can have is silent. A resolver that resolves nothing walks a graph of one
 * module and reports it clean; a pattern that never matches reports the same thing; and a scan that
 * fires on its own documentation gets narrowed until it matches nothing. Two of those three
 * happened while this was being written, and both produced a passing, clean, wrong artifact.
 */

const workspaces = new Map([["@cuckcode/domain", "packages/domain/src/index.ts"]]);

describe("import discovery", () => {
  it("C-11: finds a specifier in a multi-line named-import block", () => {
    // The component opens with an eighteen-line import. A pattern that could not cross a newline
    // missed it, and the whole graph collapsed to three modules with a clean result.
    const source = `import {\n  a,\n  b,\n  type C,\n} from "@cuckcode/domain";\n`;
    expect(importSpecifiers(source)).toStrictEqual(["@cuckcode/domain"]);
  });

  it("C-11: finds side-effect imports, re-exports and single-line imports", () => {
    const source = [
      `import "./decision-notice.css";`,
      `import { useState } from "react";`,
      `export { thing } from "./thing.js";`,
    ].join("\n");
    expect(importSpecifiers(source).sort()).toStrictEqual([
      "./decision-notice.css",
      "./thing.js",
      "react",
    ]);
  });
});

describe("specifier resolution", () => {
  it("C-11: offers a .tsx candidate for a NodeNext .js specifier", () => {
    // `./decision-notice.js` is a `.tsx` file. Rewriting `.js` to `.ts` and stopping dropped the
    // component out of its own import graph.
    const resolved = resolveSpecifier(
      "apps/web/src/capture.tsx",
      "./decision-notice.js",
      workspaces,
    );
    expect(resolved.kind).toBe("internal");
    expect(resolved.kind === "internal" && resolved.candidates).toContain(
      "apps/web/src/decision-notice.tsx",
    );
  });

  it("C-11: resolves a workspace package to its declared source entry", () => {
    const resolved = resolveSpecifier("apps/web/src/a.tsx", "@cuckcode/domain", workspaces);
    expect(resolved.kind === "internal" && resolved.candidates).toStrictEqual([
      "packages/domain/src/index.ts",
    ]);
  });

  it("C-11: reports an unknown package as external rather than dropping it", () => {
    // An unresolved import that vanished silently would shrink the graph and the claim with it.
    expect(resolveSpecifier("a.ts", "zod", workspaces)).toStrictEqual({
      kind: "external",
      specifier: "zod",
    });
  });

  it("C-11: treats a stylesheet as an asset, not as a module or a package", () => {
    expect(resolveSpecifier("a.tsx", "./x.css", workspaces)).toStrictEqual({ kind: "asset" });
  });
});

describe("the scan", () => {
  it("C-11: finds a network call and names its category and line", () => {
    const scan = scanModule("m.ts", `const a = 1;\nawait fetch("https://example.test");\n`);
    expect(scan.hits).toStrictEqual([
      {
        category: "network",
        name: "fetch",
        line: 2,
        text: 'await fetch("https://example.test");',
      },
    ]);
  });

  it("C-11: finds each of the five categories the criterion names", () => {
    const source = [
      `fetch("/x");`,
      `document.cookie = "a";`,
      `execSync("deploy");`,
      `deleteDatabase("d");`,
      `const s = stripe;`,
    ].join("\n");
    expect(
      [...new Set(scanModule("m.ts", source).hits.map((hit) => hit.category))].sort(),
    ).toStrictEqual(["credential", "deployment", "destructive", "network", "paid"]);
  });

  it("C-11: does not fire on prose in a comment", () => {
    // This repository documents its own guards in prose. The isolation spec's doc comment names
    // `fetch`; so does the review script. A scan that fired on documentation would be narrowed
    // until it found nothing, which is how a guard dies quietly.
    const source = [
      `/**`,
      ` * The isolation step injects fetch("https://forbidden.invalid") and document.cookie.`,
      ` */`,
      `// stripe and execSync are named here on purpose`,
      `const clean = 1;`,
    ].join("\n");
    expect(scanModule("m.ts", source).hits).toStrictEqual([]);
  });

  it("C-11: keeps line numbers correct after stripping a block comment", () => {
    // Comments are blanked rather than removed, so a hit's line still points at the real line.
    const source = `/* one\n   two\n   three */\nfetch("/x");\n`;
    expect(stripComments(source).split("\n")).toHaveLength(5);
    expect(scanModule("m.ts", source).hits[0]?.line).toBe(4);
  });

  it("C-11: does not mistake a URL in a string for a comment", () => {
    expect(
      scanModule("m.ts", `const u = "https://example.test/a";\nfetch(u);\n`).hits,
    ).toHaveLength(1);
  });
});

describe("the review projection", () => {
  const input = {
    entryPoints: ["apps/web/src/decision-notice.tsx"],
    entryPointsWhy: "the declared entry point",
    reachable: {
      modules: ["apps/web/src/decision-notice.tsx"],
      external: ["react"],
      unreadable: [],
      assets: [],
    },
    scans: [scanModule("apps/web/src/decision-notice.tsx", "const a = 1;")],
  };

  /**
   * DF-018. The gate cannot pass twice in a row: `phase5:provenance` checks the ledger at stage 16
   * and `phase5:sideeffects` rewrites this artifact at stage 17, so a wall-clock field in the
   * digested body guarantees the next run fails on a stale digest. The property that matters is not
   * that one named key is absent; it is that the same inputs produce the same bytes. Asserted
   * across a clock tick, because a same-millisecond comparison would pass on the broken version.
   */
  it("C-11, DF-018: the same inputs produce the same bytes across a clock tick", async () => {
    const first = JSON.stringify(composeSideEffectReview(input), null, 2);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = JSON.stringify(composeSideEffectReview(input), null, 2);
    expect(second).toBe(first);
  });

  it("C-11: the projection still reports the scan it was given", () => {
    const review = composeSideEffectReview({
      ...input,
      scans: [scanModule("m.ts", "await fetch(url);")],
    });
    expect(review.ok).toBe(false);
    expect(review.findings.network).toEqual(["m.ts:1 fetch"]);
  });
});

describe("the gate reads the artifact rather than rewriting it", () => {
  /**
   * DF-018 again, at the root. A stage that rewrites committed evidence on every run is only
   * idempotent by luck; a stage that reads it and refuses is idempotent by construction. This is
   * also the rule the repository already states for browser captures and does not enforce for
   * scripts: evidence-immutability.test.mjs polices specs, not builders.
   */
  it("C-11, DF-018: an artifact matching a fresh render is current", () => {
    expect(checkReview("same bytes\n", "same bytes\n")).toEqual({
      ok: true,
      reason: "CURRENT",
    });
  });

  it("C-11, DF-018: an artifact that has drifted is refused, not rewritten", () => {
    expect(checkReview("fresh\n", "older\n")).toEqual({ ok: false, reason: "STALE" });
  });

  it("C-11, DF-018: a missing artifact is refused by its own reason", () => {
    expect(checkReview("fresh\n", null)).toEqual({ ok: false, reason: "MISSING" });
  });
});
