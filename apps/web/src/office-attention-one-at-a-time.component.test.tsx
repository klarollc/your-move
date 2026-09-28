import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OfficeShell } from "./office-shell.js";

/**
 * Phase 7-O Task 9f-4. Governing plates: AR-03 "Several requests" ("Question 1 of 2", "Next
 * question") and AR-02 frame 4 ("Answer one clear question"); AR-04 rejects badges and technical
 * noise. The rail shows one item at a time, in canonical order, and the disposition controls
 * appear when the manager chooses to respond. No disposition option is removed.
 */
afterEach(cleanup);

const blocked = "Provide current browser evidence: blocked";
const review = "Deliver the approved graybox slice: review requested";

const openRail = async () => {
  const user = userEvent.setup();
  render(<OfficeShell state="ready" />);
  await user.click(screen.getByRole("button", { name: "1 blocked · 1 review" }));
  return { user, rail: screen.getByRole("complementary", { name: "Manager attention" }) };
};

describe("manager attention, one item at a time", () => {
  it("shows the first item in canonical order, with its position, and no technical kicker", async () => {
    const { rail } = await openRail();
    expect(within(rail).getByText("1 of 2")).toBeVisible();
    expect(within(rail).getByRole("heading", { name: blocked })).toBeVisible();
    expect(within(rail).queryByRole("heading", { name: review })).toBeNull();
    expect(rail).not.toHaveTextContent("Canonical projection");
    expect(within(rail).getByText(/Priority 10/u)).not.toBeVisible();
  });

  it("steps through the items with Next and Previous", async () => {
    const { user, rail } = await openRail();
    const previous = within(rail).getByRole("button", { name: "Previous item" });
    const next = within(rail).getByRole("button", { name: "Next item" });
    expect(previous).toBeDisabled();
    await user.click(next);
    expect(within(rail).getByText("2 of 2")).toBeVisible();
    expect(within(rail).getByRole("heading", { name: review })).toBeVisible();
    expect(next).toBeDisabled();
    await user.click(previous);
    expect(within(rail).getByRole("heading", { name: blocked })).toBeVisible();
  });

  it("keeps the disposition controls behind Respond, with every option", async () => {
    const { user, rail } = await openRail();
    expect(within(rail).queryByRole("combobox")).toBeNull();
    const respond = within(rail).getByRole("button", { name: `Respond to ${blocked}` });
    expect(respond).toHaveAttribute("aria-expanded", "false");
    await user.click(respond);
    expect(respond).toHaveAttribute("aria-expanded", "true");
    const select = within(rail).getByRole("combobox", { name: `Disposition for ${blocked}` });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toStrictEqual(["Approve", "Decline", "Defer", "Cancel", "Redirect"]);
    expect(within(rail).getByRole("textbox", { name: `Reason for ${blocked}` })).toBeRequired();
  });

  it("moves to the remaining item when the current one is dismissed from this view", async () => {
    const { user, rail } = await openRail();
    await user.click(within(rail).getByRole("button", { name: `Dismiss ${blocked}` }));
    const returned = screen.getByRole("complementary", { name: "Manager attention" });
    expect(within(returned).getByText("1 of 1")).toBeVisible();
    expect(within(returned).getByRole("heading", { name: review })).toBeVisible();
  });

  // Added after mutation review: without the clamp, dismissing the last item left an empty rail.
  it("shows the previous item when the last one is dismissed while it is shown", async () => {
    const { user, rail } = await openRail();
    await user.click(within(rail).getByRole("button", { name: "Next item" }));
    await user.click(within(rail).getByRole("button", { name: `Dismiss ${review}` }));
    const returned = screen.getByRole("complementary", { name: "Manager attention" });
    expect(within(returned).getByText("1 of 1")).toBeVisible();
    expect(within(returned).getByRole("heading", { name: blocked })).toBeVisible();
  });
});
