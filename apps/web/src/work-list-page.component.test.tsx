import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkListPage } from "./work-list-page.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
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
  it("resets an away baseline that is ahead of the current project's log", async () => {
    window.localStorage.setItem("your-move:last-seen-revision:project_surface_b", "1");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/session") {
        return reply({
          sessionId: "session_surface_b",
          csrfToken: "csrf_surface_b",
          projectId: "project_surface_b",
          runner: { available: false, state: "unavailable" },
        });
      }
      if (url === "/api/workflow/status") return reply({ available: false, state: "unavailable" });
      if (url === "/api/log")
        return reply({ revision: 0, events: [], truncated: false, problems: [] });
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkListPage />);

    expect(await screen.findByRole("heading", { name: "No work yet." })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "While you were away" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("your-move:last-seen-revision:project_surface_b")).toBe("0");
  });

  it("does not claim to create work until the real agent contract-draft path exists", async () => {
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
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<WorkListPage />);
    await user.click(await screen.findByRole("button", { name: "New work" }));
    expect(screen.getByRole("region", { name: "Describe the outcome" })).toHaveTextContent(
      "The current workflow core has no draft service, so this view will not create work.",
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/commands")).toBe(false);
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
    await user.click(await screen.findByRole("button", { name: "Show all work" }));
    await user.click(await screen.findByRole("button", { name: "Run Implement feature" }));

    await waitFor(() => {
      const runCall = fetchMock.mock.calls.find(([url]) => String(url) === "/api/workflow/execute");
      expect(runCall).toBeDefined();
      expect(JSON.parse(String(runCall?.[1]?.body))).toEqual({ workItemId: "work_surface_b" });
    });
  });

  it("replays the whole work projection at a visited log revision and disables past actions", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<WorkListPage />);
    await user.click(await screen.findByRole("button", { name: "Log" }));
    fireEvent.change(screen.getByRole("slider", { name: "Visit a log revision" }), {
      target: { value: "3" },
    });

    expect(screen.getByText("Viewing the past · r3. You cannot rule on the past.")).toBeVisible();
    expect(screen.getByText("◀ you are here")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Today" }));
    await user.click(screen.getByRole("button", { name: "Show all work" }));
    expect(screen.getByText("draft")).toBeVisible();
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Return to present · r6" }));
    expect(
      within(screen.getByRole("article", { name: "Implement feature" })).getByText("assigned"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Run Implement feature" })).toBeEnabled();
  });
});
