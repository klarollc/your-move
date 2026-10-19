import { useCallback, useState } from "react";

import "./hosted-workspace.css";
import { IntegrationSettings } from "./integration-settings.js";
import { ProviderSettings } from "./provider-settings.js";
import { WorkCreation } from "./work-creation.js";
import { WorkExecutions } from "./work-executions.js";

// Owns the owner-session state shared by the provider panel and the work-creation panel.
export function HostedWorkspace({
  fetcher = globalThis.fetch,
}: Readonly<{ fetcher?: typeof fetch }>) {
  const [signedIn, setSignedIn] = useState(false);
  const [approvals, setApprovals] = useState(0);
  const onApproved = useCallback(() => setApprovals((count) => count + 1), []);
  return (
    <div className="hosted-workspace">
      <ProviderSettings fetcher={fetcher} onSessionChange={setSignedIn} />
      <IntegrationSettings signedIn={signedIn} fetcher={fetcher} />
      <WorkCreation signedIn={signedIn} fetcher={fetcher} onApproved={onApproved} />
      <WorkExecutions signedIn={signedIn} refreshKey={approvals} fetcher={fetcher} />
    </div>
  );
}
