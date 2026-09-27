import { expect, type Page } from "@playwright/test";

/**
 * Phase 7-O Task 9e: the Office outline is on demand. Specs that act through the outline open it
 * first, from the project bar. Idempotent: a no-op when it is already open.
 */
export async function openOfficeOutline(page: Page): Promise<void> {
  const outline = page.getByRole("region", { name: "Office outline" });
  if ((await outline.count()) > 0) return;
  await page.getByRole("button", { name: "Office outline", exact: true }).click();
  await expect(outline).toBeVisible();
}
