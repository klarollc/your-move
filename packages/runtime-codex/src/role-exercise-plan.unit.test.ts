import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseApprovedRoleExercisePlan } from "./role-exercise-plan.js";

const packet = `
| Role | Model | Reasoning effort |
| --- | --- | --- |
| Delivery Lead | gpt-5.6-luna | medium |
| Product Designer | gpt-5.6-luna | medium |
| Implementation Engineer | gpt-5.6-luna | medium |
| Test Engineer | gpt-5.6-luna | medium |
| Visual QA Reviewer | gpt-5.6-luna | medium |
| **Release Reviewer** | **gpt-5.6-sol** | medium |
`;

describe("approved role exercise plan", () => {
  it("reads the unchanged Task 16 packet as the executable source of truth", async () => {
    const actualPacket = await readFile(
      resolve(process.cwd(), "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md"),
      "utf8",
    );

    expect(parseApprovedRoleExercisePlan(actualPacket)).toEqual(
      expect.objectContaining({
        ok: true,
        plan: expect.arrayContaining([
          expect.objectContaining({ roleId: "release-reviewer", model: "gpt-5.6-sol" }),
        ]),
      }),
    );
  });

  it("derives all six runtime configurations from the packet rather than a copied default", () => {
    expect(parseApprovedRoleExercisePlan(packet)).toEqual({
      ok: true,
      plan: [
        { roleId: "delivery-lead", model: "gpt-5.6-luna", reasoningEffort: "medium" },
        { roleId: "product-designer", model: "gpt-5.6-luna", reasoningEffort: "medium" },
        {
          roleId: "implementation-engineer",
          model: "gpt-5.6-luna",
          reasoningEffort: "medium",
        },
        { roleId: "test-engineer", model: "gpt-5.6-luna", reasoningEffort: "medium" },
        { roleId: "visual-qa-reviewer", model: "gpt-5.6-luna", reasoningEffort: "medium" },
        { roleId: "release-reviewer", model: "gpt-5.6-sol", reasoningEffort: "medium" },
      ],
    });
  });

  it("fails closed rather than inventing a configuration when a required role is missing", () => {
    const missing = packet.replace("| **Release Reviewer** | **gpt-5.6-sol** | medium |\n", "");

    expect(parseApprovedRoleExercisePlan(missing)).toEqual({
      ok: false,
      code: "ROLE_EXERCISE_PLAN_INCOMPLETE",
      missingRoleIds: ["release-reviewer"],
    });
  });
});
