export type FakeScheduleEntry =
  | { at: number; channel: "stdout" | "stderr"; data: string }
  | { at: number; channel: "disconnect" };

export type FakeRuntimeRecord =
  | { kind: "response"; requestId: number | string; result: unknown }
  | { kind: "notification"; method: string; params: unknown };

export type FakeRuntimeResult = {
  records: FakeRuntimeRecord[];
  issues: { code: string }[];
  stderr: string[];
  disconnected: boolean;
};

export class DeterministicRuntimeFake {
  readonly #maxLineBytes: number;
  readonly #pending: Set<number | string>;

  constructor(options: { maxLineBytes?: number; pendingRequestIds?: (number | string)[] } = {}) {
    this.#maxLineBytes = options.maxLineBytes ?? 1_048_576;
    this.#pending = new Set(options.pendingRequestIds ?? []);
  }

  run(schedule: readonly FakeScheduleEntry[]): FakeRuntimeResult {
    const records: FakeRuntimeRecord[] = [];
    const issues: { code: string }[] = [];
    const stderr: string[] = [];
    const completed = new Set<number | string>();
    let buffer = "";
    let disconnected = false;
    const ordered = schedule
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => left.entry.at - right.entry.at || left.index - right.index);

    for (const { entry } of ordered) {
      if (entry.channel === "disconnect") {
        disconnected = true;
        continue;
      }
      if (entry.channel === "stderr") {
        stderr.push(entry.data);
        continue;
      }
      if (disconnected) {
        issues.push({ code: "LATE_AFTER_DISCONNECT" });
        continue;
      }
      buffer += entry.data;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (Buffer.byteLength(line, "utf8") > this.#maxLineBytes) {
          issues.push({ code: "LINE_TOO_LARGE" });
          continue;
        }
        let message: unknown;
        try {
          message = JSON.parse(line);
        } catch {
          issues.push({ code: "MALFORMED_JSON" });
          continue;
        }
        if (!isRecord(message)) {
          issues.push({ code: "INVALID_MESSAGE" });
          continue;
        }
        const requestId = message.id;
        if (typeof requestId === "number" || typeof requestId === "string") {
          if (completed.has(requestId)) {
            issues.push({ code: "DUPLICATE_RESPONSE" });
            continue;
          }
          if (!this.#pending.has(requestId)) {
            issues.push({ code: "UNKNOWN_RESPONSE" });
            continue;
          }
          completed.add(requestId);
          records.push({ kind: "response", requestId, result: message.result });
          continue;
        }
        if (typeof message.method === "string") {
          records.push({ kind: "notification", method: message.method, params: message.params });
          continue;
        }
        issues.push({ code: "INVALID_MESSAGE" });
      }
    }
    if (buffer.length > 0) issues.push({ code: "INCOMPLETE_LINE" });
    return { records, issues, stderr, disconnected };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
