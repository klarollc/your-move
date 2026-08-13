import { expect, test } from "@playwright/test";

test("@e2e Phase 4 Pixi scene mounts WebGL, reconciles depth, and resizes", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?surface=pixi-probe");

  const scene = page.getByRole("main", { name: "Phase 4 Pixi scene probe" });
  const canvas = scene.locator('canvas[data-scene-renderer="pixi"]');
  await expect(canvas).toHaveCount(1);
  await expect(scene).toHaveAttribute("data-scene-order", "zone_team,agent_a,agent_b");
  await expect(page.getByRole("region", { name: "Office scene outline" })).toContainText(
    "Implementation Engineer",
  );
  expect(
    await canvas.evaluate((element) =>
      Boolean(
        element.getContext("webgl2") ??
        element.getContext("webgl") ??
        element.getContext("experimental-webgl"),
      ),
    ),
  ).toBe(true);

  await page.screenshot({ path: testInfo.outputPath("pixi-probe-ready.png") });

  const agentCenter = await scene.getAttribute("data-agent-a-screen");
  const [agentX, agentY] = agentCenter?.split(",").map(Number) ?? [];
  await canvas.click({ position: { x: agentX ?? 0, y: agentY ?? 0 } });
  await expect(scene).toHaveAttribute("data-last-intent", "scene.entity.select:agent_a");
  await page.setViewportSize({ width: 1024, height: 700 });
  await expect(scene).toHaveAttribute("data-render-width", "1024");
  await expect(scene).toHaveAttribute("data-render-height", "644");
  expect(consoleErrors).toEqual([]);
});

test("@e2e Phase 4 Pixi scene preserves a DOM fallback and releases the renderer", async ({
  page,
}, testInfo) => {
  await page.goto("/?surface=pixi-probe");

  const scene = page.getByRole("main", { name: "Phase 4 Pixi scene probe" });
  const canvas = scene.locator('canvas[data-scene-renderer="pixi"]');
  await expect(canvas).toHaveCount(1);

  await canvas.dispatchEvent("webglcontextlost");
  await expect(scene).toHaveAttribute("data-canvas-unavailable", "true");
  await expect(page.getByRole("status")).toHaveText(
    "Canvas unavailable. Office outline remains available.",
  );
  await expect(page.getByRole("region", { name: "Office scene outline" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("pixi-probe-fallback.png") });

  await page.getByRole("button", { name: "Retry canvas" }).click();
  await expect(scene).toHaveAttribute("data-canvas-unavailable", "false");
  await expect(canvas).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("Canvas ready.");

  await page.getByRole("button", { name: "Release renderer" }).click();
  await expect(canvas).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Renderer released.");
});
