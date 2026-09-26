import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OFFICE_FIXTURES } from "./office-fixtures/index.js";
import { officeLibraryFor } from "./office-model.js";
import { OfficeShell } from "./office-shell.js";

/**
 * Phase 7-O Task 8b: the Project Library's evidence is the office log's evidence, so the
 * inspector's links resolve. Owner rulings 8b-1 (lanes are the recorded kinds), 8b-2 (no summary
 * is invented) and 8b-3 (zone buttons open the library unfocused).
 */
afterEach(cleanup);

// The independent record: the log event that recorded the browser evidence.
const browserEvent = OFFICE_FIXTURES.default!.events.find(
  (event) =>
    event.kind === "evidence.recorded" &&
    (event.payload as { evidenceId?: string }).evidenceId === "evidence_browser",
)!;
const browserPayload = browserEvent.payload as {
  kind: string;
  version: number;
  result: string;
  workItemId: string;
};

const renderOffice = () => {
  const user = userEvent.setup();
  render(<OfficeShell state="ready" library={officeLibraryFor("ready")} />);
  return user;
};

describe("the Project Library reads the office log", () => {
  it("resolves the Test Engineer's evidence link to the recorded item and version", async () => {
    const user = renderOffice();
    await user.click(screen.getByRole("button", { name: "Inspect Test Engineer" }));
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    await user.click(
      within(inspector).getByRole("button", {
        name: `Open evidence_browser v${browserPayload.version}`,
      }),
    );
    expect(screen.queryByRole("dialog", { name: "Evidence link unavailable" })).toBeNull();
    const focused = screen.getByRole("dialog", {
      name: `Evidence: evidence_browser v${browserPayload.version}`,
    });
    expect(browserPayload.result).toBe("failed");
    expect(focused).toHaveTextContent("Failed");
    expect(focused).toHaveTextContent("No summary recorded");
    expect(focused).toHaveTextContent(browserPayload.workItemId);
    expect(focused).toHaveTextContent(browserEvent.eventId);
    expect(focused).toHaveTextContent("agent_test_engineer");
  });

  it("shows lanes for the kinds the log records, and no Phase 4 evidence", async () => {
    const user = renderOffice();
    await user.click(screen.getByRole("button", { name: "Locate Project Library" }));
    await user.click(screen.getByRole("button", { name: "Open Project Library" }));
    const library = screen.getByRole("complementary", { name: "Project Library" });
    const recordedKinds = [
      ...new Set(
        OFFICE_FIXTURES.default!.events.filter((event) => event.kind === "evidence.recorded").map(
          (event) => (event.payload as { kind: string }).kind,
        ),
      ),
    ];
    expect(recordedKinds.length).toBeGreaterThan(0);
    for (const kind of recordedKinds) {
      const name = `${kind.slice(0, 1).toUpperCase()}${kind.slice(1)} evidence`;
      expect(within(library).getByRole("region", { name })).toBeVisible();
    }
    expect(library).not.toHaveTextContent("evidence_task_11");
    expect(within(library).queryByRole("region", { name: "Release evidence" })).toBeNull();
  });

  it("opens the library unfocused from the review station, with no kind lookup", async () => {
    const user = renderOffice();
    await user.click(screen.getByRole("button", { name: "Locate Review station" }));
    expect(screen.queryByRole("button", { name: "Open Visual QA evidence" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open Project Library" }));
    expect(screen.getByRole("complementary", { name: "Project Library" })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
