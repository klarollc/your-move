import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PROMOTION_SCHEMA = "cuckcode.role-promotion.v1";

export function emptyPromotionRecord() {
  return { schema: PROMOTION_SCHEMA, promotions: [] };
}

/**
 * Promotion is all-or-nothing. The owner approves a set of exact contract versions; a request
 * that omits a role, names an unknown one, or carries a digest the manifest does not hold is
 * refused whole. Partial promotion would leave some roles executable under an approval that was
 * never given for that combination.
 */
export function planPromotion({ manifest, requested, record, now, packetRef }) {
  const known = new Map(manifest.roles.map((role) => [role.roleId, role]));

  for (const entry of requested) {
    if (!known.has(entry.roleId)) {
      return { ok: false, code: "ROLE_NOT_IN_MANIFEST", roleId: entry.roleId };
    }
  }

  const requestedIds = new Set(requested.map((entry) => entry.roleId));
  if (requestedIds.size !== known.size) {
    return { ok: false, code: "PROMOTION_INCOMPLETE" };
  }

  const drifted = requested
    .filter((entry) => {
      const role = known.get(entry.roleId);
      return role.sourceSha256 !== entry.sourceSha256 || role.overlaySha256 !== entry.overlaySha256;
    })
    .map((entry) => entry.roleId);

  if (drifted.length > 0) {
    return { ok: false, code: "PROMOTION_DRIFT", drifted };
  }

  const byRole = new Map(record.promotions.map((entry) => [entry.roleId, entry]));
  const promotions = manifest.roles.map((role) => {
    const existing = byRole.get(role.roleId);
    // Re-approving an unchanged, live promotion does not rewrite when it happened.
    if (existing && existing.revokedAt === null && digestsMatch(existing, role)) {
      return existing;
    }
    return {
      roleId: role.roleId,
      sourceSha256: role.sourceSha256,
      overlaySha256: role.overlaySha256,
      commit: manifest.commit,
      promotedAt: now,
      packetRef,
      revokedAt: null,
    };
  });

  return { ok: true, record: { schema: PROMOTION_SCHEMA, promotions } };
}

/**
 * Promotion lasts until revoked, so revocation is the only way back and it must say why.
 */
export function planRevocation({ record, roleIds, now, reason }) {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return { ok: false, code: "REVOCATION_REASON_REQUIRED" };
  }

  const live = new Set(
    record.promotions.filter((entry) => entry.revokedAt === null).map((entry) => entry.roleId),
  );
  for (const roleId of roleIds) {
    if (!live.has(roleId)) return { ok: false, code: "NOT_PROMOTED", roleId };
  }

  const targets = new Set(roleIds);
  return {
    ok: true,
    record: {
      schema: PROMOTION_SCHEMA,
      promotions: record.promotions.map((entry) =>
        targets.has(entry.roleId) && entry.revokedAt === null
          ? { ...entry, revokedAt: now, revokedReason: reason.trim() }
          : entry,
      ),
    },
  };
}

/**
 * The promoted set is derived, never asserted. A role counts as promoted only while the manifest
 * still holds the exact digests that were approved: a contract version that changed after
 * promotion is not the version the owner promoted, and nothing should have to remember to revoke
 * it. Fails closed.
 */
export function promotedRoleIds(record, manifest) {
  const known = new Map(manifest.roles.map((role) => [role.roleId, role]));
  return record.promotions
    .filter((entry) => entry.revokedAt === null)
    .filter((entry) => {
      const role = known.get(entry.roleId);
      return role !== undefined && digestsMatch(entry, role);
    })
    .map((entry) => entry.roleId);
}

function digestsMatch(left, right) {
  return left.sourceSha256 === right.sourceSha256 && left.overlaySha256 === right.overlaySha256;
}

export async function readPromotionRecord(path) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (parsed.schema !== PROMOTION_SCHEMA || !Array.isArray(parsed.promotions)) {
      return emptyPromotionRecord();
    }
    return parsed;
  } catch {
    return emptyPromotionRecord();
  }
}

export async function writePromotionRecord(path, record) {
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rolesRoot = resolve(process.argv[2] ?? "roles");
  const manifest = JSON.parse(await readFile(resolve(rolesRoot, "manifest.json"), "utf8"));
  const record = await readPromotionRecord(resolve(rolesRoot, "promotions.json"));
  console.log(
    JSON.stringify({
      ok: true,
      promoted: promotedRoleIds(record, manifest),
      of: manifest.roles.length,
    }),
  );
}
