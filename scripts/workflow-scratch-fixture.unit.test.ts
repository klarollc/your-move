import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { executeWorkCommand } from "@cuckcode/application";
import type { PostureRecord } from "@cuckcode/contracts";
import { workContractSchema } from "@cuckcode/contracts";
import { checkReadiness } from "@cuckcode/domain";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Guards the workflow-proof scratch repo and its two contract versions (W11): the seed files are
 * the bytes the contract digests, the test is RED on the stub and GREEN on the reference, the two
 * contracts differ only in the seeded ambiguity, and the contract is acceptable to the work
 * command and to the readiness check. Fixtures are read from the repository, never from a worktree.
 */
const ROOT = resolve(import.meta.dirname, "..");
const FIXTURES = join(ROOT, "workflow-proof-seed");
const SEED = join(FIXTURES, "slugify-proof");
const REFERENCE = join(FIXTURES, "slugify-reference/slugify.js");
const INLINED = ["src/slugify.js", "test/slugify.test.js"];

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const contract = (name: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, "contracts", `${name}.json`), "utf8"));

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? listFiles(join(dir, entry.name))
        : [relative(SEED, join(dir, entry.name)).split("\\").join("/")],
    )
    .sort();

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const copySeed = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "cuckcode-seed-"));
  scratch.push(dir);
  cpSync(SEED, dir, { recursive: true });
  return dir;
};
const runTests = (cwd: string): { ok: boolean; output: string } => {
  try {
    const output = execFileSync(process.execPath, ["--test", "--test-reporter=tap"], {
      cwd,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output };
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${failed.stdout ?? ""}${failed.stderr ?? ""}` };
  }
};

const posture = {
  schemaVersion: 1,
  requested: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  granted: {
    type: "workspaceWrite",
    networkAccess: false,
    approvalPolicy: "never",
    multiAgentMode: "explicitRequestOnly",
  },
  declared: {
    kind: "declared",
    read: "no",
    write: "possible",
    run: "no",
    basis: ["x"],
    observed: null,
  },
  match: true,
  differences: [],
} as unknown as PostureRecord;

describe("the scratch repo seed", () => {
  it("holds exactly the files the role can be given, with no VCS metadata and no reference solution", () => {
    expect(listFiles(SEED)).toEqual([
      ".gitattributes",
      "package.json",
      "src/slugify.js",
      "test/slugify.test.js",
    ]);
    expect(statSync(REFERENCE).isFile()).toBe(true);
  });

  it("is stored byte for byte: LF only, and git is told never to convert", () => {
    for (const file of listFiles(SEED)) {
      expect(readFileSync(join(SEED, file), "utf8"), file).not.toContain("\r");
    }
    expect(readFileSync(join(SEED, ".gitattributes"), "utf8")).toBe("* -text\n");
  });

  it("is RED on the stub and GREEN on the reference solution", () => {
    const red = runTests(copySeed());
    expect(red.ok).toBe(false);
    expect(red.output).toContain("not ok");

    const dir = copySeed();
    cpSync(REFERENCE, join(dir, "src/slugify.js"));
    const green = runTests(dir);
    expect(green.ok, green.output).toBe(true);
    expect(green.output).toMatch(/# fail 0/u);
  });

  it("leaves the length unspecified in the test, so the contract's ambiguity is not answered there", () => {
    const text = readFileSync(join(SEED, "test/slugify.test.js"), "utf8");
    const asserted = text.split("\n").filter((line) => line.includes("assert."));
    const literals = asserted.flatMap((line) =>
      [...line.matchAll(/"([^"\n]*)"/gu)].map((m) => m[1] ?? ""),
    );
    expect(literals.length).toBeGreaterThan(0);
    expect(Math.max(...literals.map((l) => l.length))).toBeLessThanOrEqual(40);
    expect(text.toLowerCase()).not.toMatch(/length|truncat|max/u);
  });
});

describe("the two contract versions", () => {
  const names = ["slugify-v1", "slugify-v2"] as const;

  it.each(names)("%s is a valid work contract that digests the seed files", (name) => {
    const parsed = workContractSchema.safeParse(contract(name));
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.contextRefs).toEqual(
      INLINED.map((path) => ({ path, sha256: sha256(join(SEED, path)) })),
    );
    expect(parsed.data.permissionCeiling).toEqual({
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      networkAccess: false,
      windowsSandbox: "unelevated",
    });
    expect(parsed.data.evidenceObligations.map((o) => o.kind)).toEqual(["test-run", "diff-review"]);
  });

  it("differ only in the length criterion: v1 leaves it open, v2 states the rule", () => {
    const v1 = workContractSchema.parse(contract("slugify-v1"));
    const v2 = workContractSchema.parse(contract("slugify-v2"));
    const lengthAt = v1.acceptanceCriteria.findIndex((c) => c.includes("length suitable"));
    expect(lengthAt).toBeGreaterThanOrEqual(0);
    expect(v1.acceptanceCriteria[lengthAt]).not.toMatch(/\d/u);
    expect(v2.acceptanceCriteria[lengthAt]).toContain("60");
    const strip = (c: typeof v1) => ({
      ...c,
      acceptanceCriteria: c.acceptanceCriteria.filter((_, i) => i !== lengthAt),
    });
    expect(strip(v2)).toEqual(strip(v1));
  });

  it.each(names)("%s is accepted for new work when given an explicit turn cap", (name) => {
    const at = "2026-10-04T10:00:00.000Z";
    const staffing = [
      {
        schemaVersion: 1,
        eventId: "event_a",
        projectId: "project_alpha",
        kind: "agent.registered",
        occurredAt: at,
        receivedAt: at,
        source: "system",
        trust: "verified",
        payload: { agentId: "agent_engineer", capabilities: ["engineer"], health: "connected" },
      },
      {
        schemaVersion: 1,
        eventId: "event_b",
        projectId: "project_alpha",
        kind: "role.assigned",
        occurredAt: at,
        receivedAt: at,
        source: "system",
        trust: "verified",
        payload: {
          roleAssignmentId: "role-assignment_engineer",
          roleId: "engineer",
          agentId: "agent_engineer",
          requiredCapabilities: ["engineer"],
        },
      },
    ];
    const actor = { actorType: "manager" as const, actorId: "manager_nate" };
    const created = executeWorkCommand({
      log: staffing,
      currentRevision: 2,
      now: at,
      command: {
        commandId: "c1",
        projectId: "project_alpha",
        expectedRevision: 2,
        actor,
        intent: "create",
        workItemId: "work_slug",
        contract: { ...(contract(name) as Record<string, unknown>), maxTurns: 3 } as never,
      },
    });
    expect(created.ok).toBe(true);
  });

  it("passes the readiness check when the runner is told the two inlined files, and blocks on any other", () => {
    const parsed = workContractSchema.parse(contract("slugify-v1"));
    expect(checkReadiness({ contract: parsed, posture, neededPaths: INLINED })).toMatchObject({
      ok: true,
    });
    expect(
      checkReadiness({ contract: parsed, posture, neededPaths: [...INLINED, "package.json"] }),
    ).toMatchObject({ ok: false, code: "BLOCKED_CANNOT_READ" });
  });
});
