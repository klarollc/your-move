import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { AUTHORITY_DISCLOSURES, composeRole, type RoleBrief } from "@cuckcode/domain";

const AUTHORED = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../roles/authored");

/** D-16 fixes these six. A seventh file, or a missing one, is a roster defect. */
const REQUIRED_ROLE_IDS = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
] as const;

const SCHEMA_FIELDS = [
  "roleId",
  "mandate",
  "context",
  "standards",
  "evidence",
  "refusals",
  "boundaries",
] as const;

async function readBrief(roleId: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(AUTHORED, `${roleId}.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("authored role artifacts", () => {
  it("holds exactly the six roles D-16 requires, and nothing else", async () => {
    const files = (await readdir(AUTHORED)).filter((name) => name.endsWith(".json")).sort();
    expect(files).toStrictEqual([...REQUIRED_ROLE_IDS].sort().map((id) => `${id}.json`));
  });

  it("composes every authored role without refusal", async () => {
    for (const roleId of REQUIRED_ROLE_IDS) {
      const result = composeRole((await readBrief(roleId)) as unknown as RoleBrief);
      expect(result.ok, `${roleId}: ${result.ok ? "" : result.refusal.detail}`).toBe(true);
    }
  });

  it("names the role it is filed under, so a renamed file cannot silently change identity", async () => {
    for (const roleId of REQUIRED_ROLE_IDS) {
      expect((await readBrief(roleId)).roleId).toBe(roleId);
    }
  });

  it("carries no field outside the schema", async () => {
    // composeRole ignores keys it does not know, so a typo'd field name would be dropped in
    // silence. The artifacts are checked here rather than trusted to the composer.
    for (const roleId of REQUIRED_ROLE_IDS) {
      const extra = Object.keys(await readBrief(roleId)).filter(
        (key) => !(SCHEMA_FIELDS as readonly string[]).includes(key),
      );
      expect(extra, `${roleId} carries unknown field(s)`).toStrictEqual([]);
    }
  });

  it("carries the three authority disclosures verbatim in every role", async () => {
    for (const roleId of REQUIRED_ROLE_IDS) {
      expect(await readBrief(roleId)).toMatchObject({ boundaries: [...AUTHORITY_DISCLOSURES] });
    }
  });

  it("composes deterministically across separate reads of the same file", async () => {
    for (const roleId of REQUIRED_ROLE_IDS) {
      const once = composeRole((await readBrief(roleId)) as unknown as RoleBrief);
      const twice = composeRole((await readBrief(roleId)) as unknown as RoleBrief);
      if (!once.ok || !twice.ok) throw new Error(`${roleId} did not compose`);
      expect(once.text).toContain(roleId);
      expect(once.text).toBe(twice.text);
    }
  });

  it("gives each role a distinct composed instruction, ignoring its name", async () => {
    // The point of six roles is six perspectives. Two roles composing to the same substance would
    // mean the kickoff runs identical agents under different names — the exact failure D-25 exists
    // to prevent.
    //
    // The role name is stripped before comparing. Comparing whole texts would let two briefs with
    // identical mandate, standards, evidence and refusals pass as distinct purely because they are
    // filed under different names, which is the defect this test exists to catch rather than one it
    // may tolerate. Verified by mutation: copying one role's substance under another's name passes
    // a whole-text comparison and fails this one.
    const substance = new Map<string, string>();
    for (const roleId of REQUIRED_ROLE_IDS) {
      const result = composeRole((await readBrief(roleId)) as unknown as RoleBrief);
      if (!result.ok) throw new Error(`${roleId} did not compose`);

      const withoutName = result.text.split("\n").filter((line) => line !== roleId).join("\n");
      const duplicate = [...substance].find(([, text]) => text === withoutName);
      expect(duplicate?.[0], `${roleId} composes to the same substance as ${duplicate?.[0]}`).toBe(
        undefined,
      );
      substance.set(roleId, withoutName);
    }
    expect(substance.size).toBe(REQUIRED_ROLE_IDS.length);
  });
});
