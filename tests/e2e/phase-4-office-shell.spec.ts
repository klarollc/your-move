import { expect, test, type Page } from "@playwright/test";
import { openOfficeOutline } from "../support/office-outline.js";

function browserFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    const knownDriverNoise =
      message.type() === "warning" && /GL Driver Message.*GPU stall due to ReadPixels/.test(text);
    if (!knownDriverNoise && (message.type() === "error" || message.type() === "warning")) {
      failures.push(`console:${message.type()}:${text}`);
    }
  });
  page.on("requestfailed", (request) => failures.push(`request:${request.url()}`));
  return failures;
}

test("@e2e Phase 4 default office keeps Pixi secondary to the keyboard-first outline", async ({
  page,
}, testInfo) => {
  const failures = browserFailures(page);
  await page.goto("/");

  const workspace = page.getByRole("main", { name: "Your Move office workspace" });
  await expect(workspace).toBeVisible();
  await expect(page.getByText("Your Move Phase 0 scaffold")).toHaveCount(0);
  // Task 9e (P-4): two persistent structures, the bar and the office. The first Tab reaches the
  // skip link, which opens the outline with focus inside.
  await expect(page.getByTestId("persistent-structure")).toHaveCount(2);
  await expect(page.locator('svg[data-scene-renderer="svg"]')).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Office outline" })).toHaveCount(0);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Open the Office outline" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Office outline" })).toBeFocused();
  await expect(page.getByRole("region", { name: "Office outline" })).toContainText(
    "Release Reviewer",
  );
  await expect(page.getByRole("button", { name: "Inspect Product Designer" })).toBeVisible();

  expect(failures).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("office-shell-ready.png") });
});

test("@e2e Phase 4 office preserves causes, actions, and render-error recovery", async ({
  page,
}) => {
  await page.goto("/?state=offline");
  // Task 9f-4 (P-4): AR-03 wording.
  await expect(page.getByTestId("workspace-cause")).toContainText("The runtime is offline");
  await expect(page.getByRole("button", { name: "Reconnect runtime" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset view" })).toBeVisible();
  // Task 9e (P-4, A-4): the cause and recovery sit in the status notice; the outline is on demand.
  await expect(page.getByTestId("workspace-notice")).toBeVisible();
  await openOfficeOutline(page);
  await expect(page.getByRole("region", { name: "Office outline" })).toBeVisible();

  // Phase 7 Task 3a (Q-1, P-4): SVG has no WebGL context to lose. A scene that fails to mount
  // becomes render-error through the adapter; here the state is entered by URL, and recovery is
  // what is exercised.
  await page.goto("/?state=render-error");
  const scene = page.locator('svg[data-scene-renderer="svg"]');
  await expect(page.getByTestId("workspace-cause")).toContainText("could not be drawn");
  await expect(page.getByRole("button", { name: "Redraw the office" })).toBeVisible();
  await expect(scene).toHaveCount(0);

  await page.getByRole("button", { name: "Redraw the office" }).click();
  await expect(scene).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("Workspace current");
});

test("@e2e Phase 4 office backdrop is deterministic and not decided by stylesheet order", async ({
  page,
}) => {
  await page.goto("/");
  // Defect D4-V2-001: three surface stylesheets each declared :root, so the office backdrop was
  // whichever one the bundler happened to place last. It is now owned by global.css alone.
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(227, 227, 223)");

  // The same accident set the reduced-motion reset. Assert the strict form actually applies.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  expect(await page.locator("html").evaluate((element) => element.getAnimations().length)).toBe(0);
});
