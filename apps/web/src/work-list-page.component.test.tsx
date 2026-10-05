import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkListPage } from "./work-list-page.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const reply = (value: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => value }) as Response;

const at = (second: number) => new Date(Date.UTC(2026, 9, 4, 10, 0, second)).toISOString();
const assignedEvents = [
  {
    schemaVersion: 1,
    eventId: "event_runner_agent",
    projectId: "project_surface_b",
    kind: "agent.registered",
    occurredAt: at(0),
    receivedAt: at(0),
    source: "system",
    trust: "verified",
    payload: { agentId: "agent_engineer", capabilities: ["engineer"], health: "connected" },
  },
  {
    schemaVersion: 1,
    eventId: "event_runner_role",
    projectId: "project_surface_b",
    kind: "role.assigned",
    occurredAt: at(1),
    receivedAt: at(1),
    source: "system",
    trust: "verified",
    payload: {
      roleAssignmentId: "role-assignment_engineer",
      roleId: "engineer",
      agentId: "agent_engineer",
      requiredCapabilities: ["engineer"],
    },
  },
  {
    schemaVersion: 1,
    eventId: "event_runner_work",
    projectId: "project_surface_b",
    kind: "work.created",
    occurredAt: at(2),
    receivedAt: at(2),
    source: "manager",
    trust: "verified",
    payload: {
      payloadVersion: 2,
      workItemId: "work_surface_b",
      outcome: "Implement feature",
      requiredEvidenceKinds: ["work-output"],
      contract: {
        outcome: "Implement feature",
        exclusions: [],
        acceptanceCriteria: ["The output is inspectable"],
        dependencies: [],
        evidenceObligations: [{ kind: "work-output", description: "Saved work output" }],
        permissionCeiling: {
          sandboxMode: "workspace-write",
          approvalPolicy: "never",
          networkAccess: false,
          windowsSandbox: "unelevated",
        },
        stopConditions: ["Stop if preconditions fail"],
        definitionOfDone: "Review passing evidence",
        contextRefs: [],
      },
    },
  },
  {
    schemaVersion: 1,
    eventId: "event_runner_ready",
    projectId: "project_surface_b",
    kind: "work.transitioned",
    occurredAt: at(3),
    receivedAt: at(3),
    source: "manager",
    trust: "verified",
    payload: { workItemId: "work_surface_b", fromRevision: 0, toState: "ready" },
  },
  {
    schemaVersion: 1,
    eventId: "event_runner_assignment",
    projectId: "project_surface_b",
    kind: "work.assigned",
    occurredAt: at(4),
    receivedAt: at(4),
    source: "manager",
    trust: "verified",
    payload: { workItemId: "work_surface_b", roleAssignmentId: "role-assignment_engineer" },
    workItemId: "work_surface_b",
    roleAssignmentId: "role-assignment_engineer",
  },
  {
    schemaVersion: 1,
    eventId: "event_runner_assigned",
    projectId: "project_surface_b",
    kind: "work.transitioned",
    occurredAt: at(5),
    receivedAt: at(5),
    source: "manager",
    trust: "verified",
    payload: { workItemId: "work_surface_b", fromRevision: 1, toState: "assigned" },
  },
];

describe("Surface B log-backed page", () => {
  it("creates work through the shared command API using the connected project revision", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/session") {
        return reply({
          sessionId: "session_surface_b",
          csrfToken: "csrf_surface_b",
          projectId: "project_surface_b",
          runner: { available: false, state: "unavailable" },
        });
      }
      if (url === "/api/workflow/status") {
        return reply({ available: false, state: "unavailable" });
      }
      if (url === "/api/log")
        return reply({ revision: 0, events: [], truncated: false, problems: [] });
      if (url === "/api/commands" && init?.method === "POST") return reply({ accepted: true }, 202);
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<WorkListPage />);
    await user.click(await screen.findByRole("button", { name: "New work" }));
    const dialog = screen.getByRole("region", { name: "Create work" });
    await user.type(within(dialog).getByLabelText("Outcome"), "Prepare release note");
    await user.type(within(dialog).getByLabelText(/Acceptance criteria/), "The note is reviewed");
    await user.click(within(dialog).getByRole("button", { name: "Create work" }));

    await waitFor(() => {
      const commandCall = fetchMock.mock.calls.find(([url]) => String(url) === "/api/commands");
      expect(commandCall).toBeDefined();
      const command = JSON.parse(String(commandCall?.[1]?.body)) as Record<string, unknown>;
      expect(command).toMatchObject({
        projectId: "project_surface_b",
        expectedRevision: 0,
        actor: { actorType: "manager", actorId: "manager_surface_b" },
        intent: "work.create",
        payload: { contract: { outcome: "Prepare release note" } },
      });
    });
  });

  it("starts the loopback runner with only the selected work-item id", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/session") {
        return reply({
          sessionId: "session_surface_b",
          csrfToken: "csrf_surface_b",
          projectId: "project_surface_b",
          runner: { available: true, state: "idle" },
        });
      }
      if (url === "/api/workflow/status") return reply({ available: true, state: "idle" });
      if (url === "/api/log") {
        return reply({
          revision: assignedEvents.length,
          events: assignedEvents,
          truncated: false,
          problems: [],
        });
      }
      if (url === "/api/workflow/execute" && init?.method === "POST") {
        return reply(
          {
            accepted: true,
            runner: { available: true, state: "running", workItemId: "work_surface_b" },
          },
          202,
        );
      }
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<WorkListPage />);
    await user.click(await screen.findByRole("button", { name: "Run Implement feature" }));

    await waitFor(() => {
      const runCall = fetchMock.mock.calls.find(([url]) => String(url) === "/api/workflow/execute");
      expect(runCall).toBeDefined();
      expect(JSON.parse(String(runCall?.[1]?.body))).toEqual({ workItemId: "work_surface_b" });
    });
  });
});
