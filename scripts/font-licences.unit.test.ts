import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Phase 7 Task 1 (spec F-5: "vendor them locally, and record licenses"). The vendored licence
 * texts are the installed packages' own, byte for byte, and they belong to the pinned version.
 */
const ROOT = resolve(import.meta.dirname, "..");
const FONTS = ["fira-sans", "fira-mono"] as const;

describe("vendored font licences", async () => {
  const web = JSON.parse(await readFile(resolve(ROOT, "apps/web/package.json"), "utf8")) as {
    dependencies: Record<string, string>;
  };

  it.each(FONTS)(
    "%s: pinned exactly, licence text identical to the installed package",
    async (font) => {
      const name = `@fontsource/${font}`;
      const pin = web.dependencies[name];
      expect(pin, `${name} is not a web dependency`).toMatch(/^\d+\.\d+\.\d+$/u);
      const installed = JSON.parse(
        await readFile(resolve(ROOT, "node_modules", name, "package.json"), "utf8"),
      ) as { version: string; license: string };
      expect(installed.version).toBe(pin);
      expect(installed.license).toBe("OFL-1.1");
      const vendored = await readFile(resolve(ROOT, `licenses/fonts/${font}-${pin}-OFL.txt`));
      const shipped = await readFile(resolve(ROOT, "node_modules", name, "LICENSE"));
      expect(vendored.equals(shipped)).toBe(true);
    },
  );
});
