// The office's one document-wide stylesheet, so the fixture renders exactly as it did inside the
// office bundle. The dependency runs from the fixture to the office, never the other way
// (scripts/fixture-isolation.unit.test.ts).
import "../../../apps/web/src/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DecisionNoticeCapture } from "./web/decision-notice-capture.js";
import { DecisionNoticeFixture } from "./web/decision-notice-fixture.js";

const container = document.querySelector("#app");

if (!(container instanceof HTMLElement)) {
  throw new Error("CUCKCODE_SCAFFOLD_ROOT_MISSING");
}

// The same two surfaces, at the same query strings, as when the office bundle served them.
const parameters = new URLSearchParams(window.location.search);
const surface = parameters.get("surface");

createRoot(container).render(
  <StrictMode>
    {surface === "decision-notice-capture" ? (
      <DecisionNoticeCapture stateId={parameters.get("state") ?? "pending"} />
    ) : (
      <DecisionNoticeFixture />
    )}
  </StrictMode>,
);
