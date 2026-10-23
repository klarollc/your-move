import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostedWorkspace } from "./hosted-workspace.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe("HostedWorkspace layout", () => {
  it("places work inside the hosted scroll container and exposes Connections navigation", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ authenticated: true });
      }
      if (url === "/api/providers") {
        return jsonResponse({
          providers: [
            { id: "openai", status: "disconnected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "automatic" },
        });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const { container } = render(<HostedWorkspace fetcher={fetcher} />);

    const panel = await screen.findByRole("heading", { name: "New work" });
    const scroller = container.querySelector(".hosted-workspace");
    expect(scroller).not.toBeNull();
    expect(scroller?.contains(panel)).toBe(true);
    expect(screen.getByRole("button", { name: "Connections" })).toBeVisible();
    expect(scroller?.querySelector(".provider-settings")).toBeNull();
  });
});

describe("HostedWorkspace theme mode", () => {
  it("follows the OS until the owner chooses and persists a theme", async () => {
    const listeners: ((event: MediaQueryListEvent) => void)[] = [];
    const media = {
      matches: true,
      media: "(prefers-color-scheme: dark)",
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.push(listener);
      },
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    const fetcher = vi.fn<typeof fetch>(async (input) => {
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
      if (url === "/api/work-drafts") return jsonResponse({ drafts: [] });
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();

    const firstMount = render(<HostedWorkspace fetcher={fetcher} openFeed={() => () => {}} />);
    expect(await screen.findByRole("heading", { name: "New work" })).toBeVisible();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    listeners[0]?.({ matches: false } as MediaQueryListEvent);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "light"));

    await user.click(screen.getByRole("button", { name: "Dark mode" }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
    expect(window.localStorage.getItem("your-move-theme")).toBe("dark");

    listeners[0]?.({ matches: false } as MediaQueryListEvent);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
    firstMount.unmount();

    render(<HostedWorkspace fetcher={fetcher} openFeed={() => () => {}} />);
    expect(await screen.findByRole("heading", { name: "New work" })).toBeVisible();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});

describe("HostedWorkspace owner session", () => {
  it("shows the work-creation panel after sign-in without a page reload", async () => {
    let authenticated = false;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ authenticated });
      }
      if (url === "/api/session" && init?.method === "POST") {
        authenticated = true;
        return jsonResponse({ authenticated: true });
      }
      if (url === "/api/providers") {
        return jsonResponse({
          providers: [
            { id: "openai", status: "disconnected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "automatic" },
        });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<HostedWorkspace fetcher={fetcher} />);

    // Signed out: no work-creation panel.
    expect(await screen.findByRole("heading", { name: "Owner sign in" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "New work" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Owner password"), "owner-test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    // Signed in, same page: the work panel renders with the prose-first entry point.
    expect(await screen.findByRole("heading", { name: "New work" })).toBeVisible();
    expect(screen.getByLabelText(/What should get done/)).toBeInTheDocument();
  });

  it("renders the work-creation panel immediately for an already-signed-in session", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ authenticated: true });
      }
      if (url === "/api/providers") {
        return jsonResponse({
          providers: [
            { id: "openai", status: "disconnected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "automatic" },
        });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    render(<HostedWorkspace fetcher={fetcher} />);

    expect(await screen.findByRole("heading", { name: "New work" })).toBeVisible();
  });

  it("does not show the stale 'not included in this hosted setup stage' footer", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ authenticated: true });
      }
      if (url === "/api/providers") {
        return jsonResponse({
          providers: [
            { id: "openai", status: "disconnected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "automatic" },
        });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    render(<HostedWorkspace fetcher={fetcher} />);

    await screen.findByRole("heading", { name: "New work" });
    expect(screen.queryByText(/not included in this hosted setup stage/)).not.toBeInTheDocument();
  });

  it("switches between Work and Connections and renders only the selected connection sheet", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
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
      if (url === "/api/chatgpt-plan") {
        return jsonResponse({
          status: "disconnected",
          active: false,
          email: null,
          limitReachedAt: null,
          inUseLabel: "Using ChatGPT plan",
          manageUsageUrl: "https://chatgpt.com/settings/usage",
        });
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
      if (url === "/api/integrations") {
        return jsonResponse({ integrations: [{ id: "github", status: "disconnected" }] });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<HostedWorkspace fetcher={fetcher} />);

    expect(await screen.findByRole("heading", { name: "New work" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Connections" }));

    expect(screen.getByRole("heading", { name: "Connections" })).toBeVisible();
    expect(screen.queryByLabelText("Anthropic API key")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open Anthropic settings" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByLabelText("GitHub fine-grained token")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Anthropic settings" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Anthropic settings" }));
    expect(screen.getByLabelText("Anthropic API key")).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Anthropic settings" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close Anthropic settings" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Close Anthropic settings" }));
    expect(screen.queryByLabelText("Anthropic API key")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /OpenAI \/ ChatGPT plan/ }));
    await user.click(screen.getByRole("button", { name: "Open OpenAI settings" }));
    expect(screen.getByLabelText("OpenAI API key")).toBeVisible();
    expect(screen.queryByLabelText("Credential from siwc:login")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import ChatGPT credential" }));
    expect(screen.getByLabelText("Credential from siwc:login")).toBeVisible();
    expect(screen.queryByLabelText("OpenAI API key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Your Ollama address")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("GitHub fine-grained token")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close OpenAI settings" }));

    await user.click(screen.getByRole("button", { name: /^Ollama/ }));
    await user.click(screen.getByRole("button", { name: "Open Ollama settings" }));
    expect(screen.getByLabelText("Your Ollama address")).toBeVisible();
    expect(screen.queryByLabelText("OpenAI API key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Credential from siwc:login")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^GitHub/ }));
    expect(screen.getByRole("button", { name: "Open GitHub settings" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByLabelText("Your Ollama address")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open GitHub settings" }));
    expect(screen.getByRole("button", { name: "Close GitHub settings" })).toBeVisible();
    expect(screen.getByLabelText("GitHub fine-grained token")).toBeVisible();
    expect(screen.queryByLabelText("Your Ollama address")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Work" }));
    expect(screen.getByRole("heading", { name: "New work" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Connections" })).not.toBeInTheDocument();
  });

  it("keeps the settings tab in Connections layout and closes the overlay on backdrop click", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === "/api/session") return jsonResponse({ authenticated: true });
      if (url === "/api/providers")
        return jsonResponse({
          providers: [
            { id: "openai", status: "disconnected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "automatic" },
        });
      if (url === "/api/chatgpt-plan")
        return jsonResponse({ status: "disconnected", active: false, email: null });
      if (url === "/api/lamp")
        return jsonResponse({
          endpoint: { baseUrl: "", configured: false, tokenSet: false },
          model: "qwen3:8b",
          degraded: false,
          failures: 0,
          latency: { count: 0, p50Ms: null, p95Ms: null },
        });
      if (url === "/api/integrations")
        return jsonResponse({ integrations: [{ id: "github", status: "disconnected" }] });
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    const { container } = render(<HostedWorkspace fetcher={fetcher} />);

    await screen.findByRole("heading", { name: "New work" });
    await user.click(screen.getByRole("button", { name: "Connections" }));
    const tab = screen.getByRole("button", { name: "Open Anthropic settings" });
    const layout = container.querySelector(".ym3c__layout");
    expect(layout?.contains(tab)).toBe(true);
    expect(tab).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".ym3c__sheet")).toBeNull();

    await user.click(tab);
    expect(screen.getByRole("dialog", { name: "Anthropic settings" })).toBeVisible();
    await user.click(container.querySelector(".ym3c__drawer-backdrop")!);
    expect(screen.queryByRole("dialog", { name: "Anthropic settings" })).not.toBeInTheDocument();
  });

  it("approves without sending an empty JSON body (Fastify rejects content-type with no body)", async () => {
    const draftView = {
      id: "draft_test",
      status: "draft",
      description: "Test work",
      prose: { achieve: "Outcome", inScope: ["Scope"], outOfScope: [], doneWhen: ["Done"] },
      revision: 1,
      updatedAt: "2026-10-19T00:00:00.000Z",
      approvedAt: null,
    };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ authenticated: true });
      }
      if (url === "/api/providers") {
        return jsonResponse({
          providers: [
            { id: "openai", status: "connected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "automatic" },
        });
      }
      if (url === "/api/providers/openai/models/refresh") return jsonResponse({ models: [] });
      if (url === "/api/work-drafts" && init?.method === "POST")
        return jsonResponse(draftView, 201);
      if (url === "/api/work-drafts/draft_test/approve" && init?.method === "POST") {
        // Mirror Fastify: a request that declares JSON with an empty body is rejected.
        const declaresJson = new Headers(init.headers).get("content-type") === "application/json";
        if (declaresJson && (init.body === undefined || init.body === "")) {
          return jsonResponse({ code: "FST_ERR_CTP_EMPTY_JSON_BODY" }, 400);
        }
        return jsonResponse({
          ...draftView,
          status: "approved",
          approvedAt: "2026-10-19T00:00:01.000Z",
        });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<HostedWorkspace fetcher={fetcher} />);

    await user.type(await screen.findByLabelText(/What should get done/), "Test work");
    await user.click(screen.getByRole("button", { name: "Draft it" }));
    // The draft opens as a sheet in the sheet position, and the slip holds no second form.
    const sheet = await screen.findByRole("region", { name: "New work draft" });
    expect(screen.queryByLabelText(/What should get done/)).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      within(sheet).getByRole("heading", { name: "New work draft" }),
    );
    for (const section of [
      "What this is for",
      "What is in scope",
      "What is not included",
      "Done when",
    ]) {
      expect(within(sheet).getByRole("heading", { name: section })).toBeVisible();
    }
    expect(within(sheet).getByLabelText(/Want something changed/)).toBeVisible();
    expect(within(sheet).getByRole("button", { name: "Discard" })).toBeVisible();
    await user.click(within(sheet).getByRole("button", { name: "Approve draft" }));
    await user.click(screen.getByRole("button", { name: "Yes, approve" }));

    // Approved work joins the queue and the composer folds back to the slip.
    expect(await screen.findByText("Approved — it has joined the queue.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "New work draft" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(/What should get done/));
    const approveCall = fetcher.mock.calls.find(
      ([input, init]) =>
        String(input) === "/api/work-drafts/draft_test/approve" && init?.method === "POST",
    );
    const headers = new Headers(approveCall?.[1]?.headers);
    expect(headers.get("content-type")).toBeNull();
    expect(approveCall?.[1]?.body).toBeUndefined();
  });
});
