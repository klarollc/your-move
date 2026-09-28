import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceLibrary } from "./evidence-library.js";
import { officeLibraryFor } from "./office-model.js";
import { OfficeShell } from "./office-shell.js";

/**
 * Phase 7-O Task 9f-5: defects seen in the Task 9f screenshots. AR-04 (no technical noise on a
 * first screen) and AR-02 frame 6 (one focused card; the way back stays in reach). Constitution
 * rule 10: identifiers stay reachable one step away.
 */
afterEach(cleanup);

const review = "Deliver the approved graybox slice: review requested";

describe("the disposition receipt", () => {
  it("says what was recorded in plain words, with identifiers one step away", async () => {
    const user = userEvent.setup();
    render(
      <OfficeShell
        state="ready"
        onDisposition={(item, intent) => ({
          ok: true,
          receipt: {
            receiptId: "receipt_command_attention_work_graybox_slice_approve",
            acceptedRevision: 35,
            resultingRevision: 36,
            targetEntityId: item.entityId,
            disposition: intent,
            correlationId: "correlation_1",
            agentVisible: true,
          },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "1 blocked · 1 review" }));
    await user.click(screen.getByRole("button", { name: "Next item" }));
    await user.click(screen.getByRole("button", { name: `Respond to ${review}` }));
    await user.type(screen.getByRole("textbox", { name: `Reason for ${review}` }), "Reviewed.");
    await user.click(screen.getByRole("button", { name: `Submit ${review}` }));
    const receipt = screen.getByRole("status", { name: "Disposition receipt" });
    expect(
      within(receipt).getByText("Approve recorded. The agent can see this decision."),
    ).toBeVisible();
    expect(
      within(receipt).getByText("receipt_command_attention_work_graybox_slice_approve"),
    ).not.toBeVisible();
    expect(receipt).toHaveTextContent("revision 35 → 36");
  });
});

describe("an open evidence record", () => {
  it("replaces the Library's lists, and is not modal, so the way back stays usable", async () => {
    const user = userEvent.setup();
    render(
      <EvidenceLibrary
        projection={officeLibraryFor("ready")}
        backLabel="Back to inspector"
        onBack={() => undefined}
        onClose={() => undefined}
        onLocateOrigin={() => undefined}
      />,
    );
    expect(screen.getByRole("heading", { name: "Knowledge lifecycle" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "View evidence_browser v1" }));
    const record = screen.getByRole("dialog", { name: "Evidence: evidence_browser v1" });
    expect(record).not.toHaveAttribute("aria-modal", "true");
    expect(screen.queryByRole("heading", { name: "Knowledge lifecycle" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back to inspector" })).toBeVisible();
  });
});
