import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

    const panel = await screen.findByRole("heading", { name: "Describe the work" });
    const scroller = container.querySelector(".hosted-workspace");
    expect(scroller).not.toBeNull();
    expect(scroller?.contains(panel)).toBe(true);
    expect(screen.getByRole("button", { name: "Connections" })).toBeVisible();
    expect(scroller?.querySelector(".provider-settings")).toBeNull();
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
    expect(screen.queryByRole("heading", { name: "Describe the work" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Owner password"), "owner-test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    // Signed in, same page: the work panel renders with the prose-first entry point.
    expect(await screen.findByRole("heading", { name: "Describe the work" })).toBeVisible();
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

    expect(await screen.findByRole("heading", { name: "Describe the work" })).toBeVisible();
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

    await screen.findByRole("heading", { name: "Describe the work" });
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

    expect(await screen.findByRole("heading", { name: "Describe the work" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Connections" }));

    expect(screen.getByRole("heading", { name: "Connections" })).toBeVisible();
    expect(screen.getByLabelText("Anthropic API key")).toBeVisible();
    expect(screen.queryByLabelText("GitHub fine-grained token")).not.toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: /connection sheet/i })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /OpenAI \/ ChatGPT plan/ }));
    expect(screen.getByLabelText("OpenAI API key")).toBeVisible();
    expect(screen.queryByLabelText("Credential from siwc:login")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import ChatGPT credential" }));
    expect(screen.getByLabelText("Credential from siwc:login")).toBeVisible();
    expect(screen.queryByLabelText("OpenAI API key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Your Ollama address")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("GitHub fine-grained token")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Ollama/ }));
    expect(screen.getByLabelText("Your Ollama address")).toBeVisible();
    expect(screen.queryByLabelText("OpenAI API key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Credential from siwc:login")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^GitHub/ }));
    expect(screen.getByLabelText("GitHub fine-grained token")).toBeVisible();
    expect(screen.queryByLabelText("Your Ollama address")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Work" }));
    expect(screen.getByRole("heading", { name: "Describe the work" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Connections" })).not.toBeInTheDocument();
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
    await user.click(await screen.findByRole("button", { name: "Approve this work" }));
    await user.click(screen.getByRole("button", { name: "Yes, approve" }));

    expect(await screen.findByRole("heading", { name: "Work approved" })).toBeVisible();
    const approveCall = fetcher.mock.calls.find(
      ([input, init]) =>
        String(input) === "/api/work-drafts/draft_test/approve" && init?.method === "POST",
    );
    const headers = new Headers(approveCall?.[1]?.headers);
    expect(headers.get("content-type")).toBeNull();
    expect(approveCall?.[1]?.body).toBeUndefined();
  });
});
