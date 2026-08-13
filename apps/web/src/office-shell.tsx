import { useRef, useState } from "react";

export type OfficeShellState =
  "ready" | "loading" | "empty" | "partial" | "error" | "stale" | "offline" | "canvas-loss";

type OfficeEntity = Readonly<{
  entityId: string;
  label: string;
  kind: "zone" | "person";
  state: string;
  relationship?: string;
}>;

export const officeShellEntities: readonly OfficeEntity[] = Object.freeze([
  { entityId: "zone_reception", label: "Reception", kind: "zone", state: "Candidate intake" },
  { entityId: "zone_team", label: "Team work area", kind: "zone", state: "Six role stations" },
  {
    entityId: "agent_delivery_lead",
    label: "Delivery Lead",
    kind: "person",
    state: "Available",
    relationship: "Coordinates the office team",
  },
  {
    entityId: "agent_product_designer",
    label: "Product Designer",
    kind: "person",
    state: "Available",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_implementation_engineer",
    label: "Implementation Engineer",
    kind: "person",
    state: "Working on the approved graybox slice",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_test_engineer",
    label: "Test Engineer",
    kind: "person",
    state: "Reviewing deterministic tests",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_visual_qa_reviewer",
    label: "Visual QA Reviewer",
    kind: "person",
    state: "Awaiting current-build evidence",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_release_reviewer",
    label: "Release Reviewer",
    kind: "person",
    state: "Not yet requested",
    relationship: "Reports to Delivery Lead",
  },
  { entityId: "zone_library", label: "Project Library", kind: "zone", state: "Current" },
  {
    entityId: "zone_collaboration",
    label: "Collaboration table",
    kind: "zone",
    state: "No active session",
  },
  { entityId: "zone_review", label: "Review station", kind: "zone", state: "Idle" },
  {
    entityId: "zone_manager",
    label: "Manager desk",
    kind: "zone",
    state: "Current priority visible",
  },
  { entityId: "zone_delivery", label: "Delivery area", kind: "zone", state: "No delivery" },
]);

const presentations: Record<
  OfficeShellState,
  Readonly<{ cause: string; recovery?: string; runtime: string }>
> = {
  ready: {
    cause: "Canonical workspace revision 42 is current.",
    runtime: "Runtime connected",
  },
  loading: {
    cause: "Loading the persisted workspace snapshot before showing activity.",
    recovery: "Cancel loading",
    runtime: "Runtime checking persisted state",
  },
  empty: {
    cause: "No project has been selected for this office.",
    recovery: "Choose project",
    runtime: "Runtime connected",
  },
  partial: {
    cause: "Two agent records are unavailable; four current records remain visible.",
    recovery: "Retry missing records",
    runtime: "Runtime partially available",
  },
  error: {
    cause: "Workspace stream was rejected with stable error WS_READ_REJECTED.",
    recovery: "Retry workspace",
    runtime: "Runtime error",
  },
  stale: {
    cause: "The last canonical update exceeded the freshness window; activity is uncertain.",
    recovery: "Refresh workspace",
    runtime: "Runtime freshness unknown",
  },
  offline: {
    cause: "The loopback runtime is unavailable; persisted state remains inspectable.",
    recovery: "Reconnect runtime",
    runtime: "Runtime offline",
  },
  "canvas-loss": {
    cause: "The WebGL context is unavailable; the Office outline is the primary interface.",
    recovery: "Retry canvas",
    runtime: "Runtime connected; canvas unavailable",
  },
};

export function OfficeShell({ state }: Readonly<{ state: OfficeShellState }>) {
  const outlineRef = useRef<HTMLElement>(null);
  const [announcement, setAnnouncement] = useState(
    state === "ready" ? "Workspace current" : `Workspace ${state}`,
  );
  const presentation = presentations[state];
  const zones = officeShellEntities.filter(({ kind }) => kind === "zone");
  const people = officeShellEntities.filter(({ kind }) => kind === "person");

  return (
    <div className="office-shell">
      <a
        className="office-skip-link"
        href="#office-outline"
        onClick={(event) => {
          event.preventDefault();
          outlineRef.current?.focus();
        }}
      >
        Skip to Office outline
      </a>

      <header
        className="office-project-bar"
        aria-label="Project bar"
        data-testid="persistent-structure"
      >
        <div>
          <strong>CuckCode</strong>
          <span>Outcome: truthful graybox office</span>
        </div>
        <span>{presentation.runtime}</span>
        <span>Local session · revision 42</span>
        <button type="button" onClick={() => setAnnouncement("Canonical view restored")}>
          Reset view
        </button>
      </header>

      <section
        className="office-scene"
        aria-label="Office scene"
        data-scene-entity-ids={officeShellEntities.map(({ entityId }) => entityId).join(",")}
        data-testid="persistent-structure"
      >
        <div className="office-canvas-host" data-office-canvas-host aria-hidden="true">
          <span>PixiJS office host</span>
        </div>
      </section>

      <section
        id="office-outline"
        className="office-outline"
        aria-label="Office outline"
        data-testid="persistent-structure"
        ref={outlineRef}
        tabIndex={-1}
      >
        <header>
          <div>
            <h1>Office outline</h1>
            <p>Equivalent people, zones, states, relationships, and actions.</p>
          </div>
          <strong>{state === "ready" ? "Current" : state}</strong>
        </header>
        <p data-testid="workspace-cause">Cause: {presentation.cause}</p>
        {presentation.recovery ? (
          <button
            type="button"
            onClick={() => setAnnouncement(`${presentation.recovery} requested`)}
          >
            {presentation.recovery}
          </button>
        ) : null}

        <ol className="office-zone-list" aria-label="Office zones">
          {zones.map((zone) => (
            <li key={zone.entityId} data-canvas-twin-id={zone.entityId}>
              <div>
                <h2>{zone.label}</h2>
                <p>State: {zone.state}</p>
              </div>
              <button
                type="button"
                onClick={() => setAnnouncement(`${zone.label} located in the office`)}
              >
                Locate {zone.label}
              </button>
              {zone.entityId === "zone_team" ? (
                <ol aria-label="Office people">
                  {people.map((person) => (
                    <li key={person.entityId} data-canvas-twin-id={person.entityId}>
                      <div>
                        <h3>{person.label}</h3>
                        <p>State: {person.state}</p>
                        <p>Relationship: {person.relationship}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAnnouncement(`${person.label} selected`)}
                      >
                        Inspect {person.label}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <p className="office-live-region" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
