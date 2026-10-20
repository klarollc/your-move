import { useCallback, useState } from "react";

import "./hosted-workspace.css";
import { IntegrationSettings } from "./integration-settings.js";
import { PlanAndLampSettings } from "./plan-lamp-settings.js";
import { ProviderSettings, type ConnectionStatus, type ProviderId } from "./provider-settings.js";
import { WorkCreation } from "./work-creation.js";
import { WorkExecutions, openLampFeed, type OpenFeed } from "./work-executions.js";

type Surface = "work" | "connections";
type ConnectionId = "anthropic" | "openai-plan" | "ollama" | "github";
type DirectoryStatuses = Record<ConnectionId, string>;

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

// Owns the owner-session state shared by the provider panel and the work-creation panel.
export function HostedWorkspace({
  fetcher = globalThis.fetch,
  openFeed = openLampFeed,
}: Readonly<{ fetcher?: typeof fetch; openFeed?: OpenFeed }>) {
  const [signedIn, setSignedIn] = useState(false);
  const [approvals, setApprovals] = useState(0);
  const [surface, setSurface] = useState<Surface>("connections");
  const [selectedConnection, setSelectedConnection] = useState<ConnectionId>("anthropic");
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
  const onApproved = useCallback(() => setApprovals((count) => count + 1), []);
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
        onClick={() => setSelectedConnection(id)}
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
          <p className="ym3__app-nav-brand">CuckCode</p>
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
        </nav>
      ) : null}

      <main className="hosted-workspace__work" hidden={!signedIn || surface !== "work"}>
        <WorkCreation signedIn={signedIn} fetcher={fetcher} onApproved={onApproved} />
        <WorkExecutions
          signedIn={signedIn}
          surfaceActive={surface === "work"}
          refreshKey={approvals}
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
            <p>Choose a service to manage its existing connection.</p>
          </header>
        ) : null}
        <div className={`ym3c__layout${signedIn ? "" : " ym3c__layout--auth"}`}>
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
          <section
            className="ym3c__sheet-area"
            aria-label={signedIn ? "Connection sheet" : "Owner sign-in sheet"}
          >
            <div className="ym3c__sheet">
              {signedIn && surface === "connections" && selectedConnection === "openai-plan" ? (
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
              <PlanAndLampSettings
                signedIn={signedIn}
                fetcher={fetcher}
                selectedPanel={selectedPlanPanel}
                onStatusChange={onConnectionStatusChange}
              />
              <IntegrationSettings
                signedIn={signedIn}
                fetcher={fetcher}
                visible={surface === "connections" && selectedConnection === "github"}
                onStatusChange={onConnectionStatusChange}
              />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
