import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { checkBindingPreconditions, contractVersionOf } from "@cuckcode/domain";

import { checkCodexDrift, installedDriftDependencies } from "./codex-drift.js";

/**
 * The Task 17 preflight, computed from the records on disk without spending a provider turn.
 *
 * The approved allowance is exactly one bounded live kickoff. Discovering a preflight failure by
 * consuming that allowance would be the most expensive way to learn it, so every precondition that
 * can be checked without a provider call is checked here first.
 *
 * The qualification for each role is its performed bounded exercise. That is the honest source: an
 * exercise is evidence that *this* contract version ran under *these* constraints, which is exactly
 * what a qualification asserts. Nothing is invented to satisfy the join.
 */
const ROOT = resolve(process.cwd());
const ROLES_ROOT = resolve(ROOT, "roles");

/** D-25 requires the six named roles and six distinct identities. */
const ROLE_IDS = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
] as const;

/** The packet's freshness bound on a qualification, in milliseconds. */
export const MAX_QUALIFICATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type KickoffPreflightInput = {
  promoted: Array<{ roleId: string; contentSha256: string }>;
  bindings: Array<{
    roleId: string;
    agentId: string;
    bindingId: string;
    qualified: boolean;
    roleContractVersion: string;
    evaluatedAt: number;
    exceptionExpiries: number[];
  }>;
};

const sha256 = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");

export const agentIdFor = (roleId: string): string => `agent_${roleId.replace(/-/gu, "_")}`;

export async function buildKickoffPreflightInput(): Promise<KickoffPreflightInput> {
  const promotions = JSON.parse(await readFile(resolve(ROLES_ROOT, "promotions.json"), "utf8")) as {
    promotions: Array<{ roleId: string; contentSha256: string; revokedAt: string | null }>;
  };

  const exercises = JSON.parse(await readFile(resolve(ROLES_ROOT, "exercises.json"), "utf8")) as {
    exercises: Array<{
      roleId: string;
      contentSha256: string;
      performed: boolean;
      attempts?: Array<{ observedAt: string; performed: boolean }>;
    }>;
  };

  const promoted = promotions.promotions
    .filter((entry) => entry.revokedAt === null)
    .map((entry) => ({ roleId: entry.roleId, contentSha256: entry.contentSha256 }));

  const bindings = [];
  for (const roleId of ROLE_IDS) {
    const exercise = exercises.exercises.find((entry) => entry.roleId === roleId);
    const artifact = await readFile(resolve(ROLES_ROOT, "authored", `${roleId}.json`));
    const onDisk = sha256(artifact);

    // The qualification is evaluated against whatever the exercise actually ran, not against
    // whatever is on disk now. If the artifact has changed since, the version join must fail.
    const performedAttempt = [...(exercise?.attempts ?? [])]
      .reverse()
      .find((attempt) => attempt.performed);

    bindings.push({
      roleId,
      agentId: agentIdFor(roleId),
      bindingId: `binding_${roleId.replace(/-/gu, "_")}`,
      qualified: exercise?.performed === true,
      roleContractVersion: `content:${exercise?.contentSha256 ?? onDisk}`,
      evaluatedAt: performedAttempt ? Date.parse(performedAttempt.observedAt) : 0,
      exceptionExpiries: [] as number[],
    });
  }

  return { promoted, bindings };
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/gu, "/").split("/").pop() ?? "")
) {
  const now = Date.now();
  const drift = await checkCodexDrift(installedDriftDependencies());
  const input = await buildKickoffPreflightInput();
  const result = checkBindingPreconditions({
    bindings: input.bindings,
    promoted: input.promoted,
    now,
    maxQualificationAgeMs: MAX_QUALIFICATION_AGE_MS,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: result.ok && drift.ok,
        codex: drift,
        roles: input.bindings.length,
        distinctAgents: new Set(input.bindings.map((entry) => entry.agentId)).size,
        promotedContracts: input.promoted.length,
        contractVersions: input.promoted.map((contract) => ({
          roleId: contract.roleId,
          version: contractVersionOf(contract).slice(0, 24),
        })),
        ...(result.ok ? {} : { failures: result.failures }),
      },
      null,
      2,
    )}\n`,
  );
  if (!result.ok || !drift.ok) process.exitCode = 1;
}
