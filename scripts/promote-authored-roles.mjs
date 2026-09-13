import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  emptyPromotionRecord,
  planPromotion,
  readPromotionRecord,
  writePromotionRecord,
} from "./promote-roles.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

/** Reads the authored artifacts as bytes. The promotion request must match this result exactly. */
export async function buildAuthoredManifest({ authoredDirectory, commit }) {
  const entries = await readdir(authoredDirectory, { withFileTypes: true });
  const roles = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const content = await readFile(resolve(authoredDirectory, entry.name));
        const parsed = JSON.parse(content.toString("utf8"));
        if (typeof parsed.roleId !== "string" || parsed.roleId.length === 0) {
          throw new Error("AUTHORED_ROLE_INVALID");
        }
        return { roleId: parsed.roleId, contentSha256: sha256(content) };
      }),
  );
  roles.sort((left, right) => left.roleId.localeCompare(right.roleId));
  return { commit, roles };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rolesRoot = resolve(process.argv[2] ?? "roles");
  const request = JSON.parse(await readFile(resolve(rolesRoot, "promotion-request.json"), "utf8"));
  if (
    request.schema !== "cuckcode.role-promotion-request.v1" ||
    request.ownerExecutionRequired !== true ||
    typeof request.artifactCommit !== "string" ||
    !Array.isArray(request.targets)
  ) {
    throw new Error("PROMOTION_REQUEST_INVALID");
  }
  const manifest = await buildAuthoredManifest({
    authoredDirectory: resolve(rolesRoot, "authored"),
    commit: request.artifactCommit,
  });
  const exerciseRecord = JSON.parse(await readFile(resolve(rolesRoot, "exercises.json"), "utf8"));
  const recordPath = resolve(rolesRoot, "promotions.json");
  const plan = planPromotion({
    manifest,
    requested: request.targets,
    record: await readPromotionRecord(recordPath),
    now: new Date().toISOString(),
    packetRef: request.packetRef,
    exerciseRecord,
  });

  if (!plan.ok) {
    console.error(JSON.stringify(plan));
    process.exitCode = 1;
  } else if (process.env.CUCKCODE_OWNER_PROMOTION !== "1") {
    console.error(JSON.stringify({ ok: false, code: "OWNER_EXECUTION_REQUIRED" }));
    process.exitCode = 1;
  } else {
    await writePromotionRecord(recordPath, plan.record ?? emptyPromotionRecord());
    console.log(
      JSON.stringify({ ok: true, promoted: plan.record.promotions.map((entry) => entry.roleId) }),
    );
  }
}
