import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OfficeShell } from "./office-shell.js";
import { openOfficeOutline } from "./test-support/open-office-outline.js";

/**
 * Phase 7-O Task 9f-1 (owner rulings P-0 and P-4, and 9f-1a: keep the MDD's project identity,
 * outcome and runtime health, in plain words). Governing plate: AR-01, whose bar reads
 * "1 question · 1 review": different obligations, not one alert total (constitution rule 5).
 * AR-04 rejects technical noise, so the revision leaves the bar for Technical detail.
 */
afterEach(cleanup);

const bar = () => screen.getByRole("banner", { name: "Project bar" });

describe("the project bar reads as AR-01", () => {
  it("counts manager attention by kind, not as one total", () => {
    render(<OfficeShell state="ready" />);
    expect(within(bar()).getByRole("button", { name: "1 blocked · 1 review" })).toBeVisible();
    expect(bar()).not.toHaveTextContent("Manager attention");
  });

  it("keeps identity, outcome and runtime health in plain words, without the revision", () => {
    render(<OfficeShell state="ready" />);
    expect(within(bar()).getByRole("heading", { level: 1, name: "CuckCode" })).toBeVisible();
    expect(bar()).toHaveTextContent("truthful graybox office");
    expect(bar()).not.toHaveTextContent("Outcome:");
    expect(within(bar()).getByText("Connected")).toBeVisible();
    expect(bar()).not.toHaveTextContent("Runtime");
    expect(bar()).not.toHaveTextContent("revision");
  });

  it("says updates are unavailable when the workspace is stale", () => {
    render(<OfficeShell state="stale" />);
    expect(within(bar()).getByText("Updates unavailable")).toBeVisible();
  });

  it("keeps the runtime and revision reachable under the outline's Technical detail", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    const outline = screen.getByRole("region", { name: "Office outline" });
    const technical = within(outline).getByText("Technical detail", { selector: "summary" });
    await user.click(technical);
    const details = technical.closest("details")!;
    expect(details).toHaveTextContent("Runtime connected");
    expect(details).toHaveTextContent("Local session · revision 35");
  });

  it("recounts after an item is dismissed from this view", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await user.click(within(bar()).getByRole("button", { name: "1 blocked · 1 review" }));
    const rail = screen.getByRole("complementary", { name: "Manager attention" });
    const dismiss = within(rail).getAllByRole("button", { name: /^Dismiss / })[0]!;
    await user.click(dismiss);
    expect(within(bar()).getByRole("button", { name: /^1 (blocked|review)$/u })).toBeVisible();
  });
});
