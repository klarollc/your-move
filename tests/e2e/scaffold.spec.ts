import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

test("@e2e Phase 0 scaffold loads using loopback without console or request failures", async ({
  page,
}, testInfo) => {
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

  await expect(page).toHaveTitle("CuckCode — Phase 0 Scaffold");
  await expect(page.getByRole("main", { name: "CuckCode Phase 0 scaffold" })).toBeAttached();
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(nonLoopbackRequests).toEqual([]);
  await page.screenshot({
    path: resolve(
      "docs",
      "evidence",
      "phase-0",
      "rendered",
      `phase-0-scaffold-${testInfo.project.name}.png`,
    ),
  });
});

test("@e2e Phase 0 scaffold remains stable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CuckCode Phase 0 scaffold");
  expect(await page.locator("html").evaluate((element) => element.getAnimations().length)).toBe(0);
});
