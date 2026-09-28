import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceLibrary } from "./evidence-library.js";
import { officeLibraryFor } from "./office-model.js";
import { OfficeShell } from "./office-shell.js";

/**
 * Phase 7-O Task 9g (owner-approved 2026-09-28, G-1 and G-2). AR-03 column 3 (one short card in
 * plain words) and AR-04 (no technical noise on a first screen); constitution rules 2 and 10.
 */
afterEach(cleanup);

const blocked = "Provide current browser evidence: blocked";

describe("G-1: the rail's controls", () => {
  it("read one short word each, and keep the item in their accessible names", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await user.click(screen.getByRole("button", { name: "1 blocked · 1 review" }));
    const rail = screen.getByRole("complementary", { name: "Manager attention" });
    for (const [name, visible] of [
      [`Locate ${blocked}`, "Locate"],
      [`Respond to ${blocked}`, "Respond"],
      [`Dismiss ${blocked}`, "Dismiss"],
    ] as const) {
      const control = within(rail).getByRole("button", { name });
      expect(control.textContent?.trim(), name).toBe(visible);
    }
  });
});

describe("G-2: an opened evidence record", () => {
  it("leads with its finding, and keeps the identifier behind Detailed evidence", async () => {
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
    await user.click(screen.getByRole("button", { name: "View evidence_browser v1" }));
    const record = screen.getByRole("dialog", { name: "Evidence: evidence_browser v1" });
    const headings = within(record).getAllByRole("heading");
    expect(headings[0]).toHaveTextContent(
      "Browser evidence, version 1: failed. No summary recorded.",
    );
    expect(within(record).getByText("evidence_browser v1")).not.toBeVisible();
    await user.click(within(record).getByText("Detailed evidence"));
    expect(within(record).getByText("evidence_browser v1")).toBeVisible();
  });
});
