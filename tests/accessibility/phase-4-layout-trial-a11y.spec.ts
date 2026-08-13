import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const state of ["canonical", "both-overlays"] as const) {
  test(`@a11y Phase 4 ${state} layout trial has an accessible graybox structure`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const query = state === "both-overlays" ? "&overlays=both" : "";
    await page.goto(`/?surface=layout-trial${query}`);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    const reset = page.getByRole("button", { name: "Reset view" });
    await page.keyboard.press("Tab");
    await expect(reset).toBeFocused();
    await expect(reset).toHaveCSS("min-height", "44px");
    await expect(
      page.getByRole("img", {
        name: "All office zones and six role anchors at canonical reset",
      }),
    ).toBeVisible();
  });
}
