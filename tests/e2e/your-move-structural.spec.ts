import { expect, test, type Locator, type Page } from "@playwright/test";

import { routeHostedApi, signIn, streetDrafts } from "../support/your-move-hosted.js";

/**
 * Structural pass (2026-10-20, D2/D3/D4/D7): opening work never deforms the street. The sheet lands
 * full width beneath an unchanged scene, windows are keyboard buttons, and the table lives in List.
 */

type Box = { left: number; top: number; width: number; height: number };

/** A box in the scroll container's coordinates, so focus-driven scrolling does not move it. */
async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((element) => {
    const scroller = element.closest(".hosted-workspace")!;
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top + scroller.scrollTop,
      width: rect.width,
      height: rect.height,
    };
  });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("@e2e Your Move opens a sheet beneath an unchanged street and returns to nothing selected", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await routeHostedApi(page, streetDrafts);
  await signIn(page);

  await expect(page.getByText("7 windows lit · oldest first")).toBeVisible();
  const scene = page.getByRole("group", { name: "The street" });
  const windows = scene.getByRole("button");
  await expect(windows).toHaveCount(7);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "All work & history" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Your Move$/ })).toHaveCount(0);
  await expect(page.getByText("Your Move", { exact: true })).toHaveCount(1);

  const before = await boxOf(scene);
  const first = windows.first();
  await first.focus();
  await page.keyboard.press("Enter");
  const sheet = page.locator("#work-detail");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".ym3__workspace--open")).toHaveCount(0);

  // The street keeps its size and place; the sheet sits beneath it at full content width.
  expect(await boxOf(scene)).toEqual(before);
  const sheetBox = await boxOf(sheet);
  const content = await boxOf(page.locator(".ym3__status-line"));
  expect(sheetBox.top).toBeGreaterThanOrEqual(before.top + before.height);
  expect(sheetBox.left).toBeCloseTo(content.left, 0);
  expect(sheetBox.width).toBeCloseTo(content.width, 0);
  expect(sheetBox.width).toBeGreaterThan(before.width);

  await sheet.getByRole("button", { name: "Close this sheet" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  expect(await boxOf(scene)).toEqual(before);

  // Space opens a window as Enter does.
  await windows.nth(1).focus();
  await page.keyboard.press("Space");
  await expect(sheet).toBeVisible();
  expect(await boxOf(scene)).toEqual(before);
  expect(errors).toEqual([]);
});

test("@e2e Your Move keeps the table, search, filters, and history in List", async ({ page }) => {
  const errors = collectErrors(page);
  await routeHostedApi(page, streetDrafts);
  await signIn(page);

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("group", { name: "The street" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Queue" })).toHaveCount(0);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search waiting work" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filter by action" })).toBeVisible();
  await page.getByRole("button", { name: "All work & history" }).click();
  await expect(page.getByRole("heading", { name: "All work & history" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(10);
  await expect(page.getByRole("button", { name: "Next history page" })).toBeEnabled();

  await page.getByRole("button", { name: "Open Add a setup section" }).click();
  await expect(page.getByRole("region", { name: "Add a setup section" })).toBeVisible();
  await page.getByRole("button", { name: "Street", exact: true }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  // One sheet survives the view switch, still beneath the street.
  await expect(page.getByRole("region", { name: "Add a setup section" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("@e2e Your Move honors reduced motion on the street, slip, strip, and sheet", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await routeHostedApi(page, streetDrafts);
  await signIn(page);
  await page.getByRole("group", { name: "The street" }).getByRole("button").first().click();
  for (const selector of [".ym3__street-section", ".ym3-slip", ".ym3__strip", "#work-detail"]) {
    await expect(page.locator(selector)).toHaveCSS("animation-name", "none");
  }
});
