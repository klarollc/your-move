import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { LayoutTrial } from "./layout-trial.js";
import { OfficeWorkspace, type KickoffFixtureId } from "./office-canvas.js";
import type { OfficeShellState } from "./office-shell.js";
import { PixiSceneProbe } from "./pixi-scene-probe.js";

const container = document.querySelector("#app");

if (!(container instanceof HTMLElement)) {
  throw new Error("CUCKCODE_SCAFFOLD_ROOT_MISSING");
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
    {surface === "pixi-probe" ? (
      <PixiSceneProbe />
    ) : surface === "layout-trial" ? (
      <LayoutTrial />
    ) : (
      <OfficeWorkspace
        initialState={initialState}
        {...(isKickoffFixture(requestedKickoff) ? { kickoffFixture: requestedKickoff } : {})}
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
    "canvas-loss",
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
