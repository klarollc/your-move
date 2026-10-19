import "./global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ProviderSettings } from "./provider-settings.js";

const container = document.querySelector("#app");

if (!(container instanceof HTMLElement)) {
  throw new Error("CUCKCODE_HOSTED_ROOT_MISSING");
}

createRoot(container).render(
  <StrictMode>
    <ProviderSettings />
  </StrictMode>,
);
