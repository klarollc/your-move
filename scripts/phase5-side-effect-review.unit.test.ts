import { describe, expect, it } from "vitest";

import {
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
