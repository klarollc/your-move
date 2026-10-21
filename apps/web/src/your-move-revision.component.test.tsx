import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const scene = () => screen.getByRole("group", { name: "The street" });

describe("Your Move waiting-work revision", () => {
  it.each([0, 5, 15])("renders truthful Street capacity for %i waiting items", async (count) => {
    render(<WorkExecutions signedIn fetcher={fetchWork(count)} openFeed={noFeed} />);

    expect(
      await screen.findByText(
        count === 0 ? "No windows lit · nothing needs you" : `${count} windows lit · oldest first`,
      ),
    ).toBeVisible();
    expect(scene()).toBeVisible();
    expect(screen.getAllByTestId("street-window")).toHaveLength(count === 0 ? 5 : count);
    expect(within(scene()).queryAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(
      count,
    );
    expect(screen.queryByRole("button", { name: "Next houses" })).not.toBeInTheDocument();
  });

  it("shows thirty waiting items as fifteen windows per Street page and ten rows per queue page", async () => {
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetchWork(30)} openFeed={noFeed} />);

    expect(await screen.findByText("Windows 1–15 of 30 · Street page 1 of 2")).toBeVisible();
    expect(screen.getByText("30 windows lit · oldest first")).toBeVisible();
    expect(within(scene()).getAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(15);
    await user.click(screen.getByRole("button", { name: "Next houses" }));
    expect(screen.getByText("Windows 16–30 of 30 · Street page 2 of 2")).toBeVisible();
    expect(within(scene()).getAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(15);

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
    expect(screen.getByText("30 windows lit · oldest first")).toBeVisible();
    expect(within(scene()).getAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(15);
  });

  it("opens the matching detail by keyboard, focuses its heading, and returns focus without acknowledging it", async () => {
    const user = userEvent.setup();
    const fetcher = fetchWork(5);
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    await screen.findByText("5 windows lit · oldest first");

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

    await user.click(within(detail).getByRole("button", { name: "Close this sheet" }));
    expect(document.activeElement).toBe(window);
    expect(fetcher.mock.calls.some(([input]) => String(input).includes("/lamp-verdicts/"))).toBe(
      false,
    );
  });
});

describe("Your Move structural pass", () => {
  it("keeps amber for needs-you and cobalt for links, navigation, focus, and selection", () => {
    const css = readFileSync(resolve(process.cwd(), "apps/web/src/your-move-revision.css"), "utf8");
    const rules = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .filter((rule) => rule.includes("{"))
      .map((rule) => {
        const at = rule.lastIndexOf("{");
        return { selector: rule.slice(0, at).trim(), body: rule.slice(at + 1) };
      })
      // The token definitions, and the Connections surface this pass leaves untouched.
      .filter(({ selector }) => selector !== ".hosted-workspace" && !/ym3c/u.test(selector));
    const amber = rules.filter(({ body }) =>
      /--ym-window-lit|#dda64c|#efc875|221 166 76/iu.test(body),
    );
    const cobalt = rules.filter(({ body }) => /--ym-accent|#234ac4/iu.test(body));
    expect(amber.length).toBeGreaterThan(0);
    expect(
      amber.filter(({ selector }) => !/--lit|needs-you/u.test(selector)).map((r) => r.selector),
    ).toEqual([]);
    expect(
      cobalt
        .filter(
          ({ selector }) =>
            !/focus-visible|nav|switch|aria-current|aria-pressed|selected|-link/u.test(selector),
        )
        .map((r) => r.selector),
    ).toEqual([]);
  });

  it("keeps the home surface to the slip, one status line, the street, and the queue strip", async () => {
    render(<WorkExecutions signedIn fetcher={fetchWork(5)} openFeed={noFeed} />);
    await screen.findByText("5 windows lit · oldest first");

    // One brand lives in the nav; the Work surface carries no second masthead or global count.
    expect(screen.queryByText("Your Move")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Work" })).toHaveClass(
      "ym3__visually-hidden",
    );
    expect(screen.getByRole("region", { name: "New work" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Queue" })).toBeVisible();
    // No per-house chrome: no "House N" headings, counts, or item lists.
    expect(screen.queryByText(/^House \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/owner actions?$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "The street" })).not.toBeInTheDocument();
    // The table, search, filters, and the collection switch live only in List.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Filter by action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All work & history" })).not.toBeInTheDocument();
  });

  it("puts the table, search, filters, history, and the collection switch in List", async () => {
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetchWork(5)} openFeed={noFeed} />);
    await screen.findByText("5 windows lit · oldest first");
    await user.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search waiting work" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Filter by action" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "The street" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Queue" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All work & history" }));
    expect(screen.getByRole("heading", { name: "All work & history" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^Open Work/ })).toHaveLength(5);
  });

  it("makes every lit window a button and every dark window inert", async () => {
    render(<WorkExecutions signedIn fetcher={fetchWork(3)} openFeed={noFeed} />);
    await screen.findByText("3 windows lit · oldest first");

    const windows = screen.getAllByTestId("street-window");
    expect(windows).toHaveLength(5);
    const lit = windows.filter((window) => window.getAttribute("role") === "button");
    expect(lit.map((window) => window.getAttribute("data-work-id"))).toEqual([
      "work_01",
      "work_02",
      "work_03",
    ]);
    for (const window of lit) {
      expect(window).toHaveAttribute("tabindex", "0");
      expect(window).toHaveAttribute("aria-expanded", "false");
      expect(window).toHaveAttribute("aria-controls", "work-detail");
    }
    for (const window of windows.filter((candidate) => !lit.includes(candidate))) {
      expect(window).toHaveAttribute("aria-hidden", "true");
      expect(window).not.toHaveAttribute("tabindex");
    }
  });

  it("opens the sheet below the street without re-gridding, and closing selects nothing", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WorkExecutions signedIn fetcher={fetchWork(5)} openFeed={noFeed} />,
    );
    await screen.findByText("5 windows lit · oldest first");
    const street = screen.getByRole("region", { name: "Street" });
    const window = within(scene()).getByRole("button", { name: "Work 02 — Reply to the agent" });
    await user.click(window);

    const sheet = await screen.findByRole("region", { name: "Work 02" });
    expect(container.querySelector(".ym3__workspace--open")).toBeNull();
    expect(container.querySelector(".ym3__workspace")).toBeNull();
    // The sheet follows the street in document order, as a sibling, and precedes the strip.
    expect(street.parentElement).toBe(sheet.parentElement);
    expect(street.compareDocumentPosition(sheet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const strip = screen.getByRole("region", { name: "Queue" });
    expect(sheet.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(window).toHaveAttribute("aria-expanded", "true");
    // The sheet has no page chrome: no back button and no navigation kicker.
    expect(within(sheet).queryByRole("button", { name: /Back to/ })).not.toBeInTheDocument();
    expect(sheet.querySelector(".your-move__panel-kicker")).toBeNull();

    await user.click(within(sheet).getByRole("button", { name: "Close this sheet" }));
    expect(screen.queryByRole("region", { name: "Work 02" })).not.toBeInTheDocument();
    for (const candidate of within(scene()).getAllByRole("button")) {
      expect(candidate).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("opens the same sheet from a queue strip row, with lit, sage, and dark glyphs", async () => {
    const user = userEvent.setup();
    const drafts = [
      ...workDrafts(1),
      ...workDrafts(2, { status: "working", output: null }).slice(1),
      ...workDrafts(3, { status: "done", output: "Finished." }).slice(2),
    ];
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      String(input) === "/api/work-drafts"
        ? jsonResponse({ drafts })
        : jsonResponse({ code: "NOT_FOUND" }, 404),
    );
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    await screen.findByText("1 window lit · oldest first");

    const rows = screen.getAllByTestId("queue-strip-row");
    expect(rows.map((row) => row.getAttribute("data-glyph"))).toEqual(["lit", "running", "dark"]);
    expect(rows[0]).toHaveTextContent("Work 01Reply to the agent");
    expect(rows[1]).toHaveTextContent("Work 02Working — turn 2 of 10.");
    expect(rows[2]).toHaveTextContent("Work 03Done.");

    await user.click(rows[1]!);
    const sheet = await screen.findByRole("region", { name: "Work 02" });
    expect(within(sheet).getByText("No owner action is pending")).toBeVisible();
    expect(rows[1]).toHaveAttribute("aria-expanded", "true");
    await user.click(within(sheet).getByRole("button", { name: "Close this sheet" }));
    expect(document.activeElement).toBe(rows[1]);
  });

  it("keeps one sheet at a time between a new draft and opened work", async () => {
    const user = userEvent.setup();
    const draft = {
      id: "draft_new",
      status: "draft",
      description: "Tidy the changelog",
      prose: {
        achieve: "Tidy the changelog",
        inScope: ["Group entries by release"],
        outOfScope: [],
        doneWhen: ["Each release has one heading"],
      },
      revision: 1,
      updatedAt: "2026-10-01T00:00:00.000Z",
      approvedAt: null,
      execution: null,
    };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input) === "/api/work-drafts" && init?.method === "POST") {
        return jsonResponse(draft, 201);
      }
      if (String(input) === "/api/work-drafts") {
        return jsonResponse({ drafts: workDrafts(2) });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    render(<WorkExecutions signedIn fetcher={fetcher} openFeed={noFeed} />);
    await screen.findByText("2 windows lit · oldest first");

    await user.click(within(scene()).getByRole("button", { name: "Work 01 — Reply to the agent" }));
    expect(await screen.findByRole("region", { name: "Work 01" })).toBeVisible();
    await user.type(screen.getByLabelText(/What should get done/), "Tidy the changelog");
    await user.click(screen.getByRole("button", { name: "Draft it" }));

    const draftSheet = await screen.findByRole("region", { name: "New work draft" });
    expect(screen.queryByRole("region", { name: "Work 01" })).not.toBeInTheDocument();
    expect(within(draftSheet).getByText("Group entries by release")).toBeVisible();

    await user.click(within(scene()).getByRole("button", { name: "Work 02 — Reply to the agent" }));
    expect(await screen.findByRole("region", { name: "Work 02" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "New work draft" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to your draft" }));
    const restored = await screen.findByRole("region", { name: "New work draft" });
    expect(document.activeElement).toBe(
      within(restored).getByRole("heading", { name: "New work draft" }),
    );

    await user.click(within(restored).getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("region", { name: "New work draft" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(/What should get done/));
  });
});

describe("Your Move sheet details", () => {
  it("opens the same detail from List and keeps the owner-action text beside the title", async () => {
    const user = userEvent.setup();
    render(<WorkExecutions signedIn fetcher={fetchWork(5)} openFeed={noFeed} />);
    await screen.findByText("5 windows lit · oldest first");
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
    expect(await screen.findByText("No windows lit · nothing needs you")).toBeVisible();
    expect(screen.queryAllByRole("button", { name: /Reply to the agent/ })).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "List" }));
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
    await user.click(await screen.findByRole("button", { name: "List" }));
    await user.click(screen.getByRole("button", { name: "All work & history" }));
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
    await user.click(await screen.findByRole("button", { name: "List" }));
    await user.click(screen.getByRole("button", { name: "All work & history" }));
    await user.click(screen.getByRole("button", { name: "Open Work 01" }));
    const detail = await screen.findByRole("region", { name: "Work 01" });
    await user.click(within(detail).getByRole("button", { name: "Mark as seen" }));

    expect(await within(detail).findByRole("alert")).toHaveTextContent(
      "Couldn't update this lamp cue. Try again.",
    );
  });
});
