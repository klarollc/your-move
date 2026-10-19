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
  it("places the work-creation panel inside the scroll container with the provider panel", async () => {
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
    expect(scroller?.querySelector(".provider-settings")).not.toBeNull();
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
});
