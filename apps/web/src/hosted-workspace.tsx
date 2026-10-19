import { useState } from "react";

import { ProviderSettings } from "./provider-settings.js";
import { WorkCreation } from "./work-creation.js";

// Owns the owner-session state shared by the provider panel and the work-creation panel.
export function HostedWorkspace({
  fetcher = globalThis.fetch,
}: Readonly<{ fetcher?: typeof fetch }>) {
  const [signedIn, setSignedIn] = useState(false);
  return (
    <>
      <ProviderSettings fetcher={fetcher} onSessionChange={setSignedIn} />
      <WorkCreation signedIn={signedIn} fetcher={fetcher} />
    </>
  );
}
