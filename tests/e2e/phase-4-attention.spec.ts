import { expect, test } from "@playwright/test";

test("@e2e Phase 4 manager attention locates, dismisses, and records an exact disposition", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const scene = page.getByRole("region", { name: "Office scene" });
  const initialScene = await scene.boundingBox();
  const attentionTrigger = page.getByRole("button", { name: "Manager attention (2)" });

  await attentionTrigger.click();
  const rail = page.getByRole("complementary", { name: "Manager attention" });
  await expect(rail).toBeVisible();
  expect((initialScene?.width ?? 0) - ((await scene.boundingBox())?.width ?? 0)).toBe(280);
  await expect(rail.locator("[data-attention-id]").first()).toHaveAttribute(
    "data-attention-id",
    "attention_blocked_test",
  );

  await page.getByRole("button", { name: "Locate Test evidence is blocked" }).click();
  await expect(scene).toHaveAttribute("data-selected-entity-id", "agent_test_engineer");
  await expect(page.getByRole("complementary", { name: "Entity inspector" })).toBeVisible();
  expect((initialScene?.width ?? 0) - ((await scene.boundingBox())?.width ?? 0)).toBe(600);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Entity inspector" })).toHaveCount(0);
  await expect(rail).toBeVisible();

  await page.getByRole("button", { name: "Dismiss Test evidence is blocked" }).click();
  await expect(page.getByRole("status").last()).toContainText("no disposition was recorded");

  await page
    .getByRole("textbox", { name: "Reason for Graybox review requested" })
    .fill("Reviewed against the bounded graybox gate.");
  await page.getByRole("button", { name: "Submit Graybox review requested" }).click();
  const receipt = page.getByRole("status", { name: "Disposition receipt" });
  await expect(receipt).toContainText("receipt_command_attention_graybox_review_approve");
  await expect(receipt).toContainText("revision 42 → 43");
  await expect(receipt).toContainText("Agent-visible disposition: approve");
  const railBox = await rail.boundingBox();
  const receiptBox = await receipt.boundingBox();
  expect((receiptBox?.x ?? 0) + (receiptBox?.width ?? 0)).toBeLessThanOrEqual(
    (railBox?.x ?? 0) + (railBox?.width ?? 0),
  );
  await receipt.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("manager-attention.png") });

  await page.getByRole("button", { name: "Close attention" }).click();
  await expect(page.getByRole("button", { name: "Manager attention (1)" })).toBeFocused();
  expect((await scene.boundingBox())?.width).toBe(initialScene?.width);
});

test("@e2e Phase 4 manager attention fails closed on stale state", async ({ page }) => {
  await page.goto("/?state=stale");
  await page.getByRole("button", { name: "Manager attention (2)" }).click();
  const rail = page.getByRole("complementary", { name: "Manager attention" });
  await expect(rail).toContainText("Refresh the current workspace before recording a disposition.");
  await expect(rail.getByRole("button", { name: /^Submit / }).first()).toBeDisabled();
});
