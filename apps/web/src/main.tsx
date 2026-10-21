import "./global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { FontSheet } from "./font-sheet.js";
import { LayoutTrial } from "./layout-trial.js";
import { OfficeWorkspace, type KickoffFixtureId } from "./office-canvas.js";
import type { OfficeShellState } from "./office-shell.js";

const container = document.querySelector("#app");

if (!(container instanceof HTMLElement)) {
  throw new Error("YOUR_MOVE_SCAFFOLD_ROOT_MISSING");
}

const parameters = new URLSearchParams(window.location.search);
const surface = parameters.get("surface");
const requestedState = parameters.get("state");
const requestedKickoff = parameters.get("kickoff");
const initialState: OfficeShellState = isOfficeShellState(requestedState)
  ? requestedState
  : "ready";

createRoot(container).render(
  <StrictMode>
    {surface === "layout-trial" ? (
      <LayoutTrial />
    ) : surface === "font-sheet" ? (
      <FontSheet />
    ) : (
      <OfficeWorkspace
        initialState={initialState}
        {...(isKickoffFixture(requestedKickoff) ? { kickoffFixture: requestedKickoff } : {})}
        fixtureId={parameters.get("fixture") ?? undefined}
        motionEnabled={parameters.get("motion") === "handoff"}
        motionCheckpoint={parameters.get("checkpoint") ?? "settled"}
      />
    )}
  </StrictMode>,
);
function isOfficeShellState(value: string | null): value is OfficeShellState {
  return [
    "ready",
    "loading",
    "empty",
    "partial",
    "error",
    "stale",
    "offline",
    "render-error",
    "rate-limit",
    "budget-limit",
    "permission-denied",
    "missing-artifact",
    "test-failure",
    "reviewer-disagreement",
    "conflict",
    "restart",
    "cancelled",
  ].includes(value ?? "");
}

function isKickoffFixture(value: string | null): value is KickoffFixtureId {
  return value === "round" || value === "revision";
}
