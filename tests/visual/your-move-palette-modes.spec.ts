import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { evidenceOutputPath } from "../support/evidence-output.js";
import { routeHostedApi, signIn, streetDrafts } from "../support/your-move-hosted.js";

type Theme = "dark" | "light";

async function useConnectedAnthropicFixture(page: Page): Promise<void> {
  await page.route("**/api/providers/anthropic/models/refresh", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ models: [] }),
    }),
  );
  await page.route("**/api/providers", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        providers: [
          { id: "openai", status: "disconnected" },
          { id: "anthropic", status: "connected" },
        ],
        modelSelection: { mode: "automatic" },
      }),
    }),
  );
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  theme: Theme,
  name: string,
): Promise<string> {
  const width = page.viewportSize()?.width;
  if (!width) throw new Error("PALETTE_SCREENSHOT_VIEWPORT_MISSING");
  const path = evidenceOutputPath(
    testInfo,
    `your-move-palette-modes/${theme}/${width}-${name}.png`,
  );
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: "disabled", caret: "hide" });
  return path;
}

async function measureContrast(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string) => style.getPropertyValue(name).trim();
    const parse = (hex: string) => {
      const value = hex.startsWith("#") ? hex.slice(1) : hex;
      const expanded =
        value.length === 3 ? [...value].map((part) => `${part}${part}`).join("") : value;
      return [0, 2, 4].map(
        (offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255,
      );
    };
    const linear = (value: number) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    const luminance = (color: string) => {
      const [red, green, blue] = parse(color).map(linear);
      return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
    };
    const ratio = (foreground: string, background: string) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return Math.round(((values[0]! + 0.05) / (values[1]! + 0.05)) * 100) / 100;
    };
    const canvas = token("--ym-canvas");
    const paper = token("--ym-paper");
    return {
      "ink/canvas": ratio(token("--ym-canvas-text"), canvas),
      "ink/paper": ratio(token("--ym-paper-text"), paper),
      "muted/canvas": ratio(token("--ym-canvas-muted"), canvas),
      "muted/paper": ratio(token("--ym-paper-muted"), paper),
      "accent/canvas": ratio(token("--ym-accent"), canvas),
      "attention/paper": ratio(token("--ym-attention"), paper),
    };
  });
}

async function saveContrastReport(
  testInfo: TestInfo,
  theme: Theme,
  width: number,
  contrast: Record<string, number>,
): Promise<void> {
  const path = evidenceOutputPath(
    testInfo,
    `your-move-palette-modes/${theme}/${width}-contrast.json`,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ theme, width, contrast }, null, 2)}\n`, "utf8");
}

for (const theme of ["dark", "light"] as const) {
  test(`@visual Your Move ${theme} palette at the project viewport`, async ({ page }, testInfo) => {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("PALETTE_SCREENSHOT_VIEWPORT_MISSING");
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const badResponses: string[] = [];
    const externalRequests: string[] = [];
    const origin = new URL(testInfo.project.use.baseURL as string).origin;
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
    });
    page.on("request", (request) => {
      if (!request.url().startsWith(origin)) externalRequests.push(request.url());
    });
    await page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark" });
    await page.addInitScript((selectedTheme) => {
      window.localStorage.setItem("your-move-theme", selectedTheme);
    }, theme);
    await routeHostedApi(page, streetDrafts);
    await useConnectedAnthropicFixture(page);
    await signIn(page);

    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByText("7 windows lit · oldest first")).toBeVisible();
    const contrast = await measureContrast(page);
    for (const ratio of Object.values(contrast)) expect(ratio).toBeGreaterThanOrEqual(4.5);
    await saveContrastReport(testInfo, theme, viewport.width, contrast);
    await capture(page, testInfo, theme, "street");

    await page.getByRole("button", { name: "Connections", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Connections" })).toBeVisible();
    await page.getByRole("button", { name: "Open Anthropic settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Anthropic settings" });
    await expect(dialog.getByRole("button", { name: "Replace Anthropic key" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Disconnect Anthropic" })).toBeVisible();
    await capture(page, testInfo, theme, "connections-overlay");

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
    expect(badResponses).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
}

test("@e2e theme toggle is keyboard-accessible and provider actions fit narrow overlays", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const badResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await routeHostedApi(page, streetDrafts);
  await useConnectedAnthropicFixture(page);
  await signIn(page);

  const themeToggle = page.getByRole("button", { name: "Dark mode" });
  await themeToggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();

  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page.getByRole("button", { name: "Open Anthropic settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Anthropic settings" });
  await expect(dialog).toHaveCSS("animation-name", "none");

  for (const theme of ["dark", "light"] as const) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
      await dialog.getByRole("button", { name: "Close Anthropic settings" }).click();
      await page
        .getByRole("button", { name: theme === "dark" ? "Dark mode" : "Light mode" })
        .click();
      await page.getByRole("button", { name: "Open Anthropic settings" }).click();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [370, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const row = dialog.locator(".provider-settings__key-row");
      const actions = [
        row.getByRole("button", { name: "Replace Anthropic key" }),
        row.getByRole("button", { name: "Disconnect Anthropic" }),
      ];
      const rowWidth = (await row.boundingBox())?.width;
      expect(rowWidth).toBeGreaterThan(0);
      const boxes = await Promise.all(
        actions.map((button) =>
          button.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            };
          }),
        ),
      );
      for (const box of boxes) {
        expect(box.width).toBeCloseTo(rowWidth!, 0);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
      }
      expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height - 1);
      expect(Math.abs(boxes[1]!.x - boxes[0]!.x)).toBeLessThan(1);
    }
  }

  expect({ consoleErrors, badResponses }).toEqual({ consoleErrors: [], badResponses: [] });
  expect(pageErrors).toEqual([]);
});
