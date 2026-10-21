import { expect, test } from "@playwright/test";
import { openOfficeOutline } from "../support/office-outline.js";

test("@e2e Phase 4 office loads using loopback without application or request failures", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const nonLoopbackRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") nonLoopbackRequests.push(request.url());
  });

  await page.goto("/");

  await expect(page).toHaveTitle("Your Move — Graybox Office");
  await expect(page.getByRole("main", { name: "Your Move office workspace" })).toBeAttached();
  // Task 9e (P-4): the outline is on demand.
  await openOfficeOutline(page);
  await expect(page.getByRole("region", { name: "Office outline" })).toContainText(
    "Implementation Engineer",
  );
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(nonLoopbackRequests).toEqual([]);
});

test("@e2e Phase 4 office remains semantically stable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  // Task 9e (P-4): the page heading is the product name; the outline is on demand.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your Move");
  await expect(page.locator('svg[data-scene-renderer="svg"]')).toHaveCount(1);
  expect(await page.locator("html").evaluate((element) => element.getAnimations().length)).toBe(0);
});
