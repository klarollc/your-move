import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 7 Task 5 (spec F-6; rulings W-1 to W-4). The office is drawn as a room: back walls, the
 * window wall and baked daylight, and low front stubs. Lighting is fixed (MDD §9): the drawn room
 * is the same in every state the office shows, so light can never stand for activity, urgency or
 * failure. The field around the room is the Active system's own ground (W-3).
 */
const art = async (page: Page, query: string) => {
  await page.goto(`/${query}`);
  const drawn = page.locator("[data-office-canvas-host] svg [data-scene-art]");
  await expect(drawn).toHaveCount(1);
  return drawn.evaluate((element) => element.innerHTML);
};

test("@e2e Phase 7 the office is drawn as a room, lit the same in every state", async ({
  page,
}) => {
  const ready = await art(page, "?state=ready");
  for (const group of ["back", "daylight", "front"]) {
    expect(ready, `no ${group} architecture`).toContain(`data-arch="${group}"`);
  }
  for (const query of [
    "?state=stale",
    "?state=offline",
    "?state=partial",
    "?state=conflict",
    "?fixture=blocked-elsewhere",
  ]) {
    expect(await art(page, query), `the room changed under ${query}`).toBe(ready);
  }
});

test("@e2e Phase 7 the room sits on the Active system's ground", async ({ page }) => {
  await page.goto("/");
  const host = page.locator("[data-office-canvas-host]");
  await expect(host).toHaveCount(1);
  const ground = await page
    .getByRole("region", { name: "Office scene" })
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(ground).toBe("rgb(239, 231, 217)");
});
