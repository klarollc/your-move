import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import test from "node:test";

import {
  CONSUMED_FILES,
  diffSurface,
  extractSurface,
  parseUpgradeArgs,
  renderSurfaceDiff,
  upgradeWritePaths,
} from "./codex-surface-diff.mjs";

const BASE = resolve("packages/runtime-codex/protocol/0.146.0/schemas");

/** A reader over the committed 0.146.0 bundle, with optional in-memory edits per file. */
function reader(edits = {}) {
  return (name) => {
    const parsed = JSON.parse(readFileSync(join(BASE, name), "utf8"));
    return edits[name] ? edits[name](parsed) : parsed;
  };
}

const kinds = (entries) => entries.map((entry) => `${entry.kind}:${entry.name}`).sort();

test("the consumed surface names the files the harness actually reads", () => {
  for (const name of [
    "ClientRequest.json",
    "ServerRequest.json",
    "ServerNotification.json",
    "v2/ThreadStartParams.json",
    "v2/TurnStartParams.json",
    "v2/TurnCompletedNotification.json",
    "v2/ErrorNotification.json",
    "v1/InitializeResponse.json",
  ]) {
    assert.ok(CONSUMED_FILES.includes(name), `${name} is consumed`);
  }
});

test("an unchanged bundle has an empty diff", () => {
  const diff = diffSurface(extractSurface(reader()), extractSurface(reader()));
  assert.deepEqual(diff, { breaking: [], needsRuling: [], additions: [], changes: [] });
});

test("a new turn item type needs a classification ruling before the pin can move", () => {
  const withItem = reader({
    "v2/TurnCompletedNotification.json": (schema) => {
      schema.definitions.ThreadItem.oneOf.push({
        type: "object",
        required: ["id", "type"],
        properties: { id: { type: "string" }, type: { type: "string", enum: ["teleport"] } },
      });
      return schema;
    },
  });
  const diff = diffSurface(extractSurface(reader()), extractSurface(withItem));
  assert.deepEqual(kinds(diff.needsRuling), ["threadItemType:teleport"]);
  assert.deepEqual(diff.breaking, []);
});

test("a new failure class needs a ruling on whether it is a transport failure", () => {
  const withVariant = reader({
    "v2/TurnCompletedNotification.json": (schema) => {
      schema.definitions.CodexErrorInfo.oneOf[0].enum.push("solarFlare");
      return schema;
    },
  });
  const diff = diffSurface(extractSurface(reader()), extractSurface(withVariant));
  assert.deepEqual(kinds(diff.needsRuling), ["codexErrorInfo:solarFlare"]);
});

test("a server request that disappears is flagged, because the refusal list is derived from it", () => {
  const removed = reader({
    "ServerRequest.json": (schema) => {
      schema.oneOf = schema.oneOf.filter(
        (entry) => !JSON.stringify(entry).includes('"attestation/generate"'),
      );
      return schema;
    },
  });
  const diff = diffSurface(extractSurface(reader()), extractSurface(removed));
  assert.ok(kinds(diff.needsRuling).includes("serverRequestRemoved:attestation/generate"));
});

test("losing a client method the harness calls is breaking", () => {
  const removed = reader({
    "ClientRequest.json": (schema) => {
      schema.oneOf = schema.oneOf.filter(
        (entry) => !JSON.stringify(entry).includes('"turn/interrupt"'),
      );
      return schema;
    },
  });
  const diff = diffSurface(extractSurface(reader()), extractSurface(removed));
  assert.deepEqual(kinds(diff.breaking), ["clientMethodRemoved:turn/interrupt"]);
});

test("a new required parameter the harness does not send is breaking; a new optional one is an addition", () => {
  const required = reader({
    "v2/ThreadStartParams.json": (schema) => {
      schema.properties.ticket = { type: "string" };
      schema.required = [...(schema.required ?? []), "ticket"];
      return schema;
    },
  });
  const optional = reader({
    "v2/ThreadStartParams.json": (schema) => {
      schema.properties.ticket = { type: ["string", "null"] };
      return schema;
    },
  });
  assert.deepEqual(
    kinds(diffSurface(extractSurface(reader()), extractSurface(required)).breaking),
    ["requiredAdded:v2/ThreadStartParams.json#ticket"],
  );
  const additive = diffSurface(extractSurface(reader()), extractSurface(optional));
  assert.deepEqual(additive.breaking, []);
  assert.deepEqual(kinds(additive.additions), ["propertyAdded:v2/ThreadStartParams.json#ticket"]);
});

test("the report is deterministic and leads with what needs a ruling", () => {
  const withItem = reader({
    "v2/TurnCompletedNotification.json": (schema) => {
      schema.definitions.ThreadItem.oneOf.push({
        type: "object",
        properties: { type: { type: "string", enum: ["teleport"] } },
      });
      return schema;
    },
  });
  const diff = diffSurface(extractSurface(reader()), extractSurface(withItem));
  const first = renderSurfaceDiff(diff, { from: "0.146.0", to: "9.9.9" });
  assert.equal(first, renderSurfaceDiff(diff, { from: "0.146.0", to: "9.9.9" }));
  assert.match(first, /^# Codex surface diff: 0\.146\.0 → 9\.9\.9/u);
  const ruling = first.indexOf("## Needs a ruling");
  assert.ok(ruling > 0 && ruling < first.indexOf("## Breaking"));
  assert.match(first, /`teleport`/u);
});

test("the upgrade takes one exact version and an optional baseline", () => {
  assert.deepEqual(parseUpgradeArgs(["0.157.1"]), { version: "0.157.1", from: undefined });
  assert.deepEqual(parseUpgradeArgs(["0.157.1", "--from", "0.146.0"]), {
    version: "0.157.1",
    from: "0.146.0",
  });
  assert.throws(() => parseUpgradeArgs([]), /UPGRADE_VERSION_REQUIRED/u);
  assert.throws(() => parseUpgradeArgs(["^0.157.1"]), /UPGRADE_VERSION_NOT_EXACT/u);
});

test("the upgrade writes only inside the new bundle and never touches the pin", () => {
  const root = resolve("packages/runtime-codex/protocol");
  const paths = upgradeWritePaths(root, "0.157.1");
  assert.ok(paths.length > 0);
  for (const path of paths) {
    const inside = relative(join(root, "0.157.1"), path);
    assert.ok(!inside.startsWith("..") && !inside.startsWith(sep), `${path} is inside the bundle`);
    assert.ok(!path.endsWith("package.json"), `${path} is not a manifest`);
  }
});
