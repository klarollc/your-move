import { describe, expect, it } from "vitest";

import { TRANSPORT_CLASSES, classifyTurnError } from "./failure-classification.js";

describe("turn failure classification", () => {
  it("keeps Codex's own class, HTTP status and details, which the harness used to drop", () => {
    expect(
      classifyTurnError({
        message: "stream disconnected before completion",
        codexErrorInfo: { responseStreamDisconnected: { httpStatusCode: 502 } },
        additionalDetails: "error sending request",
      }),
    ).toEqual({
      message: "stream disconnected before completion",
      variant: "responseStreamDisconnected",
      httpStatusCode: 502,
      additionalDetails: "error sending request",
      transport: true,
    });
  });

  it("counts exactly the four transport classes of CX-4 as transport", () => {
    expect([...TRANSPORT_CLASSES].sort()).toEqual([
      "httpConnectionFailed",
      "responseStreamConnectionFailed",
      "responseStreamDisconnected",
      "responseTooManyFailedAttempts",
    ]);
    for (const variant of TRANSPORT_CLASSES) {
      expect(classifyTurnError({ message: "x", codexErrorInfo: { [variant]: {} } }).transport).toBe(
        true,
      );
    }
  });

  it("never counts a limit, a policy block or an overloaded server as transport", () => {
    for (const variant of [
      "usageLimitExceeded",
      "rateLimitExceeded",
      "misalignmentPolicyViolation",
      "serverOverloaded",
      "unauthorized",
    ]) {
      const classified = classifyTurnError({ message: "x", codexErrorInfo: variant });
      expect(classified.variant, variant).toBe(variant);
      expect(classified.transport, variant).toBe(false);
    }
  });

  it("reports an unclassified error honestly rather than guessing", () => {
    expect(classifyTurnError({ message: "odd" })).toEqual({
      message: "odd",
      variant: null,
      httpStatusCode: null,
      additionalDetails: null,
      transport: false,
    });
    expect(classifyTurnError(null).variant).toBeNull();
  });
});
