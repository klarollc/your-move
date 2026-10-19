// A deliberately small JSON Schema validator for tool arguments (R3 brief, design 1).
//
// It supports only the features the v1 tools use: `type` (object, string, number, boolean, array),
// `properties`, `items`, `required`, `enum`, `description`, and `additionalProperties: false`. Any
// other keyword is refused by `assertSupportedSchema`, which the execution subsystem runs at boot,
// so a tool whose schema this validator cannot fully enforce is never offered to a model. Revisit
// (likely with ajv) when the MCP-client adapter lands and tools arrive with arbitrary schemas.

export type JsonSchema = Readonly<Record<string, unknown>>;

export class UnsupportedSchemaError extends Error {
  readonly code = "TOOL_SCHEMA_UNSUPPORTED";
  constructor(detail: string) {
    super(`TOOL_SCHEMA_UNSUPPORTED: ${detail}`);
    this.name = "UnsupportedSchemaError";
  }
}

const SUPPORTED_TYPES = new Set(["object", "string", "number", "boolean", "array"]);
const SUPPORTED_KEYWORDS = new Set([
  "type",
  "properties",
  "items",
  "required",
  "enum",
  "description",
  "additionalProperties",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function assertSupportedSchema(schema: unknown, path = "$"): void {
  if (!isRecord(schema)) throw new UnsupportedSchemaError(`${path} is not a schema object`);
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) {
      throw new UnsupportedSchemaError(`${path} uses "${keyword}"`);
    }
  }
  const type = schema.type;
  if (typeof type !== "string" || !SUPPORTED_TYPES.has(type)) {
    throw new UnsupportedSchemaError(`${path} has unsupported type ${JSON.stringify(type)}`);
  }
  if (schema.description !== undefined && typeof schema.description !== "string") {
    throw new UnsupportedSchemaError(`${path}.description is not a string`);
  }
  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
      throw new UnsupportedSchemaError(`${path}.enum must be a non-empty array`);
    }
    for (const member of schema.enum) {
      if (typeof member !== type) {
        throw new UnsupportedSchemaError(`${path}.enum member does not match type ${type}`);
      }
    }
  }
  const objectOnly = ["properties", "required", "additionalProperties"] as const;
  if (type !== "object") {
    for (const keyword of objectOnly) {
      if (schema[keyword] !== undefined) {
        throw new UnsupportedSchemaError(`${path}.${keyword} is only supported on objects`);
      }
    }
  } else {
    if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
      throw new UnsupportedSchemaError(`${path}.additionalProperties must be false when present`);
    }
    const properties = schema.properties ?? {};
    if (!isRecord(properties)) throw new UnsupportedSchemaError(`${path}.properties is invalid`);
    for (const [name, child] of Object.entries(properties)) {
      assertSupportedSchema(child, `${path}.${name}`);
    }
    if (schema.required !== undefined) {
      if (
        !Array.isArray(schema.required) ||
        schema.required.some((name) => typeof name !== "string" || !(name in properties))
      ) {
        throw new UnsupportedSchemaError(`${path}.required must name declared properties`);
      }
    }
  }
  if (type === "array") {
    if (schema.items === undefined) throw new UnsupportedSchemaError(`${path}.items is required`);
    assertSupportedSchema(schema.items, `${path}[]`);
  } else if (schema.items !== undefined) {
    throw new UnsupportedSchemaError(`${path}.items is only supported on arrays`);
  }
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

function check(schema: JsonSchema, value: unknown, path: string): string | undefined {
  switch (schema.type) {
    case "object": {
      if (!isRecord(value)) return `${path} must be an object`;
      const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
      for (const name of (schema.required ?? []) as string[]) {
        if (value[name] === undefined) return `${path}.${name} is required`;
      }
      for (const [name, child] of Object.entries(value)) {
        const childSchema = properties[name];
        if (!childSchema) {
          if (schema.additionalProperties === false) return `${path}.${name} is not allowed`;
          continue;
        }
        if (child === undefined) continue;
        const error = check(childSchema, child, `${path}.${name}`);
        if (error) return error;
      }
      return undefined;
    }
    case "array": {
      if (!Array.isArray(value)) return `${path} must be an array`;
      for (const [index, item] of value.entries()) {
        const error = check(schema.items as JsonSchema, item, `${path}[${index}]`);
        if (error) return error;
      }
      return undefined;
    }
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be a number`;
      break;
    case "string":
      if (typeof value !== "string") return `${path} must be a string`;
      break;
    case "boolean":
      if (typeof value !== "boolean") return `${path} must be a boolean`;
      break;
    default:
      return `${path} has an unsupported schema`;
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return `${path} must be one of ${schema.enum.join(", ")}`;
  }
  return undefined;
}

/** Validates against a schema already accepted by `assertSupportedSchema`. Paths omit the `$.`. */
export function validateArgs(schema: JsonSchema, value: unknown): ValidationResult {
  const error = check(schema, value, "$");
  return error ? { ok: false, error: error.replace(/^\$\.?/, "") || "arguments" } : { ok: true };
}
