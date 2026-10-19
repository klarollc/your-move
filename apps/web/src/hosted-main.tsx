import "./global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { HostedWorkspace } from "./hosted-workspace.js";

const container = document.querySelector("#app");

if (!(container instanceof HTMLElement)) {
  throw new Error("CUCKCODE_HOSTED_ROOT_MISSING");
}

createRoot(container).render(
  <StrictMode>
    <HostedWorkspace />
  </StrictMode>,
);
