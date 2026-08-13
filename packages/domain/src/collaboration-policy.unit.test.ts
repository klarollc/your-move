import { describe, expect, it } from "vitest";

import { authorizeCollaborationCommand } from "./collaboration-policy.js";

const command = {
  commandId: "collaboration_1",
  projectId: "project_alpha",
  actorId: "agent_1",
  action: "propose" as const,
  targetIds: ["work_notice"],
  summary: "Publish the build.",
  requiredPermissions: ["project.read", "deployment.publish"],
};

describe("collaboration authority", () => {
  it("cannot bypass project permissions for either participant type", () => {
    const human = authorizeCollaborationCommand("human", command, ["project.read"]);
    const agent = authorizeCollaborationCommand("agent", command, ["project.read"]);

    expect(human).toEqual(agent);
    expect(human).toMatchObject({
      ok: false,
      error: {
        code: "PERMISSION_REQUIRED",
        requiredAuthority: "deployment.publish",
        retrySafe: true,
      },
    });
  });
});
