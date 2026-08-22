import test from "node:test";
import assert from "node:assert/strict";

import { checkToolchain, satisfiesEngineRange } from "./check-toolchain.mjs";

test("accepts versions inside the declared Node and npm engine ranges", () => {
  const result = checkToolchain(
    {
      node: ">=24.18.0 <25",
      npm: ">=11.16.0 <12",
    },
    {
      node: "24.18.0",
      npm: "11.16.0",
    },
  );

  assert.deepEqual(result, { ok: true, errors: [] });
});

test("rejects versions outside the declared engine ranges with actionable messages", () => {
  const result = checkToolchain(
    {
      node: ">=24.18.0 <25",
      npm: ">=11.16.0 <12",
    },
    {
      node: "26.7.0",
      npm: "12.0.2",
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "Node 26.7.0 does not satisfy required range >=24.18.0 <25.",
    "npm 12.0.2 does not satisfy required range >=11.16.0 <12.",
  ]);
});

test("supports the exact range form used by package engines", () => {
  assert.equal(satisfiesEngineRange("24.18.0", ">=24.18.0 <25"), true);
  assert.equal(satisfiesEngineRange("24.17.9", ">=24.18.0 <25"), false);
  assert.equal(satisfiesEngineRange("25.0.0", ">=24.18.0 <25"), false);
  assert.equal(satisfiesEngineRange("11.19.0", ">=11.16.0 <12"), true);
});
