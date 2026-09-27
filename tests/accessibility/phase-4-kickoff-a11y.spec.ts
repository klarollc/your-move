import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openOfficeOutline } from "../support/office-outline.js";

for (const [name, query] of [
  ["an incomplete round", "/?kickoff=round"],
  ["a synthesised round with dissent", "/?kickoff=revision"],
] as const) {
  test(`@a11y Phase 4 kickoff has no detectable violations for ${name}`, async ({ page }) => {
    await page.goto(query);
    await openOfficeOutline(page);
    await page.getByRole("button", { name: "Locate Collaboration table" }).click();
    await page.getByRole("button", { name: "Open collaborative kickoff" }).click();
    await expect(page.getByRole("region", { name: "Collaborative kickoff" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("@a11y Phase 4 kickoff remains operable and violation-free at 200% zoom", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/?kickoff=revision");
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Locate Collaboration table" }).click();
  await page.getByRole("button", { name: "Open collaborative kickoff" }).click();
  // 200% zoom is emulated by halving the viewport at the same device scale factor.
  const viewport = page.viewportSize();
  if (viewport) {
    await page.setViewportSize({
      width: Math.round(viewport.width / 2),
      height: Math.round(viewport.height / 2),
    });
  }

  await expect(page.getByTestId("kickoff-decision-impact")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close kickoff" })).toBeVisible();
  expect(consoleErrors).toEqual([]);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
