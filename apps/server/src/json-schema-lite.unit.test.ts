import { describe, expect, it } from "vitest";

import { UnsupportedSchemaError, assertSupportedSchema, validateArgs } from "./json-schema-lite.js";

const schema = {
  type: "object",
  properties: {
    url: { type: "string", description: "Address to read" },
    extract: { type: "string", enum: ["text", "markdown"] },
    depth: { type: "number" },
    deep: { type: "boolean" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["url"],
  additionalProperties: false,
} as const;

describe("assertSupportedSchema", () => {
  it("accepts the features the v1 tools use", () => {
    expect(() => assertSupportedSchema(schema)).not.toThrow();
  });

  it.each([
    ["pattern", { type: "string", pattern: "^a" }],
    ["format", { type: "string", format: "uri" }],
    ["oneOf", { oneOf: [{ type: "string" }] }],
    ["$ref", { $ref: "#/definitions/x" }],
    ["nested minLength", { type: "object", properties: { a: { type: "string", minLength: 1 } } }],
    ["unknown type", { type: "integer" }],
    ["additionalProperties true", { type: "object", additionalProperties: true }],
  ])("refuses a schema using %s", (_name, unsupported) => {
    expect(() => assertSupportedSchema(unsupported)).toThrow(UnsupportedSchemaError);
  });
});

describe("validateArgs", () => {
  it("accepts valid arguments", () => {
    expect(validateArgs(schema, { url: "https://example.com", tags: ["a"], deep: true })).toEqual({
      ok: true,
    });
  });

  it.each([
    ["a missing required field", { extract: "text" }, "url"],
    ["a wrong type", { url: 3 }, "url"],
    ["a value outside the enum", { url: "u", extract: "html" }, "extract"],
    ["an unknown field", { url: "u", token: "x" }, "token"],
    ["a wrong array item", { url: "u", tags: [1] }, "tags[0]"],
    ["a non-finite number", { url: "u", depth: Number.NaN }, "depth"],
  ])("rejects %s", (_name, value, path) => {
    const result = validateArgs(schema, value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(path);
  });

  it("rejects a non-object top level", () => {
    expect(validateArgs(schema, "https://example.com").ok).toBe(false);
    expect(validateArgs(schema, null).ok).toBe(false);
    expect(validateArgs(schema, []).ok).toBe(false);
  });
});
