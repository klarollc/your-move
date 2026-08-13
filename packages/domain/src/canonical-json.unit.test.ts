import { describe, expect, it } from "vitest";

import { stableStringify } from "./canonical-json.js";

describe("stableStringify", () => {
  it("produces byte-identical JSON regardless of object key insertion order", () => {
    const first = { z: 3, nested: { b: 2, a: 1 }, array: [{ y: 2, x: 1 }] };
    const second = { array: [{ x: 1, y: 2 }], nested: { a: 1, b: 2 }, z: 3 };

    expect(stableStringify(first)).toBe(stableStringify(second));
    expect(stableStringify(first)).toBe('{"array":[{"x":1,"y":2}],"nested":{"a":1,"b":2},"z":3}');
  });

  it("preserves array order while sorting object keys recursively", () => {
    expect(
      stableStringify([
        { b: 2, a: 1 },
        { d: 4, c: 3 },
      ]),
    ).toBe('[{"a":1,"b":2},{"c":3,"d":4}]');
  });

  it("rejects unsupported non-JSON values", () => {
    expect(() => stableStringify({ value: undefined })).toThrowError(
      "Canonical JSON does not support undefined at $.value",
    );
  });
});
