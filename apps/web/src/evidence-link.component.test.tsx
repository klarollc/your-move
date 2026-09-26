import "@testing-library/jest-dom/vitest";
import type { BrowserLibraryProjection } from "@cuckcode/application";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceLibrary } from "./evidence-library.js";
import { OfficeShell } from "./office-shell.js";

/**
 * Phase 7-O Task 8 (spec §6): an Evidence link opens the library at the referenced item and
 * version. When the library has no such version it says so, with the ID, and never opens another
 * record in its place.
 */
afterEach(cleanup);

const record = (
  evidenceId: string,
  version: number,
  summary: string,
): BrowserLibraryProjection["evidence"][number] => ({
  evidenceId,
  kind: "test",
  status: "complete",
  summary,
  version,
  revision: 42,
  originatingEntityId: "agent_test_engineer",
  approved: false,
});
const library = (...evidence: BrowserLibraryProjection["evidence"]): BrowserLibraryProjection => ({
  knowledge: [],
  evidence,
});
const twoVersions = library(
  record("evidence_test", 1, "First capture: failed on an earlier build."),
  record("evidence_test", 2, "Second capture: passed on the current build."),
);
const noop = () => undefined;

describe("the Evidence Library opens at an item and version", () => {
  it("opens the exact version referenced, not the first record with that ID", () => {
    render(
      <EvidenceLibrary
        projection={twoVersions}
        initialEvidence={{ evidenceId: "evidence_test", version: 2 }}
        onClose={noop}
        onLocateOrigin={noop}
      />,
    );
    const focused = screen.getByRole("dialog", { name: "Evidence: evidence_test v2" });
    expect(focused).toHaveTextContent("Second capture: passed on the current build.");
    expect(focused).not.toHaveTextContent("First capture");
    expect(focused).toHaveTextContent("version 2");
  });

  it("says the link is unavailable when the version is absent, and opens nothing else", () => {
    render(
      <EvidenceLibrary
        projection={twoVersions}
        initialEvidence={{ evidenceId: "evidence_test", version: 3 }}
        onClose={noop}
        onLocateOrigin={noop}
      />,
    );
    const unavailable = screen.getByRole("dialog", { name: "Evidence link unavailable" });
    expect(unavailable).toHaveTextContent("evidence_test");
    expect(unavailable).toHaveTextContent("version 3");
    expect(unavailable).not.toHaveTextContent("capture");
    expect(screen.queryByRole("dialog", { name: /^Evidence: / })).toBeNull();
  });

  it("says the link is unavailable when the ID is unknown", () => {
    render(
      <EvidenceLibrary
        projection={twoVersions}
        initialEvidence={{ evidenceId: "evidence_missing", version: 1 }}
        onClose={noop}
        onLocateOrigin={noop}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Evidence link unavailable" })).toHaveTextContent(
      "evidence_missing",
    );
  });
});

describe("the inspector's Evidence links", () => {
  const inspectTestEngineer = async (projection: BrowserLibraryProjection) => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" library={projection} />);
    await user.click(screen.getByRole("button", { name: "Inspect Test Engineer" }));
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    return { user, inspector };
  };

  it("opens the recorded evidence at its version when the library holds it", async () => {
    const { user, inspector } = await inspectTestEngineer(
      library(record("evidence_browser", 1, "Browser capture failed on an earlier build.")),
    );
    await user.click(within(inspector).getByRole("button", { name: "Open evidence_browser v1" }));
    const focused = screen.getByRole("dialog", { name: "Evidence: evidence_browser v1" });
    expect(focused).toHaveTextContent("evidence_browser");
    expect(focused).toHaveTextContent("version 1");
  });

  it("shows the link as unavailable when the library lacks it, and returns focus on close", async () => {
    const { user, inspector } = await inspectTestEngineer(
      library(record("evidence_other", 1, "An unrelated capture.")),
    );
    const link = within(inspector).getByRole("button", { name: "Open evidence_browser v1" });
    await user.click(link);
    const unavailable = screen.getByRole("dialog", { name: "Evidence link unavailable" });
    expect(unavailable).toHaveTextContent("evidence_browser");
    expect(unavailable).not.toHaveTextContent("An unrelated capture.");
    await user.click(within(unavailable).getByRole("button", { name: "Close evidence" }));
    await user.click(screen.getByRole("button", { name: "Close Library" }));
    expect(link).toHaveFocus();
  });
});
