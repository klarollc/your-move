import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { officeLibraryFor } from "./office-model.js";
import { OfficeShell } from "./office-shell.js";
import { openOfficeOutline } from "./test-support/open-office-outline.js";

/**
 * Phase 7-O Task 9f-4. Governing plate: AR-02 frame 6 ("Back to office"; "Checks for this draft";
 * "Open detailed evidence"), with constitution rules 3 and 10: evidence may take the whole
 * surface when deliberately opened, with an obvious way back, and says what it found in plain
 * words first; identifiers stay one step away.
 */
afterEach(cleanup);

const openEvidence = async () => {
  const user = userEvent.setup();
  render(<OfficeShell state="ready" library={officeLibraryFor("ready")} />);
  await openOfficeOutline(user);
  await user.click(screen.getByRole("button", { name: "Inspect Test Engineer" }));
  await user.click(screen.getByRole("button", { name: "Open Browser evidence, version 1" }));
  return { user, library: screen.getByRole("complementary", { name: "Project Library" }) };
};

describe("evidence takes the surface, with a way back", () => {
  it("offers Back to inspector and Back to office", async () => {
    const { library } = await openEvidence();
    expect(within(library).getByRole("button", { name: "Back to inspector" })).toBeVisible();
    expect(within(library).getByRole("button", { name: "Back to office" })).toBeVisible();
    expect(within(library).queryByRole("button", { name: "Close Library" })).toBeNull();
  });

  it("returns to the office from evidence, focusing the control that began the journey", async () => {
    const { user, library } = await openEvidence();
    await user.click(within(library).getByRole("button", { name: "Back to office" }));
    expect(screen.queryByRole("complementary", { name: "Project Library" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Entity inspector" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Office outline" })).toBeNull();
    const bar = screen.getByRole("banner", { name: "Project bar" });
    expect(within(bar).getByRole("button", { name: "Office outline" })).toHaveFocus();
  });

  it("says what the evidence found in plain words, with identifiers one step away", async () => {
    await openEvidence();
    const record = screen.getByRole("dialog", { name: "Evidence: evidence_browser v1" });
    expect(
      within(record).getByText("Browser evidence, version 1: failed. No summary recorded."),
    ).toBeVisible();
    expect(within(record).getByText("Detailed evidence", { selector: "summary" })).toBeVisible();
    expect(within(record).getByText("work_browser_evidence")).not.toBeVisible();
  });
});
