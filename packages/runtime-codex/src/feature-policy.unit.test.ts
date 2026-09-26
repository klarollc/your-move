import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CODEX_PIN } from "./codex-pin.js";
import { FEATURE_POLICY, KEPT_FEATURES, featureDisableConfig } from "./feature-policy.js";

type PinnedFeature = { name: string; stage: string; default: boolean };
// The pinned binary's own list, written by `protocol:codex:upgrade` (F1.2). Read through the pin,
// so moving the pin without classifying the new binary's features fails here.
const pinned = JSON.parse(
  readFileSync(new URL(`../protocol/${CODEX_PIN}/features.json`, import.meta.url), "utf8"),
) as { features: PinnedFeature[] };

// FU-1 and FU-2, restated here rather than imported, so the table cannot drift from the ruling
// by editing one place.
const RULED_KEEP = [
  "content_item_kinds",
  "enable_request_compression",
  "fast_mode",
  "system_proxy_fallback",
  "unbounded_connection_retries",
];

describe("feature policy (F1.1, F1.2)", () => {
  it("classifies exactly the features the pinned binary reports, no more and no fewer", () => {
    expect(Object.keys(FEATURE_POLICY).sort()).toEqual(
      pinned.features.map((feature) => feature.name).sort(),
    );
  });

  it("keeps only the features FU-1 ruled on transport and protocol shape", () => {
    const kept = Object.entries(FEATURE_POLICY)
      .filter(([, ruling]) => ruling === "keep")
      .map(([name]) => name)
      .sort();
    expect(kept).toEqual(RULED_KEEP);
    expect([...KEPT_FEATURES].sort()).toEqual(RULED_KEEP);
  });

  it("turns off every default-on feature that is not kept, and never touches a kept one", () => {
    const config = featureDisableConfig();
    for (const feature of pinned.features.filter((entry) => entry.default)) {
      if (RULED_KEEP.includes(feature.name)) expect(config).not.toHaveProperty([feature.name]);
      else expect(config[feature.name]).toBe(false);
    }
    expect(Object.values(config).every((value) => value === false)).toBe(true);
  });

  it("also turns off features that are off by default here, since defaults differ by platform", () => {
    // secret_auth_storage is on for win32-x64 and off for linux-x64 in the same release.
    const config = featureDisableConfig();
    expect(Object.keys(config).sort()).toEqual(
      Object.keys(FEATURE_POLICY)
        .filter((name) => !RULED_KEEP.includes(name))
        .sort(),
    );
    expect(config.secret_auth_storage).toBe(false);
  });
});
