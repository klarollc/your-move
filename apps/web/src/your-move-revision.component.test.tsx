import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkExecutions } from "./work-executions.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const noFeed = () => () => undefined;

type FixtureProposal = {
  id: string;
  tool: string;
  status: string;
  createdAt?: string;
  change: { repo: string; path: string; message: string; content: string };
};
type FixtureVerdict = {
  utteranceId: string;
  turnIndex: number;
  verdict: "lamp" | "no-lamp";
  verdictTs: string;
  ownerChoice: "dismissed" | "engaged" | null;
};
type FixtureConversation = { role: "agent" | "owner"; text: string; turnIndex?: number };
type DraftOptions = {
  status?: string;
  turnCount?: number;
  output?: string | null;
  proposals?: FixtureProposal[];
  utterances?: { turnIndex: number; text: string }[];
  lampVerdicts?: FixtureVerdict[];
  conversation?: FixtureConversation[];
};

function workDrafts(count: number, options: DraftOptions = {}) {
  return Array.from({ length: count }, (_, index) => {
    const id = `work_${String(index + 1).padStart(2, "0")}`;
    const timestamp = new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString();
    return {
      id,
      status: "approved",
      description: `Work ${String(index + 1).padStart(2, "0")}`,
      prose: {
        achieve: `Work ${String(index + 1).padStart(2, "0")}`,
        inScope: [],
        outOfScope: [],
        doneWhen: [],
      },
      revision: 1,
      updatedAt: timestamp,
      approvedAt: timestamp,
      execution: {
        id: `execution_${id}`,
        status: options.status ?? "waiting-on-you",
        attempt: 1,
        turnCount: options.turnCount ?? 1,
        maxTurns: 10,
        output: options.output === undefined ? `Question for work ${index + 1}` : options.output,
        error: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        proposals: options.proposals ?? [],
        fundedBy: null,
        utterances: options.utterances ?? [],
        lampVerdicts: options.lampVerdicts ?? [],
        ...(options.conversation ? { conversation: options.conversation } : {}),
      },
    };
  });
}

function fetchWork(count: number, options: DraftOptions = {}) {
  return vi.fn<typeof fetch>(async (input) => {
    if (String(input) === "/api/work-drafts") {
      return jsonResponse({ drafts: workDrafts(count, options) });
    }
    return jsonResponse({ code: "NOT_FOUND" }, 404);
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Your Move waiting-work revision", () => {
  it.each([0, 5, 15])("renders truthful Street capacity for %i waiting items", async (count) => {
    render(<WorkExecutions signedIn fetcher={fetchWork(count)} openFeed={noFeed} />);

    expect(await screen.findByRole("heading", { name: "Waiting work" })).toBeVisible();
    expect(screen.getByText(`${count} need you`)).toBeVisible();
    expect(screen.getByRole("list", { name: "The street" })).toBeVisible();
    expect(screen.getAllByTestId("street-window")).toHaveLength(count === 0 ? 5 : count);
    expect(screen.queryAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(count);

    if (count === 0) {
      expect(
        within(screen.getByRole("region", { name: "Street" })).getByText("Nothing needs you"),
      ).toBeVisible();
      expect(screen.queryByRole("button", { name: "Next houses" })).not.toBeInTheDocument();
    }
  });

  it("shows thirty waiting items as fifteen windows per Street page and ten rows per queue page", async () => {
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetchWork(30)} openFeed={noFeed} />);

    expect(await screen.findByText("Windows 1–15 of 30 · Street page 1 of 2")).toBeVisible();
    expect(screen.getByText("30 need you")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(15);
    await user.click(screen.getByRole("button", { name: "Next houses" }));
    expect(screen.getByText("Windows 16–30 of 30 · Street page 2 of 2")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(15);

    await user.click(screen.getByRole("button", { name: "List" }));
    expect(
      within(screen.getByRole("region", { name: "Waiting work" })).getAllByText("Rows 1–10 of 30"),
    ).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Open Work/ })).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: "Next queue page" }));
    expect(
      within(screen.getByRole("region", { name: "Waiting work" })).getAllByText("Rows 11–20 of 30"),
    ).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Street" }));
    expect(screen.getByText("Windows 16–30 of 30 · Street page 2 of 2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "List" }));
    expect(
      within(screen.getByRole("region", { name: "Waiting work" })).getAllByText("Rows 11–20 of 30"),
    ).toHaveLength(2);
  });

  it("searches the whole queue without changing the complete Street or extinguishing its lights", async () => {
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetchWork(30)} openFeed={noFeed} />);
    await screen.findByText("Windows 1–15 of 30 · Street page 1 of 2");

    await user.click(screen.getByRole("button", { name: "List" }));
    await user.type(screen.getByRole("searchbox", { name: "Search waiting work" }), "Work 29");
    expect(screen.getByText("Rows 1–1 of 1 · 1 matching work item")).toBeVisible();
    expect(screen.getByRole("button", { name: "Open Work 29" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Street" }));
    expect(screen.getByText("30 need you")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(15);
  });

  it("opens the matching detail by keyboard, focuses its heading, and returns focus without acknowledging it", async () => {
    const user = userEvent.setup();
    const fetcher = fetchWork(5);
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    await screen.findByText("5 need you");

    const window = screen.getByRole("button", {
      name: "Work 01 — Reply to the agent",
    });
    window.focus();
    await user.keyboard("{Enter}");
    const detail = await screen.findByRole("region", { name: "Work 01" });
    expect(
      within(detail).getByText("Question for work 1", { selector: "blockquote" }),
    ).toBeVisible();
    expect(document.activeElement).toBe(within(detail).getByRole("heading", { name: "Work 01" }));

    await user.click(within(detail).getByRole("button", { name: /Back to waiting work/ }));
    expect(document.activeElement).toBe(window);
    expect(fetcher.mock.calls.some(([input]) => String(input).includes("/lamp-verdicts/"))).toBe(
      false,
    );
  });

  it("opens the same detail from List and keeps the owner-action text beside the title", async () => {
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetchWork(5)} openFeed={noFeed} />);
    await screen.findByText("5 need you");
    await user.click(screen.getByRole("button", { name: "List" }));
    await user.click(screen.getByRole("button", { name: "Open Work 01" }));

    const detail = await screen.findByRole("region", { name: "Work 01" });
    expect(within(detail).getByText("Reply to the agent")).toBeVisible();
    expect(within(detail).getByText(/Waiting since/)).toBeVisible();
  });

  it("opens an explicit approval card for a pending proposal without offering a reply shortcut", async () => {
    const user = userEvent.setup();
    const fetcher = fetchWork(1, {
      proposals: [
        {
          id: "proposal_1",
          tool: "github_propose_write",
          status: "pending",
          createdAt: "2026-10-01T00:00:00.000Z",
          change: {
            repo: "octo/widgets",
            path: "README.md",
            message: "Add setup section",
            content: "# Setup",
          },
        },
      ],
    });
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    await user.click(await screen.findByRole("button", { name: "List" }));
    await user.click(screen.getByRole("button", { name: "Open Work 01" }));

    const detail = await screen.findByRole("region", { name: "Work 01" });
    expect(
      within(detail).getByRole("group", { name: "Proposed change to README.md" }),
    ).toBeVisible();
    expect(within(detail).getByRole("button", { name: "Go ahead and send" })).toBeVisible();
    expect(within(detail).getByRole("button", { name: "Don't send this" })).toBeVisible();
    expect(within(detail).queryByRole("textbox")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input]) => String(input).includes("/proposals/"))).toBe(false);
  });

  it("shows agent messages and the owner's sent reply in the work transcript", async () => {
    const user = userEvent.setup();
    const fetcher = fetchWork(1, {
      status: "waiting-on-you",
      turnCount: 2,
      output: "Done on main.",
      utterances: [
        { turnIndex: 1, text: "Which branch should I use?" },
        { turnIndex: 2, text: "Done on main." },
      ],
      conversation: [
        { role: "agent", turnIndex: 1, text: "Which branch should I use?" },
        { role: "owner", text: "Use main." },
        { role: "agent", turnIndex: 2, text: "Done on main." },
      ],
    });
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    await user.click(await screen.findByRole("button", { name: "List" }));
    await user.click(screen.getByRole("button", { name: "Open Work 01" }));

    const detail = await screen.findByRole("region", { name: "Work 01" });
    expect(
      within(detail).getByText("Which branch should I use?", { selector: "blockquote" }),
    ).toBeVisible();
    expect(within(detail).getByRole("group", { name: "Your reply" })).toHaveTextContent(
      "Use main.",
    );
    expect(within(detail).getByText("Done on main.", { selector: "blockquote" })).toBeVisible();
  });

  it("unfolds live lamp and no-lamp verdicts for active work in All work without lighting Street", async () => {
    const user = userEvent.setup();
    let currentVerdicts: FixtureVerdict[] = [];
    let notifyFeed: (() => void) | undefined;
    const openFeed = (listener: () => void) => {
      notifyFeed = listener;
      return () => {
        notifyFeed = undefined;
      };
    };
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/api/work-drafts") {
        return jsonResponse({
          drafts: workDrafts(1, {
            status: "working",
            turnCount: 2,
            output: null,
            utterances: [
              { turnIndex: 1, text: "Checking the setup." },
              { turnIndex: 2, text: "The setup is ready." },
            ],
            lampVerdicts: currentVerdicts,
            conversation: [
              { role: "agent", turnIndex: 1, text: "Checking the setup." },
              { role: "agent", turnIndex: 2, text: "The setup is ready." },
            ],
          }),
        });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={openFeed} />);
    expect(await screen.findByText("0 need you")).toBeVisible();
    expect(screen.queryAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "All work & history" }));
    await user.click(screen.getByRole("button", { name: "Open Work 01" }));
    const detail = await screen.findByRole("region", { name: "Work 01" });
    expect(within(detail).queryByText("No lamp signal")).not.toBeInTheDocument();

    currentVerdicts = [
      {
        utteranceId: "utterance_execution_work_01_1_1",
        turnIndex: 1,
        verdict: "no-lamp",
        verdictTs: "2026-10-01T00:01:00.000Z",
        ownerChoice: null,
      },
      {
        utteranceId: "utterance_execution_work_01_2_1",
        turnIndex: 2,
        verdict: "lamp",
        verdictTs: "2026-10-01T00:02:00.000Z",
        ownerChoice: null,
      },
    ];
    await act(async () => notifyFeed?.());

    expect(await within(detail).findByText("No lamp signal")).toBeVisible();
    expect(within(detail).getByText("Lamp verdict")).toBeVisible();
    expect(
      within(detail).getByText("Checking the setup.", { selector: "blockquote" }),
    ).toBeVisible();
    expect(
      within(detail).getByText("The setup is ready.", { selector: "blockquote" }),
    ).toBeVisible();
    expect(within(detail).getByRole("button", { name: "Mark as seen" })).toBeVisible();
  });

  it("keeps a verdict visible when its agent utterance is missing from the transcript projection", async () => {
    const user = userEvent.setup();
    const fetcher = fetchWork(1, {
      status: "working",
      turnCount: 2,
      output: null,
      utterances: [{ turnIndex: 2, text: "Recovered from the utterance record." }],
      lampVerdicts: [
        {
          utteranceId: "utterance_execution_work_01_2_1",
          turnIndex: 2,
          verdict: "lamp",
          verdictTs: "2026-10-01T00:02:00.000Z",
          ownerChoice: null,
        },
      ],
      conversation: [{ role: "agent", turnIndex: 1, text: "Earlier transcript entry." }],
    });
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    await user.click(await screen.findByRole("button", { name: "All work & history" }));
    await user.click(screen.getByRole("button", { name: "Open Work 01" }));

    const detail = await screen.findByRole("region", { name: "Work 01" });
    expect(within(detail).getByRole("group", { name: "Unmatched lamp verdict" })).toHaveTextContent(
      "Recovered from the utterance record.",
    );
  });

  it("shows an actionable error when saving a lamp verdict choice fails", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/api/work-drafts") {
        return jsonResponse({
          drafts: workDrafts(1, {
            status: "working",
            turnCount: 1,
            output: null,
            utterances: [{ turnIndex: 1, text: "Check the release notes." }],
            lampVerdicts: [
              {
                utteranceId: "utterance_execution_work_01_1_1",
                turnIndex: 1,
                verdict: "lamp",
                verdictTs: "2026-10-01T00:01:00.000Z",
                ownerChoice: null,
              },
            ],
            conversation: [{ role: "agent", turnIndex: 1, text: "Check the release notes." }],
          }),
        });
      }
      if (String(input).includes("/api/lamp-verdicts/")) {
        return jsonResponse({ code: "UNAVAILABLE" }, 503);
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    await user.click(await screen.findByRole("button", { name: "All work & history" }));
    await user.click(screen.getByRole("button", { name: "Open Work 01" }));
    const detail = await screen.findByRole("region", { name: "Work 01" });
    await user.click(within(detail).getByRole("button", { name: "Mark as seen" }));

    expect(await within(detail).findByRole("alert")).toHaveTextContent(
      "Couldn't update this lamp cue. Try again.",
    );
  });
});
