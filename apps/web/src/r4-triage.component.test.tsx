import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostedWorkspace } from "./hosted-workspace.js";
import {
  NOTHING_GOES_OUT,
  WorkExecutions,
  availableActions,
  buildStreet,
  windowLight,
  type ExecutionStatus,
  type ExecutionView,
} from "./work-executions.js";

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

const noFeed = () => () => undefined;
const prose = (achieve: string) => ({ achieve, inScope: [], outOfScope: [], doneWhen: [] });
const run = (overrides: Partial<ExecutionView> = {}): ExecutionView => ({
  id: "exec_1",
  status: "waiting-on-you",
  attempt: 1,
  turnCount: 2,
  maxTurns: 10,
  output: "Which branch should I use?",
  error: null,
  proposals: [],
  fundedBy: "chatgpt_plan",
  utterances: [
    { turnIndex: 1, text: "Reading the README first." },
    { turnIndex: 2, text: "Which branch should I use?" },
  ],
  lampVerdicts: [],
  ...overrides,
});

function serve(
  drafts: () => unknown[],
  extra?: (url: string, init?: RequestInit) => Response | undefined,
) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const handled = extra?.(url, init);
    if (handled) return handled;
    if (url === "/api/work-drafts") return jsonResponse({ drafts: drafts() });
    return jsonResponse({ code: "NOT_FOUND" }, 404);
  });
}

describe("triage actions (R4 Track C invariant)", () => {
  const statuses: ExecutionStatus[] = [
    "queued",
    "working",
    "waiting-on-you",
    "done",
    "failed",
    "interrupted",
  ];

  it("gives every status at least one action, and the exact ones the server accepts", () => {
    expect(availableActions(null)).toEqual(["start"]);
    for (const status of statuses) {
      expect(availableActions(run({ status })).length).toBeGreaterThan(0);
    }
    expect(availableActions(run({ status: "queued" }))).toEqual(["close"]);
    expect(availableActions(run({ status: "working" }))).toEqual(["close"]);
    expect(availableActions(run())).toEqual(["reply", "close"]);
    expect(availableActions(run({ turnCount: 10 }))).toEqual(["close"]);
    const pending = {
      id: "p",
      tool: "github_propose_write",
      status: "pending" as const,
      change: { repo: "o/r", path: "a", message: "m", content: "c" },
    };
    expect(availableActions(run({ proposals: [pending] }))).toEqual(["approve", "deny", "close"]);
    expect(availableActions(run({ status: "failed" }))).toEqual(["restart", "close"]);
    expect(availableActions(run({ status: "interrupted" }))).toEqual(["restart", "close"]);
    expect(availableActions(run({ status: "done" }))).toEqual(["restart"]);
  });
});

describe("Lit Windows street (R4 Track E)", () => {
  it("lights only what needs the owner, pulls lit windows to the ground floor, and keeps 30 works in 6 houses", () => {
    expect(windowLight(null)).toBe("lit");
    expect(windowLight(run())).toBe("lit");
    expect(windowLight(run({ status: "failed" }))).toBe("lit");
    expect(windowLight(run({ status: "working" }))).toBe("working");
    expect(windowLight(run({ status: "queued" }))).toBe("working");
    expect(windowLight(run({ status: "done" }))).toBe("dark");
    const lampCue = {
      utteranceId: "utterance_exec_1_1_1",
      turnIndex: 1,
      verdict: "lamp" as const,
      verdictTs: "t",
      ownerChoice: null,
    };
    expect(windowLight(run({ status: "working", lampVerdicts: [lampCue] }))).toBe("lit");
    expect(
      windowLight(
        run({ status: "working", lampVerdicts: [{ ...lampCue, ownerChoice: "dismissed" }] }),
      ),
    ).toBe("working");

    const works = Array.from({ length: 30 }, (_, index) => ({
      id: `d${index}`,
      status: "approved" as const,
      prose: prose(`Work ${index}`),
      execution: run({
        id: `e${index}`,
        status: index % 3 === 0 ? "waiting-on-you" : index % 3 === 1 ? "working" : "done",
      }),
    }));
    const { houses, overflow } = buildStreet(works);
    expect(houses).toHaveLength(5);
    expect(overflow).toBe(0);
    expect(
      houses.flatMap((house) => house.items).map((item) => windowLight(item.execution)),
    ).toEqual([...Array(10).fill("lit"), ...Array(10).fill("working"), ...Array(10).fill("dark")]);
    expect(buildStreet([...works, ...works.map((w) => ({ ...w, id: `${w.id}b` }))]).overflow).toBe(
      24,
    );
  });

  it("uses periwinkle only in rules for lit windows, needs-you labels, lamp cues and the lit panel", () => {
    const css = readFileSync(resolve(process.cwd(), "apps/web/src/work-executions.css"), "utf8");
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").split("}");
    const offenders = rules.filter((rule) => {
      const [selector = "", body = ""] = rule.split("{");
      const periwinkle = /--ym-periwinkle(?!-)|--ym-periwinkle-|--ym-glow|176,\s*186,\s*255/u.test(
        body,
      );
      const tokenDefinition = selector.trim() === ".your-move";
      return periwinkle && !tokenDefinition && !/lit|needs-you|cue/u.test(selector);
    });
    expect(offenders).toEqual([]);
  });

  it("unfolds the waiting work beside the street with its reply box, and sends the reply", async () => {
    let status: ExecutionStatus = "waiting-on-you";
    const fetcher = serve(
      () => [
        {
          id: "draft_1",
          status: "approved",
          prose: prose("Add a setup section"),
          execution: run({ status }),
        },
        {
          id: "draft_2",
          status: "approved",
          prose: prose("Tidy the changelog"),
          execution: run({ id: "exec_2", status: "working" }),
        },
      ],
      (url, init) => {
        if (url === "/api/work-executions/exec_1/reply" && init?.method === "POST") {
          status = "queued";
          return jsonResponse(run({ status: "queued" }));
        }
        return undefined;
      },
    );
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);

    const panel = await screen.findByRole("region", { name: "Add a setup section" });
    expect(
      within(panel).getByText("Which branch should I use?", { selector: "blockquote" }),
    ).toBeVisible();
    expect(within(panel).getByText("Using ChatGPT plan", { exact: false })).toBeVisible();
    expect(within(panel).getByRole("link", { name: "Manage usage" })).toHaveAttribute(
      "href",
      "https://chatgpt.com/settings/usage",
    );
    expect(screen.getByRole("button", { name: "Add a setup section — needs you" })).toHaveClass(
      "your-move__window--lit",
    );
    expect(screen.getByRole("button", { name: "Tidy the changelog — working" })).toHaveClass(
      "your-move__window--working",
    );
    expect(screen.getByText("One window is lit.")).toBeVisible();

    await user.type(within(panel).getByLabelText("Your reply"), "Use main.");
    await user.click(within(panel).getByRole("button", { name: "Send" }));
    const sent = fetcher.mock.calls.find(([input]) => String(input).endsWith("/reply"))!;
    expect(JSON.parse(String(sent[1]?.body))).toEqual({ message: "Use main." });
    expect(await within(panel).findByText("Queued — the agent starts shortly.")).toBeVisible();
  });

  it("states that nothing goes out on the approval screen, says Go ahead and send, and closes with Draw the curtain", async () => {
    const proposal = {
      id: "proposal_1",
      tool: "github_propose_write",
      status: "pending" as const,
      change: { repo: "octo/repo", path: "README.md", message: "Add setup", content: "## Setup" },
    };
    let closed = false;
    const fetcher = serve(
      () => [
        {
          id: "draft_1",
          status: "approved",
          prose: prose("Add a setup section"),
          execution: closed
            ? run({ status: "done", proposals: [] })
            : run({ proposals: [proposal] }),
        },
      ],
      (url, init) => {
        if (url === "/api/work-executions/exec_1/close" && init?.method === "POST") {
          closed = true;
          return jsonResponse(run({ status: "done" }));
        }
        return undefined;
      },
    );
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    const change = await screen.findByRole("group", { name: "Proposed change to README.md" });
    expect(within(change).getByRole("button", { name: "Go ahead and send" })).toBeVisible();
    expect(within(change).getByText(NOTHING_GOES_OUT, { exact: false })).toBeVisible();
    expect(within(change).queryByRole("button", { name: /approve/i })).toBeNull();
    await user.click(within(change).getByRole("button", { name: "Draw the curtain" }));
    expect(
      fetcher.mock.calls.some(
        ([input, init]) => String(input).endsWith("/close") && init?.method === "POST",
      ),
    ).toBe(true);
    expect(await screen.findByRole("button", { name: "Pick it up again" })).toBeVisible();
  });

  it("unfolds a lamp cue with the words joined from the transcript, logs engaged, and draws the curtain on it", async () => {
    const cue = {
      utteranceId: "utterance_exec_1_1_1",
      turnIndex: 1,
      verdict: "lamp" as const,
      verdictTs: "2026-10-19T00:00:00.000Z",
      ownerChoice: null,
    };
    let dismissed = false;
    const fetcher = serve(
      () => [
        {
          id: "draft_1",
          status: "approved",
          prose: prose("Add a setup section"),
          execution: run({
            status: "working",
            output: null,
            lampVerdicts: [{ ...cue, ownerChoice: dismissed ? "dismissed" : null }],
          }),
        },
      ],
      (url, init) => {
        if (url === "/api/lamp-verdicts/utterance_exec_1_1_1/choice" && init?.method === "POST") {
          if ((JSON.parse(String(init.body)) as { choice: string }).choice === "dismissed")
            dismissed = true;
          return jsonResponse({ ok: true });
        }
        return undefined;
      },
    );
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    const lamp = await screen.findByRole("group", { name: "The lamp lit" });
    expect(within(lamp).getByText("Reading the README first.")).toBeVisible();
    await vi.waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([input, init]) =>
            String(input).endsWith("/choice") && String(init?.body).includes("engaged"),
        ),
      ).toBe(true),
    );
    await user.click(within(lamp).getByRole("button", { name: "Draw the curtain" }));
    await vi.waitFor(() =>
      expect(screen.queryByRole("group", { name: "The lamp lit" })).toBeNull(),
    );
  });

  it("refreshes when the live feed reports a verdict, and offers the list escape hatch", async () => {
    let notify: () => void = () => undefined;
    const openFeed = vi.fn((onVerdict: () => void) => {
      notify = onVerdict;
      return () => undefined;
    });
    const fetcher = serve(() => [
      {
        id: "draft_1",
        status: "approved",
        prose: prose("Add a setup section"),
        execution: run({ status: "working" }),
      },
    ]);
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={openFeed} />);
    await screen.findByText("No window is lit.");
    const before = fetcher.mock.calls.length;
    notify();
    await vi.waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(before));

    await user.click(screen.getByRole("button", { name: "See it as a list" }));
    const list = screen.getByRole("list", { name: "All approved work" });
    expect(within(list).getByText("Working — turn 3 of 10.")).toBeVisible();
  });
});

describe("Continue with ChatGPT and the lamp (R4 Track D)", () => {
  it("imports the siwc:login credential, never shows it back, and shows the in-use label", async () => {
    const secretLine = "yourmove-siwc1.secret-credential-line";
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
      const plan = {
        status: connected ? "connected" : "disconnected",
        active: connected,
        email: connected ? "owner@example.test" : null,
        limitReachedAt: null,
        inUseLabel: "Using ChatGPT plan",
        manageUsageUrl: "https://chatgpt.com/settings/usage",
      };
      if (url === "/api/chatgpt-plan") return jsonResponse(plan);
      if (url === "/api/chatgpt-plan/import" && init?.method === "POST") {
        connected = true;
        return jsonResponse({ ...plan, status: "connected" }, 201);
      }
      if (url === "/api/lamp") {
        return jsonResponse({
          endpoint: { baseUrl: "http://localhost:11434", configured: false, tokenSet: false },
          model: "qwen3:8b",
          degraded: false,
          failures: 0,
          latency: { count: 0, p50Ms: null, p95Ms: null },
        });
      }
      if (url === "/api/lamp/endpoint" && init?.method === "POST") {
        return jsonResponse(
          { baseUrl: "https://ollama.example.test", configured: true, tokenSet: true },
          201,
        );
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    const { container } = render(<HostedWorkspace fetcher={fetcher} openFeed={noFeed} />);

    await user.type(await screen.findByLabelText("Credential from siwc:login"), secretLine);
    await user.click(screen.getByRole("button", { name: "Continue with ChatGPT" }));
    expect(await screen.findByText("Using ChatGPT plan")).toBeVisible();
    expect(screen.getByText("You're using your ChatGPT plan.")).toBeVisible();
    expect(container.textContent).not.toContain(secretLine);
    const imported = fetcher.mock.calls.find(
      ([input]) => String(input) === "/api/chatgpt-plan/import",
    )!;
    expect(JSON.parse(String(imported[1]?.body))).toEqual({ bundle: secretLine });

    const address = screen.getByLabelText("Your Ollama address");
    await user.clear(address);
    await user.type(address, "https://ollama.example.test");
    await user.type(screen.getByLabelText("Token (optional)"), "tunnel-secret");
    await user.click(screen.getByRole("button", { name: "Check and save" }));
    expect(
      await screen.findByText("The lamp is connected. The token is not shown again."),
    ).toBeVisible();
    expect(screen.getByLabelText("Token (optional)")).toHaveValue("");
    const saved = fetcher.mock.calls.find(([input]) => String(input) === "/api/lamp/endpoint")!;
    expect(JSON.parse(String(saved[1]?.body))).toEqual({
      baseUrl: "https://ollama.example.test",
      token: "tunnel-secret",
    });
  });
});

describe("work materials on a draft (R4 Track B)", () => {
  it("attaches a link to the draft revision", async () => {
    const draft = {
      id: "draft_1",
      status: "draft",
      description: "d",
      prose: prose("Add a setup section"),
      revision: 1,
      updatedAt: "2026-10-19T00:00:00.000Z",
      approvedAt: null,
      execution: null,
      materials: null,
    };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session") return jsonResponse({ authenticated: true });
      if (url === "/api/providers") {
        return jsonResponse({
          providers: [
            { id: "openai", status: "connected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "automatic" },
        });
      }
      if (url === "/api/work-drafts" && init?.method === "POST") return jsonResponse(draft, 201);
      if (url === "/api/work-drafts/draft_1/materials" && init?.method === "PUT") {
        return jsonResponse({
          ...draft,
          revision: 2,
          materials: JSON.parse(String(init.body)) as unknown,
        });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<HostedWorkspace fetcher={fetcher} openFeed={noFeed} />);
    await user.type(await screen.findByLabelText(/What should get done/), "Add a setup section");
    await user.click(screen.getByRole("button", { name: "Draft it" }));
    await user.selectOptions(await screen.findByLabelText("Kind"), "url");
    await user.type(
      screen.getByLabelText("Link (http or https)"),
      "https://docs.example.com/setup",
    );
    await user.click(screen.getByRole("button", { name: "Attach" }));
    const put = await vi.waitFor(() => {
      const call = fetcher.mock.calls.find(([input]) => String(input).endsWith("/materials"));
      expect(call).toBeTruthy();
      return call!;
    });
    expect(JSON.parse(String(put[1]?.body))).toEqual({
      items: [{ kind: "url", url: "https://docs.example.com/setup" }],
    });
    expect(await screen.findByRole("list", { name: "Attached materials" })).toHaveTextContent(
      "https://docs.example.com/setup",
    );
  });
});
