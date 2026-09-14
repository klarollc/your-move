import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildAuthoredManifest } from "./promote-authored-roles.mjs";
import { promotedRoleIds, readPromotionRecord } from "./promote-roles.mjs";

/**
 * Reports which roles are promoted right now.
 *
 * The join is against `roles/authored`, because that is where the artifacts a role actually runs
 * under live (Decision Q2). The previous status command joined against `roles/manifest.json` — the
 * imported set that Decision Q1 marked superseded — so it reported an empty promoted set while all
 * six authored roles were promoted. A status command that says a gate is closed while it is open is
 * worse than none, so this one also names the source it derived from.
 *
 * `manifestOverride` exists for tests that need to prove the drift path; nothing else supplies it.
 */
export async function readPromotedStatus(rolesRoot, options = {}) {
  const manifest =
    options.manifestOverride ??
    (await buildAuthoredManifest({
      authoredDirectory: resolve(rolesRoot, "authored"),
      commit: null,
    }));
  const record = await readPromotionRecord(resolve(rolesRoot, "promotions.json"));

  return {
    ok: true,
    source: "roles/authored",
    promoted: promotedRoleIds(record, manifest),
    of: manifest.roles.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rolesRoot = resolve(process.argv[2] ?? "roles");
  console.log(JSON.stringify(await readPromotedStatus(rolesRoot)));
}
