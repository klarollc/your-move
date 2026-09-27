import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { officeLibraryFor } from "./office-model.js";
import { OfficeShell } from "./office-shell.js";
import { openOfficeOutline } from "./test-support/open-office-outline.js";

/**
 * Phase 7-O Task 9f-2, owner ruling P-2 (reverses A-2). Governing plate: AR-04, "One focused
 * interaction at a time" against "Every detail shown at once"; constitution rule 3. The outline,
 * the attention rail, the inspector, the Project Library and the kickoff replace one another.
 * Moving from one to the next keeps a way back, and going back returns focus to the control used.
 */
afterEach(cleanup);

const outline = () => screen.queryByRole("region", { name: "Office outline" });
const inspector = () => screen.queryByRole("complementary", { name: "Entity inspector" });
const rail = () => screen.queryByRole("complementary", { name: "Manager attention" });
const library = () => screen.queryByRole("complementary", { name: "Project Library" });
const bar = () => screen.getByRole("banner", { name: "Project bar" });

/** How many contextual surfaces are on screen: never more than one. */
const openSurfaces = () => [outline(), inspector(), rail(), library()].filter(Boolean).length;

describe("one contextual surface at a time", () => {
  it("replaces the outline with the inspector, with a way back", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    await user.click(screen.getByRole("button", { name: "Inspect Test Engineer" }));
    expect(inspector()).toBeVisible();
    expect(outline()).toBeNull();
    expect(openSurfaces()).toBe(1);
    await user.click(within(inspector()!).getByRole("button", { name: "Back to outline" }));
    expect(inspector()).toBeNull();
    expect(outline()).toBeVisible();
    expect(screen.getByRole("button", { name: "Inspect Test Engineer" })).toHaveFocus();
  });

  it("goes back to the outline on Escape too", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    await user.click(screen.getByRole("button", { name: "Inspect Test Engineer" }));
    await user.keyboard("{Escape}");
    expect(outline()).toBeVisible();
    expect(screen.getByRole("button", { name: "Inspect Test Engineer" })).toHaveFocus();
  });

  it("closes to the office from the inspector, focusing the control that opened the outline", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await openOfficeOutline(user);
    await user.click(screen.getByRole("button", { name: "Inspect Test Engineer" }));
    await user.click(screen.getByRole("button", { name: "Close inspector" }));
    expect(openSurfaces()).toBe(0);
    expect(within(bar()).getByRole("button", { name: "Office outline" })).toHaveFocus();
  });

  it("replaces the rail when an item is located, and Escape returns to the rail", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await user.click(within(bar()).getByRole("button", { name: "1 blocked · 1 review" }));
    await user.click(
      screen.getByRole("button", { name: "Locate Provide current browser evidence: blocked" }),
    );
    expect(inspector()).toBeVisible();
    expect(rail()).toBeNull();
    expect(within(inspector()!).getByRole("button", { name: "Back to attention" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(rail()).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Locate Provide current browser evidence: blocked" }),
    ).toHaveFocus();
  });

  it("replaces the inspector with the Project Library, and closing it returns", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" library={officeLibraryFor("ready")} />);
    await openOfficeOutline(user);
    await user.click(screen.getByRole("button", { name: "Locate Review station" }));
    await user.click(screen.getByRole("button", { name: "Open Project Library" }));
    expect(library()).toBeVisible();
    expect(inspector()).toBeNull();
    expect(openSurfaces()).toBe(1);
    await user.click(screen.getByRole("button", { name: "Close Library" }));
    expect(inspector()).toBeVisible();
    expect(screen.getByRole("button", { name: "Open Project Library" })).toHaveFocus();
  });

  // Found by the Phase 4 Library e2e during GREEN: going back through two inspectors must return
  // to the first one's selection, not to an empty inspector.
  it("returns through Library and origin to the inspector that opened the Library", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" library={officeLibraryFor("ready")} />);
    await openOfficeOutline(user);
    await user.click(screen.getByRole("button", { name: "Locate Project Library" }));
    await user.click(screen.getByRole("button", { name: "Open Project Library" }));
    await user.click(screen.getByRole("button", { name: "View evidence_browser v1" }));
    await user.click(screen.getByRole("button", { name: "Locate origin in office" }));
    expect(inspector()).toHaveAttribute("data-selected-entity-id", "agent_test_engineer");
    await user.click(screen.getByRole("button", { name: "Back to Library" }));
    expect(library()).toBeVisible();
    expect(screen.getByRole("button", { name: "View evidence_browser v1" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Close Library" }));
    expect(inspector()).toHaveAttribute("data-selected-entity-id", "zone_library");
    expect(screen.getByRole("button", { name: "Open Project Library" })).toHaveFocus();
  });

  it("opening the outline from the bar closes the inspector", async () => {
    const user = userEvent.setup();
    render(<OfficeShell state="ready" />);
    await user.click(within(bar()).getByRole("button", { name: "1 blocked · 1 review" }));
    await user.click(
      screen.getByRole("button", { name: "Locate Provide current browser evidence: blocked" }),
    );
    await user.click(within(bar()).getByRole("button", { name: "Office outline" }));
    expect(outline()).toBeVisible();
    expect(openSurfaces()).toBe(1);
  });
});
