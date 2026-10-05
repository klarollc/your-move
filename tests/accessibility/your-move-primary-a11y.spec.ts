import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("@yourmove-a11y Your Move calm screen has no detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No work yet." })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
