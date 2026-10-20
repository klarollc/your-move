import { useCallback, useEffect, useState, type FormEvent } from "react";

import "./provider-settings.css";
import "./integration-settings.css";

// R4 Track D: "Continue with ChatGPT" (sign in on your own computer, import here) and the lamp's
// Ollama endpoint. Rendered in the R3 connection style; only the triage surface is in Lit Windows.

type PlanView = {
  status: "disconnected" | "connected" | "needs_reauth";
  active: boolean;
  email: string | null;
  limitReachedAt: string | null;
  inUseLabel: string;
  manageUsageUrl: string;
};

type LampView = {
  endpoint: { baseUrl: string; configured: boolean; tokenSet: boolean };
  model: string;
  degraded: boolean;
  failures: number;
  latency: { count: number; p50Ms: number | null; p95Ms: number | null };
};
type SelectedPanel = "all" | "plan" | "lamp" | null;
type ConnectionId = "openai-plan" | "ollama";

async function requestJson<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; body: (T & { code?: string }) | undefined }> {
  const response = await fetcher(url, {
    ...init,
    credentials: "same-origin",
    headers:
      init.body === undefined
        ? (init.headers ?? {})
        : { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await response.json().catch(() => undefined)) as
    (T & { code?: string }) | undefined;
  return { ok: response.ok, body };
}

const planErrors: Record<string, string> = {
  PLAN_IMPORT_INVALID:
    "That is not a credential from siwc:login. Copy the whole line and try again.",
  PLAN_SCOPE_MISSING:
    "ChatGPT plan use was not allowed at sign-in. Run siwc:login again and allow it, or keep using your API key.",
  INVALID_CREDENTIALS: "OpenAI did not accept that credential. Run siwc:login again.",
  PROVIDER_UNAVAILABLE: "OpenAI could not be reached. Try again in a moment.",
};

const lampErrors: Record<string, string> = {
  LAMP_ENDPOINT_INVALID: "Enter an http or https address, without a username or password in it.",
  LAMP_ENDPOINT_UNREACHABLE:
    "Nothing answered at that address. Check that Ollama is running there.",
  LAMP_ENDPOINT_AUTH_REJECTED: "The address answered, but refused the token.",
  LAMP_MODEL_MISSING:
    "Ollama answered, but qwen3:8b is not installed there. Run: ollama pull qwen3:8b",
};

export function PlanAndLampSettings({
  signedIn,
  fetcher = globalThis.fetch,
  selectedPanel = "all",
  onStatusChange,
}: Readonly<{
  signedIn: boolean;
  fetcher?: typeof fetch;
  selectedPanel?: SelectedPanel;
  onStatusChange?: (connection: ConnectionId, status: string) => void;
}>) {
  const [plan, setPlan] = useState<PlanView | undefined>();
  const [lamp, setLamp] = useState<LampView | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [bundle, setBundle] = useState("");
  const [welcome, setWelcome] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [planError, setPlanError] = useState("");
  const [lampError, setLampError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoaded(false);
    onStatusChange?.("openai-plan", "Checking");
    onStatusChange?.("ollama", "Checking");
    try {
      const [planResult, lampResult] = await Promise.all([
        requestJson<PlanView>(fetcher, "/api/chatgpt-plan"),
        requestJson<LampView>(fetcher, "/api/lamp"),
      ]);
      if (planResult.ok && planResult.body?.status) {
        setPlan(planResult.body);
        onStatusChange?.(
          "openai-plan",
          planResult.body.status === "needs_reauth"
            ? "Needs reconnection"
            : planResult.body.status === "connected"
              ? planResult.body.active
                ? "Using ChatGPT plan"
                : "Connected, not in use"
              : "Not connected",
        );
      } else {
        onStatusChange?.("openai-plan", "Status unavailable");
      }
      if (lampResult.ok && lampResult.body?.endpoint) {
        setLamp(lampResult.body);
        setBaseUrl((current) => current || lampResult.body!.endpoint.baseUrl);
        onStatusChange?.(
          "ollama",
          lampResult.body.endpoint.configured ? "Connected" : "Using default address",
        );
      } else {
        onStatusChange?.("ollama", "Status unavailable");
      }
    } catch {
      onStatusChange?.("openai-plan", "Status unavailable");
      onStatusChange?.("ollama", "Status unavailable");
    } finally {
      setLoaded(true);
    }
  }, [fetcher, onStatusChange]);

  useEffect(() => {
    if (!signedIn) {
      setPlan(undefined);
      setLamp(undefined);
      setBundle("");
      setToken("");
      setLoaded(false);
      return;
    }
    void load();
  }, [signedIn, load]);

  useEffect(() => {
    setMessage("");
  }, [selectedPanel]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } finally {
      setBusy(false);
      await load();
    }
  }

  const importPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPlanError("");
    void run(async () => {
      try {
        const { ok, body } = await requestJson<PlanView>(fetcher, "/api/chatgpt-plan/import", {
          method: "POST",
          body: JSON.stringify({ bundle }),
        });
        if (!ok) {
          setPlanError(planErrors[body?.code ?? ""] ?? "Could not connect your ChatGPT plan.");
          return;
        }
        setWelcome(true);
      } catch {
        setPlanError("Could not connect your ChatGPT plan. Try again.");
      } finally {
        setBundle("");
      }
    });
  };

  const setActive = (active: boolean) =>
    run(async () => {
      const { ok } = await requestJson(fetcher, "/api/chatgpt-plan/active", {
        method: "POST",
        body: JSON.stringify({ active }),
      });
      setMessage(
        ok
          ? active
            ? "New turns run on your ChatGPT plan."
            : "New turns run on your API key."
          : "That did not go through. Try again.",
      );
    });

  const disconnectPlan = () =>
    run(async () => {
      const { ok, body } = await requestJson<{ revoked?: boolean }>(fetcher, "/api/chatgpt-plan", {
        method: "DELETE",
      });
      if (!ok) {
        setPlanError("Could not disconnect. Try again.");
        return;
      }
      setWelcome(false);
      setMessage(
        body?.revoked
          ? "ChatGPT disconnected. The saved sign-in was deleted and revoked."
          : "ChatGPT disconnected and deleted here. OpenAI did not confirm the revocation; you can also disconnect the app in ChatGPT settings.",
      );
    });

  const saveLamp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLampError("");
    void run(async () => {
      try {
        const { ok, body } = await requestJson<{ baseUrl: string }>(fetcher, "/api/lamp/endpoint", {
          method: "POST",
          body: JSON.stringify({ baseUrl, ...(token ? { token } : {}) }),
        });
        if (!ok) {
          setLampError(lampErrors[body?.code ?? ""] ?? "Could not check that address.");
          return;
        }
        setMessage("The lamp is connected. The token is not shown again.");
      } catch {
        setLampError("Could not check that address. Try again.");
      } finally {
        setToken("");
      }
    });
  };

  if (!signedIn || selectedPanel === null) return null;

  const showPlan = selectedPanel === "all" || selectedPanel === "plan";
  const showLamp = selectedPanel === "all" || selectedPanel === "lamp";
  const title =
    selectedPanel === "plan"
      ? "ChatGPT plan"
      : selectedPanel === "lamp"
        ? "Ollama"
        : "Your plan and the lamp";

  return (
    <section
      className="provider-settings integration-settings plan-lamp-sheet"
      aria-labelledby="plan-lamp-title"
    >
      <div className="provider-settings__section">
        <h2 id="plan-lamp-title">{title}</h2>
        <div className="provider-settings__providers">
          {showPlan && plan ? (
            <fieldset className="provider-settings__provider">
              <legend>Use your ChatGPT plan</legend>
              {plan.status === "connected" ? (
                <>
                  <p className="provider-settings__provider-status">
                    <strong>{plan.active ? plan.inUseLabel : "Connected, not in use"}</strong>
                    <span>
                      {plan.email ? `Signed in as ${plan.email}. ` : ""}
                      <a href={plan.manageUsageUrl} target="_blank" rel="noreferrer">
                        Manage usage
                      </a>
                    </span>
                  </p>
                  {welcome ? (
                    <div className="provider-settings__hint" role="status">
                      <strong>You&apos;re using your ChatGPT plan.</strong> Eligible usage in this
                      app uses your ChatGPT plan. Manage usage in your ChatGPT settings.{" "}
                      <button
                        type="button"
                        className="provider-settings__quiet"
                        onClick={() => setWelcome(false)}
                      >
                        Got it
                      </button>
                    </div>
                  ) : null}
                  {plan.limitReachedAt ? (
                    <div className="provider-settings__error" role="alert">
                      <strong>ChatGPT — usage limit reached.</strong> Review your plan or this
                      app&apos;s limit in ChatGPT settings.{" "}
                      <a href={plan.manageUsageUrl} target="_blank" rel="noreferrer">
                        Manage usage
                      </a>
                    </div>
                  ) : null}
                  <div className="provider-settings__key-row">
                    {plan.active ? (
                      <button type="button" disabled={busy} onClick={() => void setActive(false)}>
                        Use my API key instead
                      </button>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => void setActive(true)}>
                        Use my ChatGPT plan
                      </button>
                    )}
                    <button
                      type="button"
                      className="provider-settings__quiet"
                      disabled={busy}
                      onClick={() => void disconnectPlan()}
                    >
                      Disconnect ChatGPT
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="provider-settings__provider-status">
                    <strong>
                      {plan.status === "needs_reauth" ? "Sign in again" : "Not connected"}
                    </strong>
                    <span>
                      Complete eligible AI requests in this app with usage included in your ChatGPT
                      plan or credits balance.
                    </span>
                  </p>
                  <form onSubmit={importPlan}>
                    <ol className="provider-settings__hint">
                      <li>
                        On your own computer, in this project, run <code>npm run siwc:login</code>.
                        Sign in with ChatGPT in the browser it opens.
                      </li>
                      <li>It saves one line to a file only you can read. Paste that line below.</li>
                    </ol>
                    <label htmlFor="chatgpt-credential">Credential from siwc:login</label>
                    <textarea
                      id="chatgpt-credential"
                      rows={3}
                      value={bundle}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => setBundle(event.currentTarget.value)}
                    />
                    <div className="provider-settings__key-row">
                      <button type="submit" disabled={busy || !bundle.trim()}>
                        {busy ? "Checking…" : "Continue with ChatGPT"}
                      </button>
                    </div>
                    <span className="provider-settings__hint">
                      The sign-in is encrypted here and refreshed by this server; it is never shown
                      again. Signing in again later loses nothing.
                    </span>
                    {planError ? (
                      <p className="provider-settings__error" role="alert">
                        {planError}
                      </p>
                    ) : null}
                  </form>
                </>
              )}
            </fieldset>
          ) : showPlan && selectedPanel !== "all" ? (
            <p className="ym3c__status-unavailable" role="status">
              {loaded ? "Status unavailable" : "Checking…"}
            </p>
          ) : null}

          {showLamp && lamp ? (
            <fieldset className="provider-settings__provider">
              <legend>The lamp</legend>
              <p className="provider-settings__provider-status">
                <strong>
                  {lamp.endpoint.configured ? "Connected" : "Using the default address"}
                </strong>
                <span>
                  {lamp.endpoint.baseUrl} · {lamp.model}
                  {lamp.endpoint.tokenSet ? " · token saved" : ""}
                  {lamp.failures > 0 ? ` · ${lamp.failures} could not be checked` : ""}
                </span>
              </p>
              <form onSubmit={saveLamp}>
                <label htmlFor="lamp-endpoint">Your Ollama address</label>
                <input
                  id="lamp-endpoint"
                  type="url"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.currentTarget.value)}
                />
                <label htmlFor="lamp-token">Token (optional)</label>
                <div className="provider-settings__key-row">
                  <input
                    id="lamp-token"
                    type="password"
                    autoComplete="new-password"
                    value={token}
                    onChange={(event) => setToken(event.currentTarget.value)}
                  />
                  <button type="submit" disabled={busy || !baseUrl.trim()}>
                    {busy ? "Checking…" : "Check and save"}
                  </button>
                </div>
                <span className="provider-settings__hint">
                  Ollama evaluates lamp signals; it does not perform agent work. The lamp runs
                  qwen3:8b on an Ollama you provide. This server must be able to reach it: a hosted
                  server cannot see your computer&apos;s localhost. Ollama has no sign-in of its
                  own, so a public address should sit behind a tunnel or proxy that checks this
                  token — without one, anyone who finds the address can use it.
                </span>
                {lampError ? (
                  <p className="provider-settings__error" role="alert">
                    {lampError}
                  </p>
                ) : null}
              </form>
            </fieldset>
          ) : showLamp && selectedPanel !== "all" ? (
            <p className="ym3c__status-unavailable" role="status">
              {loaded ? "Status unavailable" : "Checking…"}
            </p>
          ) : null}
        </div>
        <p className="provider-settings__feedback" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </section>
  );
}
