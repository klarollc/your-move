import { expect, test } from "@playwright/test";
import { OFFICE_FIXTURES } from "../../apps/web/src/office-fixtures/index.js";

// Phase 7-O Task 6 (P-4): the revision is the length of the canonical default log, not a literal.
const revision = OFFICE_FIXTURES.default!.events.length;

test("@e2e Phase 4 manager attention locates, dismisses, and records an exact disposition", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const scene = page.getByRole("region", { name: "Office scene" });
  const initialScene = await scene.boundingBox();
  const attentionTrigger = page.getByRole("button", { name: "1 blocked · 1 review" });

  await attentionTrigger.click();
  const rail = page.getByRole("complementary", { name: "Manager attention" });
  await expect(rail).toBeVisible();
  expect((initialScene?.width ?? 0) - ((await scene.boundingBox())?.width ?? 0)).toBe(280);
  await expect(rail.locator("[data-attention-id]").first()).toHaveAttribute(
    "data-attention-id",
    "attention_work_browser_evidence",
  );

  await page
    .getByRole("button", { name: "Locate Provide current browser evidence: blocked" })
    .click();
  await expect(scene).toHaveAttribute("data-selected-entity-id", "agent_test_engineer");
  await expect(page.getByRole("complementary", { name: "Entity inspector" })).toBeVisible();
  // Task 9f-2 (P-2): the inspector replaces the rail, so only its 320 px are taken.
  await expect(rail).toHaveCount(0);
  expect((initialScene?.width ?? 0) - ((await scene.boundingBox())?.width ?? 0)).toBe(320);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Entity inspector" })).toHaveCount(0);
  await expect(rail).toBeVisible();

  await page
    .getByRole("button", { name: "Dismiss Provide current browser evidence: blocked" })
    .click();
  await expect(page.getByRole("status").last()).toContainText("no disposition was recorded");

  // Task 9f-4 (P-4): one item at a time, with the disposition controls behind Respond.
  await expect(rail.getByText("1 of 1")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Respond to Deliver the approved graybox slice: review requested",
    })
    .click();
  await page
    .getByRole("textbox", {
      name: "Reason for Deliver the approved graybox slice: review requested",
    })
    .fill("Reviewed against the bounded graybox gate.");
  await page
    .getByRole("button", { name: "Submit Deliver the approved graybox slice: review requested" })
    .click();
  const receipt = page.getByRole("status", { name: "Disposition receipt" });
  await expect(receipt).toContainText("receipt_command_attention_work_graybox_slice_approve");
  await expect(receipt).toContainText(`revision ${revision} → ${revision + 1}`);
  await expect(receipt).toContainText("Agent-visible disposition: approve");
  const railBox = await rail.boundingBox();
  const receiptBox = await receipt.boundingBox();
  expect((receiptBox?.x ?? 0) + (receiptBox?.width ?? 0)).toBeLessThanOrEqual(
    (railBox?.x ?? 0) + (railBox?.width ?? 0),
  );
  await receipt.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("manager-attention.png") });

  await page.getByRole("button", { name: "Close attention" }).click();
  await expect(page.getByRole("button", { name: "1 review" })).toBeFocused();
  expect((await scene.boundingBox())?.width).toBe(initialScene?.width);
});

test("@e2e Phase 4 manager attention fails closed on stale state", async ({ page }) => {
  await page.goto("/?state=stale");
  await page.getByRole("button", { name: "1 blocked · 1 review" }).click();
  const rail = page.getByRole("complementary", { name: "Manager attention" });
  await expect(rail).toContainText("Refresh the current workspace before recording a disposition.");
  // Task 9f-4 (P-4): the disposition controls sit behind Respond.
  await rail.getByRole("button", { name: /^Respond to / }).click();
  await expect(rail.getByRole("button", { name: /^Submit / })).toBeDisabled();
});
