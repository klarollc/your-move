import { describe, expect, it } from "vitest";

import { DeterministicRuntimeFake } from "./runtime-fake.js";

const response = JSON.stringify({ id: 1, result: { ready: true } });

describe("deterministic runtime fake conformance", () => {
  it("produces byte-equivalent output for the same fragmented schedule", () => {
    const schedule = [
      { at: 1, channel: "stdout" as const, data: response.slice(0, 8) },
      { at: 2, channel: "stdout" as const, data: `${response.slice(8)}\n` },
    ];
    const first = new DeterministicRuntimeFake({ pendingRequestIds: [1] }).run(schedule);
    const second = new DeterministicRuntimeFake({ pendingRequestIds: [1] }).run(schedule);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.records).toEqual([{ kind: "response", requestId: 1, result: { ready: true } }]);
  });

  it("makes duplicate and unknown responses visible without inventing progress", () => {
    const result = new DeterministicRuntimeFake({ pendingRequestIds: [1] }).run([
      { at: 1, channel: "stdout", data: `${response}\n${response}\n` },
      { at: 2, channel: "stdout", data: '{"id":99,"result":{}}\n' },
    ]);

    expect(result.records).toHaveLength(1);
    expect(result.issues.map(({ code }) => code)).toEqual([
      "DUPLICATE_RESPONSE",
      "UNKNOWN_RESPONSE",
    ]);
  });

  it("rejects malformed and oversized lines", () => {
    const malformed = new DeterministicRuntimeFake({ maxLineBytes: 20 }).run([
      { at: 1, channel: "stdout", data: "not-json\n" },
      { at: 2, channel: "stdout", data: `${"x".repeat(21)}\n` },
    ]);

    expect(malformed.records).toEqual([]);
    expect(malformed.issues.map(({ code }) => code)).toEqual(["MALFORMED_JSON", "LINE_TOO_LARGE"]);
  });

  it("does not turn stderr into lifecycle progress", () => {
    const result = new DeterministicRuntimeFake().run([
      { at: 1, channel: "stderr", data: "turn completed" },
    ]);

    expect(result.records).toEqual([]);
    expect(result.stderr).toEqual(["turn completed"]);
  });

  it("rejects stdout arriving after disconnect", () => {
    const result = new DeterministicRuntimeFake({ pendingRequestIds: [1] }).run([
      { at: 1, channel: "disconnect" },
      { at: 2, channel: "stdout", data: `${response}\n` },
    ]);

    expect(result.records).toEqual([]);
    expect(result.issues.map(({ code }) => code)).toEqual(["LATE_AFTER_DISCONNECT"]);
  });
});
