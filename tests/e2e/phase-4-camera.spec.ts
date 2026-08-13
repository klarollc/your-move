import { expect, test } from "@playwright/test";

test("@e2e Phase 4 camera keeps transformed selection and pointer-keyboard parity", async ({
  page,
}) => {
  await page.goto("/?surface=pixi-probe");

  const scene = page.getByRole("main", { name: "Phase 4 Pixi scene probe" });
  const canvas = scene.locator('canvas[data-scene-renderer="pixi"]');
  await expect(canvas).toHaveCount(1);
  const canonical = await scene.getAttribute("data-camera");
  expect(canonical).toBeTruthy();

  const center = await scene.getAttribute("data-agent-a-screen");
  expect(center).toBeTruthy();
  const [x, y] = center?.split(",").map(Number) ?? [];
  await canvas.click({ position: { x: x ?? 0, y: y ?? 0 } });
  await expect(scene).toHaveAttribute("data-last-intent", "scene.entity.select:agent_a");

  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  await zoomOut.click();
  const pointerZoom = await scene.getAttribute("data-camera");
  expect(pointerZoom).not.toBe(canonical);
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(scene).toHaveAttribute("data-camera", canonical ?? "");
  await expect(scene).toHaveAttribute("data-last-intent", "scene.entity.select:agent_a");

  await zoomOut.focus();
  await page.keyboard.press("Enter");
  await expect(scene).toHaveAttribute("data-camera", pointerZoom ?? "");
});

test("@e2e Phase 4 camera is bounded, recoverable, fixed-orientation, and drag-free", async ({
  page,
}) => {
  await page.goto("/?surface=pixi-probe");

  const scene = page.getByRole("main", { name: "Phase 4 Pixi scene probe" });
  await expect(scene).toHaveAttribute("data-camera-rotation", "0");
  await expect(page.getByRole("button", { name: /rotate|orbit|perspective/i })).toHaveCount(0);

  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  for (let index = 0; index < 10; index += 1) await zoomOut.click();
  await expect(scene).toHaveAttribute("data-camera-zoom", "0.625");

  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  for (let index = 0; index < 10; index += 1) await zoomIn.click();
  await expect(scene).toHaveAttribute("data-camera-zoom", "1.25");

  const panLeft = page.getByRole("button", { name: "Pan left" });
  for (let index = 0; index < 100; index += 1) await panLeft.click();
  await expect(scene).toHaveAttribute(
    "data-camera-x",
    (await scene.getAttribute("data-pan-min-x")) ?? "",
  );
  await expect(page.getByRole("button", { name: "Reset view" })).toBeVisible();
  await expect(page.locator('[draggable="true"]')).toHaveCount(0);
});
