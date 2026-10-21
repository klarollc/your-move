import { expect, type Page } from "@playwright/test";

/**
 * Synthetic hosted API for the Your Move Work surface. Every response is routed in the browser, so
 * no spec reaches a provider, the server, or owner content. The fixtures are invented records.
 */

const at = (minute: number) => new Date(Date.UTC(2026, 9, 19, 16, minute)).toISOString();

const waitingExecution = (id: string, minute: number, question: string) => ({
  id: `exec_${id}`,
  status: "waiting-on-you",
  attempt: 1,
  turnCount: 1,
  maxTurns: 10,
  createdAt: at(minute),
  updatedAt: at(minute),
  output: question,
  error: null,
  utterances: [{ turnIndex: 1, text: question }],
  conversation: [{ role: "agent", turnIndex: 1, text: question }],
  lampVerdicts: [],
  proposals: [],
  fundedBy: "anthropic",
});

const approved = (id: string, achieve: string, execution: unknown, minute: number) => ({
  id,
  status: "approved",
  updatedAt: at(minute),
  prose: { achieve },
  execution,
});

/** The R4 walk-through item: a reply, an in-place lamp verdict, and a pending proposal. */
export const proposalDraft = {
  id: "draft_synthetic_1",
  status: "approved",
  prose: { achieve: "Add a setup section" },
  execution: {
    id: "exec_synthetic_1",
    status: "waiting-on-you",
    attempt: 1,
    turnCount: 1,
    maxTurns: 4,
    createdAt: at(0),
    updatedAt: at(1),
    output: "The setup summary is ready for your review.",
    error: null,
    utterances: [
      { turnIndex: 1, text: "Should I add a setup section?" },
      { turnIndex: 2, text: "I drafted a README change for your separate approval." },
    ],
    conversation: [
      { role: "agent", turnIndex: 1, text: "Should I add a setup section?" },
      { role: "owner", text: "Approved — summarize the change." },
      {
        role: "agent",
        turnIndex: 2,
        text: "I drafted a README change for your separate approval.",
      },
    ],
    lampVerdicts: [
      {
        utteranceId: "utterance_synthetic_1_2_1",
        turnIndex: 2,
        verdict: "lamp",
        verdictTs: "2026-10-19T17:01:00.000Z",
        ownerChoice: null,
      },
    ],
    proposals: [
      {
        id: "proposal_synthetic_1",
        tool: "github_propose_write",
        status: "pending",
        createdAt: "2026-10-19T17:00:00.000Z",
        change: {
          repo: "octo/repo",
          path: "README.md",
          message: "Add setup instructions",
          content: "## Setup\n\nInstall with npm ci.",
        },
      },
    ],
    fundedBy: "openai",
  },
};

/** A lived-in street: seven lit windows across two houses, two running, three finished. */
export function streetDrafts(): unknown[] {
  const waiting = [
    ["draft_w2", "Summarize last week's support tickets", "Which queue should I read first?"],
    ["draft_w3", "Check the pricing page for broken links", "Two links redirect. Fix or report?"],
    ["draft_w4", "Draft the October newsletter", "Should it mention the new plan?"],
    ["draft_w5", "Compare the two hosting quotes", "Do you want monthly or yearly totals?"],
    ["draft_w6", "Collect release notes for 2.4", "Is the beta flag part of 2.4?"],
    ["draft_w7", "Tidy the onboarding checklist", "May I merge the two setup steps?"],
  ].map(([id, achieve, question], index) =>
    approved(id!, achieve!, waitingExecution(id!, 10 + index, question!), 10 + index),
  );
  const running = [
    ["draft_r1", "Translate the FAQ into Spanish"],
    ["draft_r2", "Audit image alt text on the blog"],
  ].map(([id, achieve], index) =>
    approved(
      id!,
      achieve!,
      { ...waitingExecution(id!, 30 + index, "Working."), status: "working", turnCount: 2 },
      30 + index,
    ),
  );
  const done = [
    ["draft_d1", "Rename the staging bucket"],
    ["draft_d2", "List open invoices over 30 days"],
    ["draft_d3", "Archive the 2024 roadmap"],
  ].map(([id, achieve], index) =>
    approved(
      id!,
      achieve!,
      { ...waitingExecution(id!, 40 + index, "Done."), status: "done", turnCount: 3 },
      40 + index,
    ),
  );
  return [proposalDraft, ...waiting, ...running, ...done];
}

/** The draft the composer receives for "Draft it". */
export const composedDraft = {
  id: "draft_composed_1",
  status: "draft",
  description: "Add a changelog page to the docs site",
  prose: {
    achieve: "Add a changelog page to the docs site that lists each release.",
    inScope: [
      "A new docs page listing releases, newest first",
      "One heading and a short summary per release",
    ],
    outOfScope: ["Rewriting older release notes"],
    doneWhen: ["The page builds and links from the docs sidebar"],
  },
  revision: 1,
  updatedAt: at(50),
  approvedAt: null,
  execution: null,
  materials: null,
};

export async function routeHostedApi(
  page: Page,
  drafts: () => unknown[] = () => [proposalDraft],
): Promise<void> {
  let authenticated = false;
  await page.addInitScript(() => {
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    let body: unknown;
    let status = 200;
    if (pathname === "/api/session" && method === "GET") {
      body = { authenticated };
    } else if (pathname === "/api/session" && method === "POST") {
      authenticated = true;
      body = { authenticated: true };
    } else if (pathname === "/api/providers" && method === "GET") {
      body = {
        providers: [
          { id: "openai", status: "disconnected" },
          { id: "anthropic", status: "disconnected" },
        ],
        modelSelection: { mode: "automatic" },
      };
    } else if (pathname === "/api/work-drafts" && method === "GET") {
      body = { drafts: drafts() };
    } else if (pathname === "/api/work-drafts" && method === "POST") {
      body = composedDraft;
      status = 201;
    } else if (pathname === "/api/chatgpt-plan" && method === "GET") {
      body = {
        status: "disconnected",
        active: false,
        email: null,
        limitReachedAt: null,
        inUseLabel: "Using ChatGPT plan",
        manageUsageUrl: "https://chatgpt.com/settings/usage",
      };
    } else if (pathname === "/api/lamp" && method === "GET") {
      body = {
        endpoint: { baseUrl: "", configured: false, tokenSet: false },
        model: "qwen3:8b",
        degraded: false,
        failures: 0,
        latency: { count: 0, p50Ms: null, p95Ms: null },
      };
    } else if (pathname === "/api/integrations" && method === "GET") {
      body = { integrations: [{ id: "github", status: "disconnected" }] };
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: '{"code":"NOT_FOUND"}',
      });
      return;
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
}

/** Signs in with a synthetic password the routed API accepts, and waits for the Work surface. */
export async function signIn(page: Page, origin = ""): Promise<void> {
  await page.goto(`${origin}/hosted.html`);
  await page.getByLabel("Owner password").fill("synthetic-capture-only");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("group", { name: "Work view" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
