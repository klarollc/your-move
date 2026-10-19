import { useEffect, useState, type FormEvent } from "react";

import "./provider-settings.css";
import "./integration-settings.css";

type IntegrationStatus = "disconnected" | "connected";

async function requestJson<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: (T & { code?: string }) | undefined }> {
  const response = await fetcher(url, { ...init, credentials: "same-origin" });
  const body = (await response.json().catch(() => undefined)) as
    (T & { code?: string }) | undefined;
  return { response, body };
}

// GitHub connection for the agent's repository tools. The token's own repository access is the
// v1 repository boundary, so the copy steers the owner to a fine-grained, repo-scoped token.
export function IntegrationSettings({
  signedIn,
  fetcher = globalThis.fetch,
}: Readonly<{ signedIn: boolean; fetcher?: typeof fetch }>) {
  const [status, setStatus] = useState<IntegrationStatus | undefined>();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!signedIn) {
      setStatus(undefined);
      setToken("");
      return;
    }
    let disposed = false;
    void (async () => {
      try {
        const { response, body } = await requestJson<{
          integrations?: { id: string; status: IntegrationStatus }[];
        }>(fetcher, "/api/integrations");
        const github = body?.integrations?.find(({ id }) => id === "github");
        if (!disposed && response.ok && github) setStatus(github.status);
      } catch {
        // No panel when the service does not offer integrations.
      }
    })();
    return () => {
      disposed = true;
    };
  }, [signedIn, fetcher]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { response, body } = await requestJson<{ status?: IntegrationStatus }>(
        fetcher,
        "/api/integrations/github",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        },
      );
      if (!response.ok || body?.status !== "connected") {
        setError(
          body?.code === "INVALID_CREDENTIALS"
            ? "GitHub rejected that token. Check it and try again."
            : "Could not connect GitHub. Try again.",
        );
        return;
      }
      setStatus("connected");
      setMessage("GitHub connected. The token is not shown again.");
    } catch {
      setError("Could not connect GitHub. Try again.");
    } finally {
      setToken("");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { response } = await requestJson(fetcher, "/api/integrations/github", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("INTEGRATION_DISCONNECT_FAILED");
      setStatus("disconnected");
      setMessage("GitHub disconnected.");
    } catch {
      setError("Could not disconnect GitHub. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn || !status) return null;

  return (
    <section
      className="provider-settings integration-settings"
      aria-labelledby="tool-connections-title"
    >
      <div className="provider-settings__section">
        <h2 id="tool-connections-title">Tool connections</h2>
        <div className="provider-settings__providers">
          <fieldset className="provider-settings__provider">
            <legend>GitHub</legend>
            <p className="provider-settings__provider-status">
              <strong>{status === "connected" ? "Connected" : "Disconnected"}</strong>
              {status === "connected" ? <span>Your saved token stays private.</span> : null}
            </p>
            <form onSubmit={(event) => void connect(event)}>
              <label htmlFor="github-token">GitHub fine-grained token</label>
              <div className="provider-settings__key-row">
                <input
                  id="github-token"
                  type="password"
                  autoComplete="new-password"
                  value={token}
                  onChange={(event) => setToken(event.currentTarget.value)}
                  aria-describedby="github-token-help"
                />
                <button type="submit" disabled={busy || !token}>
                  {busy
                    ? "Checking…"
                    : status === "connected"
                      ? "Replace GitHub token"
                      : "Connect GitHub"}
                </button>
                {status === "connected" ? (
                  <button
                    className="provider-settings__quiet"
                    type="button"
                    disabled={busy}
                    onClick={() => void disconnect()}
                  >
                    Disconnect GitHub
                  </button>
                ) : null}
              </div>
              <span className="provider-settings__hint" id="github-token-help">
                Use a fine-grained token limited to the repositories this work may touch: the
                token&apos;s access is the agent&apos;s boundary. The agent can read those
                repositories; any file change waits for your go-ahead. The token is checked with
                GitHub before it is saved.
              </span>
              {error ? (
                <p className="provider-settings__error" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
          </fieldset>
        </div>
        <p className="provider-settings__feedback" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </section>
  );
}
