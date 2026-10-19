import { useEffect, useState, type FormEvent } from "react";

import "./provider-settings.css";

type ProviderId = "openai" | "anthropic";
type ConnectionStatus = "disconnected" | "connected" | "needs_reauth";
type ProviderModel = { id: string; label: string };
type ModelSelection =
  { mode: "automatic" } | { mode: "specific"; provider: ProviderId; modelId: string };
type ProvidersResponse = {
  providers: { id: ProviderId; status: ConnectionStatus }[];
  modelSelection: ModelSelection;
};
type LoadedProviderState = {
  statuses: Record<ProviderId, ConnectionStatus>;
  models: Record<ProviderId, ProviderModel[]>;
  selection: ModelSelection;
};

const providerIds: readonly ProviderId[] = ["openai", "anthropic"];
const providerLabels: Record<ProviderId, string> = { openai: "OpenAI", anthropic: "Anthropic" };
const defaultStatuses: Record<ProviderId, ConnectionStatus> = {
  openai: "disconnected",
  anthropic: "disconnected",
};
const defaultModels: Record<ProviderId, ProviderModel[]> = { openai: [], anthropic: [] };
const automaticSelection: ModelSelection = { mode: "automatic" };

async function requestJson<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: T | undefined }> {
  const response = await fetcher(url, { ...init, credentials: "same-origin" });
  const body = (await response.json().catch(() => undefined)) as T | undefined;
  return { response, body };
}

async function loadProviderState(fetcher: typeof fetch): Promise<LoadedProviderState> {
  const { response, body } = await requestJson<ProvidersResponse>(fetcher, "/api/providers");
  if (!response.ok || !body) throw new Error("PROVIDER_STATE_UNAVAILABLE");

  const statuses = { ...defaultStatuses };
  for (const provider of body.providers) {
    if (providerIds.includes(provider.id)) statuses[provider.id] = provider.status;
  }
  const models = { ...defaultModels };
  for (const provider of providerIds) {
    if (statuses[provider] !== "connected") continue;
    const result = await requestJson<{ models?: ProviderModel[]; code?: string }>(
      fetcher,
      `/api/providers/${provider}/models/refresh`,
      { method: "POST" },
    );
    if (result.response.status === 401) {
      statuses[provider] = "needs_reauth";
    } else if (result.response.ok && Array.isArray(result.body?.models)) {
      models[provider] = result.body.models.filter(
        (model) => typeof model?.id === "string" && typeof model?.label === "string",
      );
    }
  }

  return { statuses, models, selection: body.modelSelection ?? automaticSelection };
}

function modelOptionValue(provider: ProviderId, modelId: string): string {
  return `${provider}:${encodeURIComponent(modelId)}`;
}

function selectionValue(selection: ModelSelection): string {
  return selection.mode === "automatic"
    ? "automatic"
    : modelOptionValue(selection.provider, selection.modelId);
}

function selectedModel(value: string): { provider: ProviderId; modelId: string } | undefined {
  const separator = value.indexOf(":");
  if (separator < 0) return undefined;
  const provider = value.slice(0, separator);
  if (provider !== "openai" && provider !== "anthropic") return undefined;
  try {
    const modelId = decodeURIComponent(value.slice(separator + 1));
    return modelId ? { provider, modelId } : undefined;
  } catch {
    return undefined;
  }
}

export function ProviderSettings({
  fetcher = globalThis.fetch,
}: Readonly<{ fetcher?: typeof fetch }>) {
  const [view, setView] = useState<"loading" | "signed-out" | "signed-in" | "error">("loading");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [statuses, setStatuses] = useState(defaultStatuses);
  const [models, setModels] = useState(defaultModels);
  const [keys, setKeys] = useState<Record<ProviderId, string>>({ openai: "", anthropic: "" });
  const [busyProvider, setBusyProvider] = useState<ProviderId | undefined>();
  const [busyLogin, setBusyLogin] = useState(false);
  const [busySelection, setBusySelection] = useState(false);
  const [selection, setSelection] = useState<ModelSelection>(automaticSelection);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<ProviderId, string>>({ openai: "", anthropic: "" });
  const [selectionError, setSelectionError] = useState("");

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const { response, body } = await requestJson<{ authenticated?: boolean }>(
          fetcher,
          "/api/session",
        );
        if (disposed) return;
        if (!response.ok || !body) throw new Error("SESSION_UNAVAILABLE");
        if (!body.authenticated) {
          setView("signed-out");
          return;
        }
        const loaded = await loadProviderState(fetcher);
        if (disposed) return;
        setStatuses(loaded.statuses);
        setModels(loaded.models);
        setSelection(loaded.selection);
        setView("signed-in");
      } catch {
        if (!disposed) {
          setLoginError("The service could not be reached. Refresh to try again.");
          setView("error");
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [fetcher]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyLogin(true);
    setLoginError("");
    try {
      const { response } = await requestJson(fetcher, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setPassword("");
      if (!response.ok) {
        setLoginError(
          response.status === 429
            ? "Too many attempts. Wait a little, then try again."
            : "That password was not accepted.",
        );
        return;
      }
      const loaded = await loadProviderState(fetcher);
      setStatuses(loaded.statuses);
      setModels(loaded.models);
      setSelection(loaded.selection);
      setView("signed-in");
    } catch {
      setLoginError("The service could not be reached. Try again.");
    } finally {
      setBusyLogin(false);
    }
  }

  async function saveCredential(event: FormEvent<HTMLFormElement>, provider: ProviderId) {
    event.preventDefault();
    const credential = keys[provider];
    if (!credential.trim()) {
      setErrors((current) => ({ ...current, [provider]: "Paste an API key to continue." }));
      return;
    }
    setBusyProvider(provider);
    setErrors((current) => ({ ...current, [provider]: "" }));
    setMessage("");
    try {
      const { response, body } = await requestJson<{
        status?: ConnectionStatus;
        models?: ProviderModel[];
        code?: string;
      }>(fetcher, `/api/providers/${provider}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: credential }),
      });
      setKeys((current) => ({ ...current, [provider]: "" }));
      if (!response.ok || body?.status !== "connected") {
        setErrors((current) => ({
          ...current,
          [provider]:
            body?.code === "INVALID_CREDENTIALS"
              ? "That key was rejected. Check it and try again."
              : "Could not connect this provider. Try again.",
        }));
        return;
      }
      setStatuses((current) => ({ ...current, [provider]: "connected" }));
      setModels((current) => ({
        ...current,
        [provider]: Array.isArray(body.models) ? body.models : [],
      }));
      setMessage(`${providerLabels[provider]} connected. The key is not shown again.`);
    } catch {
      setKeys((current) => ({ ...current, [provider]: "" }));
      setErrors((current) => ({
        ...current,
        [provider]: "Could not connect this provider. Try again.",
      }));
    } finally {
      setBusyProvider(undefined);
    }
  }

  async function disconnect(provider: ProviderId) {
    setBusyProvider(provider);
    setErrors((current) => ({ ...current, [provider]: "" }));
    setMessage("");
    try {
      const { response } = await requestJson(fetcher, `/api/providers/${provider}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("PROVIDER_DISCONNECT_FAILED");
      setStatuses((current) => ({ ...current, [provider]: "disconnected" }));
      setModels((current) => ({ ...current, [provider]: [] }));
      setMessage(`${providerLabels[provider]} disconnected.`);
    } catch {
      setErrors((current) => ({
        ...current,
        [provider]: "Could not disconnect this provider. Try again.",
      }));
    } finally {
      setBusyProvider(undefined);
    }
  }

  async function updateSelection(value: string) {
    const selected = value === "automatic" ? undefined : selectedModel(value);
    if (value !== "automatic" && !selected) return;
    const next: ModelSelection = selected
      ? { mode: "specific", ...selected }
      : { mode: "automatic" };
    setBusySelection(true);
    setSelectionError("");
    try {
      const { response, body } = await requestJson<ModelSelection & { code?: string }>(
        fetcher,
        "/api/model-selection",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(next),
        },
      );
      if (!response.ok || !body || body.mode !== next.mode) {
        if (response.status === 401 && next.mode === "specific") {
          setStatuses((current) => ({ ...current, [next.provider]: "needs_reauth" }));
        }
        throw new Error("MODEL_SELECTION_FAILED");
      }
      setSelection(next);
    } catch {
      setSelectionError("That model choice could not be saved. Try again.");
    } finally {
      setBusySelection(false);
    }
  }

  async function signOut() {
    try {
      await requestJson(fetcher, "/api/session", { method: "DELETE" });
    } finally {
      setPassword("");
      setKeys({ openai: "", anthropic: "" });
      setView("signed-out");
      setMessage("");
    }
  }

  if (view === "loading") {
    return (
      <main className="provider-settings" aria-busy="true">
        <p role="status">Checking owner session…</p>
      </main>
    );
  }

  if (view !== "signed-in") {
    return (
      <main className="provider-settings">
        <header className="provider-settings__header">
          <p className="provider-settings__eyebrow">CuckCode · hosted setup</p>
          <h1>Owner sign in</h1>
          <p>Sign in to connect and manage the providers used by this workspace.</p>
        </header>
        <form className="provider-settings__login" onSubmit={signIn}>
          <label htmlFor="owner-password">Owner password</label>
          <input
            id="owner-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
          />
          <button type="submit" disabled={busyLogin || !password}>
            {busyLogin ? "Signing in…" : "Sign in"}
          </button>
          {loginError ? (
            <p className="provider-settings__error" role="alert">
              {loginError}
            </p>
          ) : null}
        </form>
      </main>
    );
  }

  const selectedOption = selectionValue(selection);
  const savedSelectionIsListed =
    selection.mode === "automatic" ||
    models[selection.provider].some(({ id }) => id === selection.modelId);

  return (
    <main className="provider-settings">
      <header className="provider-settings__header">
        <p className="provider-settings__eyebrow">CuckCode · hosted setup</p>
        <div className="provider-settings__title-row">
          <div>
            <h1>Provider connections</h1>
            <p>Connect a provider once. Your key is encrypted when saved and never shown again.</p>
          </div>
          <button className="provider-settings__quiet" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="provider-settings__section" aria-labelledby="provider-list-title">
        <h2 id="provider-list-title">Available providers</h2>
        <div className="provider-settings__providers">
          {providerIds.map((provider) => {
            const status = statuses[provider];
            const label = providerLabels[provider];
            const statusLabel =
              status === "needs_reauth"
                ? "Needs reauth"
                : status === "connected"
                  ? "Connected"
                  : "Disconnected";
            const buttonLabel =
              status === "needs_reauth"
                ? `Reconnect ${label}`
                : status === "connected"
                  ? `Replace ${label} key`
                  : `Connect ${label}`;
            return (
              <fieldset className="provider-settings__provider" key={provider}>
                <legend>{label}</legend>
                <p className="provider-settings__provider-status">
                  <strong>{statusLabel}</strong>
                  {status === "needs_reauth" ? (
                    <span>The provider rejected its saved key. Reconnect to continue.</span>
                  ) : null}
                  {status === "connected" ? <span>Your saved key stays private.</span> : null}
                </p>
                <form onSubmit={(event) => void saveCredential(event, provider)}>
                  <label htmlFor={`${provider}-key`}>{label} API key</label>
                  <div className="provider-settings__key-row">
                    <input
                      id={`${provider}-key`}
                      type="password"
                      autoComplete="new-password"
                      value={keys[provider]}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setKeys((current) => ({ ...current, [provider]: value }));
                      }}
                      aria-describedby={`${provider}-key-help`}
                    />
                    <button type="submit" disabled={busyProvider === provider || !keys[provider]}>
                      {busyProvider === provider ? "Checking…" : buttonLabel}
                    </button>
                    {status !== "disconnected" ? (
                      <button
                        className="provider-settings__quiet"
                        type="button"
                        disabled={busyProvider === provider}
                        onClick={() => void disconnect(provider)}
                      >
                        Disconnect {label}
                      </button>
                    ) : null}
                  </div>
                  <span className="provider-settings__hint" id={`${provider}-key-help`}>
                    Paste the key to validate it before saving.
                  </span>
                  {errors[provider] ? (
                    <p className="provider-settings__error" role="alert">
                      {errors[provider]}
                    </p>
                  ) : null}
                </form>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="provider-settings__section" aria-labelledby="model-choice-title">
        <h2 id="model-choice-title">Model choice</h2>
        <label htmlFor="model-choice">Choose a default or a specific available model</label>
        <select
          id="model-choice"
          value={selectedOption}
          disabled={busySelection}
          onChange={(event) => void updateSelection(event.currentTarget.value)}
        >
          <option value="automatic">Choose automatically</option>
          {!savedSelectionIsListed && selection.mode === "specific" ? (
            <option value={selectedOption}>
              {providerLabels[selection.provider]} — {selection.modelId} (saved choice)
            </option>
          ) : null}
          {providerIds.flatMap((provider) =>
            models[provider].map((model) => (
              <option key={`${provider}:${model.id}`} value={modelOptionValue(provider, model.id)}>
                {providerLabels[provider]} — {model.label}
              </option>
            )),
          )}
        </select>
        <p className="provider-settings__hint">
          Automatic selection is the default. A saved model choice remains in place when a provider
          is disconnected.
        </p>
        {selectionError ? (
          <p className="provider-settings__error" role="alert">
            {selectionError}
          </p>
        ) : null}
      </section>

      <p className="provider-settings__feedback" role="status" aria-live="polite">
        {message}
      </p>
      <footer className="provider-settings__footer">
        Work creation and execution are not included in this hosted setup stage.
      </footer>
    </main>
  );
}
