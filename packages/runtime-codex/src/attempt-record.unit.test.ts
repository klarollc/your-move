import { describe, expect, it } from "vitest";

import { attemptRecords } from "./attempt-record.js";
import type { TurnAttempt } from "./turn-runner.js";

const failedThenRecovered: TurnAttempt[] = [
  {
    attempt: 1,
    transportRetry: false,
    turnId: "turn_1",
    outcome: "failed",
    status: "failed",
    failure: {
      message: "stream disconnected before completion",
      variant: "responseStreamDisconnected",
      httpStatusCode: 502,
      additionalDetails: "error sending request for url",
      transport: true,
    },
    retries: [
      {
        message: "stream disconnected before completion",
        variant: "responseStreamDisconnected",
        httpStatusCode: null,
        additionalDetails: null,
        transport: true,
        willRetry: true,
        atMs: 1_200,
      },
    ],
    refusedServerRequest: null,
    lastMethod: "turn/completed",
    elapsedMs: 4_000,
  },
  {
    attempt: 2,
    transportRetry: true,
    turnId: "turn_2",
    outcome: "completed",
    status: "completed",
    failure: null,
    retries: [],
    refusedServerRequest: null,
    lastMethod: "turn/completed",
    elapsedMs: 6_000,
  },
];

describe("attempt records", () => {
  it("keep everything Codex said about a failure, which passes 6 to 9 lost", () => {
    const [first] = attemptRecords(failedThenRecovered);
    expect(first).toEqual({
      attempt: 1,
      transportRetry: false,
      turnId: "turn_1",
      outcome: "failed",
      status: "failed",
      elapsedMs: 4_000,
      lastMethod: "turn/completed",
      refusedServerRequest: null,
      failure: {
        message: "stream disconnected before completion",
        codexErrorInfo: "responseStreamDisconnected",
        httpStatusCode: 502,
        additionalDetails: "error sending request for url",
        transport: true,
      },
      codexRetries: [
        {
          atMs: 1_200,
          willRetry: true,
          message: "stream disconnected before completion",
          codexErrorInfo: "responseStreamDisconnected",
          httpStatusCode: null,
          additionalDetails: null,
        },
      ],
    });
  });

  it("mark a harness retry, and record a clean attempt with no failure", () => {
    const [, second] = attemptRecords(failedThenRecovered);
    expect(second).toMatchObject({ transportRetry: true, outcome: "completed", failure: null });
    expect(second?.codexRetries).toEqual([]);
  });

  it("are plain JSON, so a record survives a round trip unchanged", () => {
    const records = attemptRecords(failedThenRecovered);
    expect(JSON.parse(JSON.stringify(records))).toEqual(records);
  });
});
