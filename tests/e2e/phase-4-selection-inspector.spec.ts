import { expect, test } from "@playwright/test";
import { openOfficeOutline } from "../support/office-outline.js";

test("@e2e Phase 4 outline selection resizes the scene and restores trigger focus", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const scene = page.getByRole("region", { name: "Office scene" });
  // Task 9e (P-4): measured with the outline open, so the inspector's 320 px is what is compared.
  await openOfficeOutline(page);
  const before = await scene.boundingBox();
  const trigger = page.getByRole("button", { name: "Inspect Product Designer" });

  await trigger.click();

  const inspector = page.getByRole("complementary", { name: "Entity inspector" });
  await expect(inspector).toHaveAttribute("data-selected-entity-id", "agent_product_designer");
  await expect(scene).toHaveAttribute("data-selected-entity-id", "agent_product_designer");
  const after = await scene.boundingBox();
  expect((before?.width ?? 0) - (after?.width ?? 0)).toBe(320);
  await expect(inspector).toContainText("Technical trail");
  await page.screenshot({ path: testInfo.outputPath("selection-inspector.png") });

  await page.keyboard.press("Escape");
  await expect(inspector).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect((await scene.boundingBox())?.width).toBe(before?.width);
});

test("@e2e Phase 4 canvas selection opens the same stable entity inspector", async ({ page }) => {
  await page.goto("/");
  const scene = page.getByRole("region", { name: "Office scene" });
  const canvas = scene.locator('canvas[data-scene-renderer="pixi"]');
  const host = page.locator("[data-office-canvas-host]");
  await expect(canvas).toHaveCount(1);
  const center = await host.getAttribute("data-agent-implementation-screen");
  expect(center).toBeTruthy();
  const [x, y] = center?.split(",").map(Number) ?? [];

  await canvas.click({ position: { x: x ?? 0, y: y ?? 0 } });

  await expect(page.getByRole("complementary", { name: "Entity inspector" })).toHaveAttribute(
    "data-selected-entity-id",
    "agent_implementation_engineer",
  );
  await expect(scene).toHaveAttribute("data-selected-entity-id", "agent_implementation_engineer");
  await expect(page.getByRole("status")).toContainText("Implementation Engineer selected");
});
