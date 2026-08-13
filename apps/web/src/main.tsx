import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { LayoutTrial } from "./layout-trial.js";

const container = document.querySelector("#app");

if (!(container instanceof HTMLElement)) {
  throw new Error("CUCKCODE_SCAFFOLD_ROOT_MISSING");
}

const surface = new URLSearchParams(window.location.search).get("surface");

createRoot(container).render(
  <StrictMode>
    {surface === "layout-trial" ? (
      <LayoutTrial />
    ) : (
      <main aria-label="CuckCode Phase 0 scaffold" data-phase="0">
        <h1>CuckCode Phase 0 scaffold</h1>
        <p>Infrastructure verification only.</p>
      </main>
    )}
  </StrictMode>,
);
