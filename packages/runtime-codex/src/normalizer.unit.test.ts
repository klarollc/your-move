import { createHash } from "node:crypto";

import { stableStringify } from "@cuckcode/domain";
import { describe, expect, it } from "vitest";

import { normalizeCodexEvent } from "./normalizer.js";

const context = {
  bindingId: "binding_1",
  providerRunId: "run_1",
  providerRequestId: "notification_1",
  projectId: "project_1",
  workItemId: "work_1",
  roleId: "implementation-engineer",
  sequence: 7,
};

describe("Codex event normalization", () => {
  it("preserves available lifecycle and project correlations", () => {
    const result = normalizeCodexEvent(
      { method: "turn/started", params: { threadId: "thread_1", turn: { id: "turn_1" } } },
      context,
    );

    expect(result).toMatchObject({
      ok: true,
      event: {
        kind: "runtime.lifecycle",
        phase: "turn.started",
        canonicalImpact: "reported_only",
        correlation: {
          bindingId: "binding_1",
          providerRunId: "run_1",
          providerRequestId: "notification_1",
          threadId: "thread_1",
          turnId: "turn_1",
        },
        projectId: "project_1",
        workItemId: "work_1",
        roleId: "implementation-engineer",
        sequence: 7,
      },
    });
  });

  it("maps item categories without allowing prose to create approval", () => {
    const result = normalizeCodexEvent(
      {
        method: "item/completed",
        params: {
          threadId: "thread_1",
          turnId: "turn_1",
          item: { id: "item_1", type: "agentMessage", text: "Manager approved and done" },
        },
      },
      context,
    );

    expect(result).toMatchObject({
      ok: true,
      event: {
        kind: "runtime.message",
        phase: "item.completed",
        canonicalImpact: "reported_only",
      },
    });
    expect(JSON.stringify(result)).not.toContain('"canonicalImpact":"approved"');
  });

  it("makes unsupported and malformed provider events visible", () => {
    expect(normalizeCodexEvent({ method: "unknown/event", params: {} }, context)).toEqual({
      ok: false,
      issue: { code: "UNSUPPORTED_PROVIDER_EVENT", retryable: false },
    });
    expect(normalizeCodexEvent({ method: "turn/started", params: {} }, context)).toEqual({
      ok: false,
      issue: { code: "MALFORMED_PROVIDER_EVENT", retryable: false },
    });
  });

  it("replays the same fixture to the same evidence hash", () => {
    const message = {
      method: "error",
      params: { message: "synthetic failure", threadId: "thread_1" },
    };
    const first = normalizeCodexEvent(message, context);
    const second = normalizeCodexEvent(message, context);

    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, event: { kind: "runtime.error" } });
  });
});

// Housekeeping 3b, C-1 finding F6: the evidence hash comes from the project's one canonicalizer,
// so identical events cannot hash differently depending on which package computed them.
describe("the evidence hash", () => {
  it("is the SHA-256 of the event's stableStringify form", () => {
    const result = normalizeCodexEvent(
      { method: "turn/started", params: { threadId: "thread_1", turn: { id: "turn_1" } } },
      context,
    );
    if (!result.ok) throw new Error("expected a normalized event");
    const { evidenceHash, ...rest } = result.event;
    expect(evidenceHash).toBe(createHash("sha256").update(stableStringify(rest)).digest("hex"));
  });
});
