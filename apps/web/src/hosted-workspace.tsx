import { useCallback, useEffect, useRef, useState } from "react";

import "./hosted-workspace.css";
import { IntegrationSettings } from "./integration-settings.js";
import { PlanAndLampSettings } from "./plan-lamp-settings.js";
import { ProviderSettings, type ConnectionStatus, type ProviderId } from "./provider-settings.js";
import { WorkExecutions, openLampFeed, type OpenFeed } from "./work-executions.js";

type Surface = "work" | "connections";
type ConnectionId = "anthropic" | "openai-plan" | "ollama" | "github";
type DirectoryStatuses = Record<ConnectionId, string>;
const signOutLabel = "Sign out";

async function signOutSession(fetcher: typeof fetch): Promise<void> {
  await fetcher("/api/session", { method: "DELETE", credentials: "same-origin" });
}

function providerStatusLabel(status: ConnectionStatus): string {
  return status === "needs_reauth"
    ? "Needs reconnection"
    : status === "connected"
      ? "Connected"
      : "Not connected";
}

function openAiStatusLabel(provider: ConnectionStatus | undefined, plan: string): string {
  if (plan === "Using ChatGPT plan") return plan;
  if (provider === "connected" || plan === "Connected, not in use") return "Connected";
  if (provider === "needs_reauth" || plan === "Needs reconnection") return "Needs reconnection";
  if (provider === "disconnected" && plan === "Not connected") return "Not connected";
  if (provider === undefined || plan === "Checking") return "Checking";
  return "Status unavailable";
}

// Owns the owner-session state shared by the provider panel and the Work surface.
export function HostedWorkspace({
  fetcher = globalThis.fetch,
  openFeed = openLampFeed,
}: Readonly<{ fetcher?: typeof fetch; openFeed?: OpenFeed }>) {
  const [signedIn, setSignedIn] = useState(false);
  const [surface, setSurface] = useState<Surface>("connections");
  const [selectedConnection, setSelectedConnection] = useState<ConnectionId>("anthropic");
  const [connectionDrawerOpen, setConnectionDrawerOpen] = useState(false);
  const [openAiMethod, setOpenAiMethod] = useState<"api-key" | "chatgpt-plan">("api-key");
  const [providerStatuses, setProviderStatuses] = useState<
    Readonly<Record<ProviderId, ConnectionStatus>> | undefined
  >(undefined);
  const [directoryStatuses, setDirectoryStatuses] = useState<DirectoryStatuses>({
    anthropic: "Checking",
    "openai-plan": "Checking",
    ollama: "Checking",
    github: "Checking",
  });
  const onSessionChange = useCallback((authenticated: boolean) => {
    setSignedIn(authenticated);
    setSurface(authenticated ? "work" : "connections");
  }, []);
  const onProviderStatusesChange = useCallback(
    (statuses: Readonly<Record<ProviderId, ConnectionStatus>>) => {
      setProviderStatuses(statuses);
    },
    [],
  );
  const onConnectionStatusChange = useCallback((id: ConnectionId, status: string) => {
    setDirectoryStatuses((current) => ({ ...current, [id]: status }));
  }, []);
  const signOut = useCallback(async () => {
    await signOutSession(fetcher);
    setSignedIn(false);
    setSurface("connections");
    setConnectionDrawerOpen(false);
  }, [fetcher]);
  const closeConnectionDrawer = useCallback(() => setConnectionDrawerOpen(false), []);
  const drawerTabRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!connectionDrawerOpen) return;
    drawerCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeConnectionDrawer();
        drawerTabRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.getElementById("connection-settings-drawer");
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last && first) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeConnectionDrawer, connectionDrawerOpen]);

  const selectedProvider: ProviderId | undefined =
    selectedConnection === "anthropic"
      ? "anthropic"
      : selectedConnection === "openai-plan"
        ? "openai"
        : undefined;
  const selectedPlanPanel =
    surface === "connections" &&
    selectedConnection === "openai-plan" &&
    openAiMethod === "chatgpt-plan"
      ? "plan"
      : surface === "connections" && selectedConnection === "ollama"
        ? "lamp"
        : null;
  const selectedConnectionLabel =
    selectedConnection === "openai-plan"
      ? "OpenAI"
      : selectedConnection === "ollama"
        ? "Ollama"
        : selectedConnection === "github"
          ? "GitHub"
          : "Anthropic";

  const directoryStatus = (id: ConnectionId): string => {
    if (id === "anthropic") {
      return providerStatuses ? providerStatusLabel(providerStatuses.anthropic) : "Checking";
    }
    if (id === "openai-plan") {
      return openAiStatusLabel(providerStatuses?.openai, directoryStatuses[id]);
    }
    return directoryStatuses[id];
  };

  const directoryItem = (id: ConnectionId, label: string, purpose: string) => {
    const selected = selectedConnection === id;
    return (
      <button
        key={id}
        className="ym3c__directory-item"
        type="button"
        aria-current={selected ? "page" : undefined}
        onClick={() => {
          setSelectedConnection(id);
          setConnectionDrawerOpen(false);
        }}
      >
        <strong>{label}</strong>
        <span>{purpose}</span>
        <em>{selected ? `Selected · ${directoryStatus(id)}` : directoryStatus(id)}</em>
      </button>
    );
  };

  return (
    <div className="hosted-workspace">
      {signedIn ? (
        <nav className="ym3__app-nav" aria-label="Workspace navigation">
          <p className="ym3__app-nav-brand">Your Move</p>
          <button
            type="button"
            aria-current={surface === "work" ? "page" : undefined}
            onClick={() => setSurface("work")}
          >
            Work
          </button>
          <button
            type="button"
            aria-current={surface === "connections" ? "page" : undefined}
            onClick={() => setSurface("connections")}
          >
            Connections
          </button>
          <button type="button" onClick={() => void signOut()}>
            {signOutLabel}
          </button>
        </nav>
      ) : null}

      <main className="hosted-workspace__work" hidden={!signedIn || surface !== "work"}>
        <WorkExecutions
          signedIn={signedIn}
          surfaceActive={surface === "work"}
          fetcher={fetcher}
          openFeed={openFeed}
        />
      </main>

      <section
        className="ym3c"
        aria-label={signedIn ? "Connections" : "Owner sign in"}
        hidden={signedIn && surface !== "connections"}
      >
        {signedIn ? (
          <header className="ym3c__heading">
            <h1>Connections</h1>
            <p>Choose a service. Open its settings only when you need them.</p>
          </header>
        ) : null}
        <div
          className={`ym3c__layout${signedIn ? "" : " ym3c__layout--auth"}${connectionDrawerOpen && surface === "connections" ? " ym3c__layout--drawer-open" : ""}`}
        >
          {signedIn ? (
            <nav className="ym3c__directory" aria-label="Connections directory">
              <section className="ym3c__directory-group" aria-labelledby="work-providers-title">
                <h2 id="work-providers-title">Work providers</h2>
                {directoryItem("anthropic", "Anthropic", "Performs agent work")}
                {directoryItem("openai-plan", "OpenAI / ChatGPT plan", "Performs agent work")}
              </section>
              <section className="ym3c__directory-group" aria-labelledby="lamp-service-title">
                <h2 id="lamp-service-title">Lamp service</h2>
                {directoryItem("ollama", "Ollama", "Evaluates lamp signals; not an agent provider")}
              </section>
              <section className="ym3c__directory-group" aria-labelledby="repository-tools-title">
                <h2 id="repository-tools-title">Repository tools</h2>
                {directoryItem("github", "GitHub", "Repository access for agent tools")}
              </section>
            </nav>
          ) : null}
          {!signedIn ? (
            <section className="ym3c__sheet-area" aria-label="Owner sign-in sheet">
              <div className="ym3c__sheet">
                <ProviderSettings
                  fetcher={fetcher}
                  onSessionChange={onSessionChange}
                  onStatusesChange={onProviderStatusesChange}
                  {...(selectedProvider ? { selectedProvider } : {})}
                  embedded={signedIn}
                  showSettings={
                    !signedIn ||
                    (surface === "connections" &&
                      (selectedConnection === "anthropic" ||
                        (selectedConnection === "openai-plan" && openAiMethod === "api-key")))
                  }
                />
              </div>
            </section>
          ) : null}
          {signedIn && surface === "connections" ? (
            <>
              <button
                className="ym3c__drawer-tab"
                type="button"
                ref={drawerTabRef}
                aria-expanded={connectionDrawerOpen}
                aria-controls="connection-settings-drawer"
                onClick={() => setConnectionDrawerOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && connectionDrawerOpen) {
                    event.preventDefault();
                    event.stopPropagation();
                    closeConnectionDrawer();
                  }
                }}
              >
                Open {selectedConnectionLabel} settings
              </button>
              {connectionDrawerOpen ? (
                <div
                  className="ym3c__drawer-backdrop"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setConnectionDrawerOpen(false);
                  }}
                >
                  <section
                    className="ym3c__drawer"
                    id="connection-settings-drawer"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${selectedConnectionLabel} settings`}
                  >
                    <button
                      className="ym3c__drawer-close"
                      type="button"
                      ref={drawerCloseRef}
                      onClick={() => setConnectionDrawerOpen(false)}
                      aria-label={`Close ${selectedConnectionLabel} settings`}
                    >
                      Close
                    </button>
                    {selectedConnection === "openai-plan" ? (
                      <div
                        className="ym3c__method-switch"
                        role="group"
                        aria-label="OpenAI connection method"
                      >
                        <button
                          type="button"
                          aria-pressed={openAiMethod === "api-key"}
                          onClick={() => setOpenAiMethod("api-key")}
                        >
                          API key
                        </button>
                        <button
                          type="button"
                          aria-pressed={openAiMethod === "chatgpt-plan"}
                          onClick={() => setOpenAiMethod("chatgpt-plan")}
                        >
                          Import ChatGPT credential
                        </button>
                      </div>
                    ) : null}
                    <div className="ym3c__sheet">
                      <ProviderSettings
                        fetcher={fetcher}
                        onStatusesChange={onProviderStatusesChange}
                        {...(selectedProvider ? { selectedProvider } : {})}
                        embedded
                        hideSignOut
                        signOutLabel={signOutLabel}
                        showSettings={
                          selectedConnection === "anthropic" ||
                          (selectedConnection === "openai-plan" && openAiMethod === "api-key")
                        }
                      />
                      <PlanAndLampSettings
                        signedIn
                        fetcher={fetcher}
                        selectedPanel={selectedPlanPanel}
                        onStatusChange={onConnectionStatusChange}
                      />
                      <IntegrationSettings
                        signedIn
                        fetcher={fetcher}
                        visible={selectedConnection === "github"}
                        onStatusChange={onConnectionStatusChange}
                      />
                    </div>
                  </section>
                </div>
              ) : null}
            </>
          ) : null}
          {signedIn && surface === "work" ? (
            <button
              className="ym3c__drawer-tab"
              type="button"
              aria-expanded={connectionDrawerOpen}
              aria-controls="connection-settings-drawer"
              onClick={() => setConnectionDrawerOpen(true)}
            >
              Open {selectedConnectionLabel} settings
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
