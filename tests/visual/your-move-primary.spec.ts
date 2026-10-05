import { expect, test } from "@playwright/test";

test("@yourmove-visual Your Move calm screen captures a clean reduced-motion build", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url()));

  await page.emulateMedia({ reducedMotion: "reduce" });
  const sessionResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/session"),
  );
  await page.goto("/");
  expect((await sessionResponse).status()).toBe(200);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No work yet." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Your move: 0 matters" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ New work" })).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Your move/u })).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
  const screenshot = await page.screenshot({
    path: testInfo.outputPath("your-move-calm-screen.png"),
    fullPage: true,
  });

  expect(testInfo.project.name).toMatch(/^chromium-(1440|1280)$/u);
  expect(screenshot.byteLength).toBeGreaterThan(100);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
