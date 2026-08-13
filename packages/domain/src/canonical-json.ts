type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export function stableStringify(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value, "$"));
}

function toCanonicalValue(value: unknown, path: string): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Canonical JSON requires a finite number at ${path}`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => toCanonicalValue(item, `${path}[${index}]`));
  }

  if (typeof value === "object") {
    const canonical: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined) {
        throw new TypeError(`Canonical JSON does not support undefined at ${path}.${key}`);
      }
      canonical[key] = toCanonicalValue(item, `${path}.${key}`);
    }
    return canonical;
  }

  throw new TypeError(`Canonical JSON does not support ${typeof value} at ${path}`);
}
