import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProviderSettings } from "./provider-settings.js";

const openAIModels = [{ id: "gpt-r1-test", label: "gpt-r1-test" }];
const initialProviders = {
  providers: [
    { id: "openai", status: "disconnected" },
    { id: "anthropic", status: "disconnected" },
  ],
  modelSelection: { mode: "automatic" },
};

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

describe("ProviderSettings", () => {
  it("logs in, connects a provider without echoing its key, and supports a model override", async () => {
    const credential = "sk-r1-ui-mock-credential";
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ authenticated: false });
      }
      if (url === "/api/session" && init?.method === "POST") {
        return jsonResponse({ authenticated: true });
      }
      if (url === "/api/providers" && (!init?.method || init.method === "GET")) {
        return jsonResponse(initialProviders);
      }
      if (url === "/api/providers/openai" && init?.method === "POST") {
        return jsonResponse({ provider: "openai", status: "connected", models: openAIModels }, 201);
      }
      if (url === "/api/model-selection" && init?.method === "POST") {
        return jsonResponse(JSON.parse(String(init.body)));
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<ProviderSettings fetcher={fetcher} />);

    await user.type(await screen.findByLabelText("Owner password"), "owner-test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Provider connections" });

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("automatic");
    await user.type(screen.getByLabelText("OpenAI API key"), credential);
    await user.click(screen.getByRole("button", { name: "Connect OpenAI" }));

    expect(await screen.findByText("Connected", { selector: "strong" })).toBeVisible();
    expect((screen.getByLabelText("OpenAI API key") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText(credential)).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "OpenAI — gpt-r1-test" })).toBeInTheDocument();
    const connectCall = fetcher.mock.calls.find(
      ([input]) => String(input) === "/api/providers/openai",
    );
    expect(JSON.parse(String(connectCall?.[1]?.body))).toEqual({ apiKey: credential });

    await user.selectOptions(screen.getByRole("combobox"), "openai:gpt-r1-test");
    await waitFor(() => {
      const selectionCall = fetcher.mock.calls.find(
        ([input]) => String(input) === "/api/model-selection",
      );
      expect(JSON.parse(String(selectionCall?.[1]?.body))).toEqual({
        mode: "specific",
        provider: "openai",
        modelId: "gpt-r1-test",
      });
    });
  });

  it("shows an explicit reconnect state when a connected provider rejects its saved key", async () => {
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
      if (url === "/api/providers/openai/models/refresh" && init?.method === "POST") {
        return jsonResponse({ code: "PROVIDER_REAUTH_REQUIRED" }, 401);
      }
      if (url === "/api/providers/openai" && init?.method === "POST") {
        return jsonResponse({ provider: "openai", status: "connected", models: openAIModels }, 201);
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<ProviderSettings fetcher={fetcher} />);

    expect(await screen.findByText("Needs reauth", { selector: "strong" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reconnect OpenAI" })).toBeDisabled();
    await user.type(screen.getByLabelText("OpenAI API key"), "sk-r1-reconnect-mock");
    await user.click(screen.getByRole("button", { name: "Reconnect OpenAI" }));
    expect(await screen.findByText("Connected", { selector: "strong" })).toBeVisible();
  });

  it("disconnects a provider while leaving the saved model choice visible", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/session") return jsonResponse({ authenticated: true });
      if (url === "/api/providers" && (!init?.method || init.method === "GET")) {
        return jsonResponse({
          providers: [
            { id: "openai", status: "connected" },
            { id: "anthropic", status: "disconnected" },
          ],
          modelSelection: { mode: "specific", provider: "openai", modelId: "gpt-r1-test" },
        });
      }
      if (url === "/api/providers/openai/models/refresh" && init?.method === "POST")
        return jsonResponse({ models: openAIModels });
      if (url === "/api/providers/openai" && init?.method === "DELETE") {
        return jsonResponse({ provider: "openai", status: "disconnected" });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<ProviderSettings fetcher={fetcher} />);

    expect(await screen.findByRole("button", { name: "Disconnect OpenAI" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Disconnect OpenAI" }));

    expect(
      within(screen.getByRole("group", { name: "OpenAI" })).getByText("Disconnected", {
        selector: "strong",
      }),
    ).toBeVisible();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("openai:gpt-r1-test");
  });

  it("allows immediate disconnect after a provider enters needs-reauth", async () => {
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
      if (url === "/api/providers/openai/models/refresh" && init?.method === "POST") {
        return jsonResponse({ code: "PROVIDER_REAUTH_REQUIRED" }, 401);
      }
      if (url === "/api/providers/openai" && init?.method === "DELETE") {
        return jsonResponse({ provider: "openai", status: "disconnected" });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const user = userEvent.setup();
    render(<ProviderSettings fetcher={fetcher} />);

    await screen.findByText("Needs reauth", { selector: "strong" });
    await user.click(screen.getByRole("button", { name: "Disconnect OpenAI" }));

    expect(
      within(screen.getByRole("group", { name: "OpenAI" })).getByText("Disconnected", {
        selector: "strong",
      }),
    ).toBeVisible();
  });
});
