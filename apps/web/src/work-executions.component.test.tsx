import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostedWorkspace } from "./hosted-workspace.js";
import { APPROVAL_CONSENT, WorkExecutions, executionStatusLine } from "./work-executions.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const prose = {
  achieve: "Add a setup section",
  inScope: ["README"],
  outOfScope: [],
  doneWhen: ["x"],
};
const waitingExecution = {
  id: "exec_1",
  status: "waiting-on-you",
  attempt: 1,
  turnCount: 1,
  maxTurns: 10,
  output: null,
  error: null,
  proposals: [
    {
      id: "proposal_1",
      tool: "github_propose_write",
      status: "pending",
      change: { repo: "octo/repo", path: "README.md", message: "Add setup", content: "## Setup" },
    },
  ],
};

describe("approval consent copy", () => {
  it("states what approval arms before the owner confirms", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session") return jsonResponse({ authenticated: true });
      if (url === "/api/providers") {
        return jsonResponse({
          providers: [
            { id: "openai", status: "disconnected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "automatic" },
        });
      }
      if (url === "/api/work-drafts" && init?.method === "POST") {
        return jsonResponse(
          {
            id: "draft_1",
            status: "draft",
            description: "d",
            prose,
            revision: 1,
            updatedAt: "2026-10-19T00:00:00.000Z",
            approvedAt: null,
            execution: null,
          },
          201,
        );
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<HostedWorkspace fetcher={fetcher} />);
    await user.type(await screen.findByLabelText(/What should get done/), "Add a setup section");
    await user.click(screen.getByRole("button", { name: "Draft it" }));
    await user.click(await screen.findByRole("button", { name: "Approve this work" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(APPROVAL_CONSENT)).toBeVisible();
    expect(APPROVAL_CONSENT).toBe(
      "Approving gives the agent web research + repo read access. File changes always need your go-ahead.",
    );
  });
});

describe("WorkExecutions", () => {
  it("shows a status line per approved item and lets the owner approve a pending proposal", async () => {
    let decided = false;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/work-drafts") {
        return jsonResponse({
          drafts: [
            {
              id: "draft_1",
              status: "approved",
              prose,
              execution: decided
                ? { ...waitingExecution, status: "done", proposals: [] }
                : waitingExecution,
            },
            { id: "draft_2", status: "draft", prose: { achieve: "Not approved" } },
          ],
        });
      }
      if (
        url === "/api/work-executions/exec_1/proposals/proposal_1/approve" &&
        init?.method === "POST"
      ) {
        decided = true;
        return jsonResponse({ ...waitingExecution, status: "queued" });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetcher} />);

    expect(
      await screen.findByText("Waiting on you — the agent proposes a file change."),
    ).toBeVisible();
    expect(screen.queryByText("Not approved")).not.toBeInTheDocument();
    const proposal = screen.getByRole("group", { name: "Proposed change to README.md" });
    expect(within(proposal).getByText("## Setup")).toBeVisible();
    // R4 Track E supersedes "Approve change": the approval button always says "Go ahead and send".
    await user.click(within(proposal).getByRole("button", { name: "Go ahead and send" }));

    expect(await screen.findByText("Done.")).toBeVisible();
    const approveCall = fetcher.mock.calls.find(([input]) => String(input).endsWith("/approve"))!;
    expect(new Headers(approveCall[1]?.headers).get("content-type")).toBeNull();
    expect(approveCall[1]?.body).toBeUndefined();
  });

  it("offers a Start button with the consent line for work approved before R3", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/work-drafts") {
        return jsonResponse({
          drafts: [{ id: "draft_old", status: "approved", prose, execution: null }],
        });
      }
      if (url === "/api/work-executions" && init?.method === "POST") {
        return jsonResponse({ ...waitingExecution, status: "queued", proposals: [] }, 201);
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetcher} />);
    expect(await screen.findByText("Not started.")).toBeVisible();
    expect(screen.getByText(APPROVAL_CONSENT)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Start this work" }));
    const start = fetcher.mock.calls.find(
      ([input, init]) => String(input) === "/api/work-executions" && init?.method === "POST",
    )!;
    expect(JSON.parse(String(start[1]?.body))).toEqual({ draftId: "draft_old" });
  });

  it("renders nothing when the service has no approved work to show", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse({ code: "NOT_FOUND" }, 404));
    const { container } = render(<WorkExecutions signedIn fetcher={fetcher} />);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("explains stopped and paused runs in plain words", () => {
    const base = { ...waitingExecution, proposals: [] };
    expect(
      executionStatusLine({ ...base, status: "interrupted", error: "PROVIDER_DISCONNECTED" }),
    ).toBe("Paused — the provider was disconnected. Restart it when you are ready.");
    expect(executionStatusLine({ ...base, status: "failed", error: "TURN_BUDGET_EXHAUSTED" })).toBe(
      "Stopped — it used all 10 turns without finishing.",
    );
    expect(executionStatusLine({ ...base, status: "working", turnCount: 2 })).toBe(
      "Working — turn 3 of 10.",
    );
  });
});

describe("GitHub tool connection", () => {
  it("connects with a token, never shows it back, and can disconnect", async () => {
    const token = "github_pat_component_test_only_0123";
    let connected = false;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session") return jsonResponse({ authenticated: true });
      if (url === "/api/providers") {
        return jsonResponse({
          providers: [
            { id: "openai", status: "disconnected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "automatic" },
        });
      }
      if (url === "/api/integrations") {
        return jsonResponse({
          integrations: [{ id: "github", status: connected ? "connected" : "disconnected" }],
        });
      }
      if (url === "/api/integrations/github" && init?.method === "POST") {
        connected = true;
        return jsonResponse({ id: "github", status: "connected" }, 201);
      }
      if (url === "/api/integrations/github" && init?.method === "DELETE") {
        connected = false;
        return jsonResponse({ id: "github", status: "disconnected" });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    const { container } = render(<HostedWorkspace fetcher={fetcher} />);

    expect(await screen.findByRole("heading", { name: "Tool connections" })).toBeVisible();
    expect(screen.getByText(/fine-grained token limited to the repositories/)).toBeVisible();
    await user.type(screen.getByLabelText("GitHub fine-grained token"), token);
    await user.click(screen.getByRole("button", { name: "Connect GitHub" }));
    expect(
      await screen.findByText("GitHub connected. The token is not shown again."),
    ).toBeVisible();
    expect(screen.getByLabelText("GitHub fine-grained token")).toHaveValue("");
    expect(container.textContent).not.toContain(token);
    const post = fetcher.mock.calls.find(
      ([input, init]) => String(input) === "/api/integrations/github" && init?.method === "POST",
    )!;
    expect(JSON.parse(String(post[1]?.body))).toEqual({ token });

    await user.click(screen.getByRole("button", { name: "Disconnect GitHub" }));
    expect(await screen.findByText("GitHub disconnected.")).toBeVisible();
  });
});
