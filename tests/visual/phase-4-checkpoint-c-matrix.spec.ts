import { expect, test } from "@playwright/test";

test("@visual Phase 4 captures blocked and offline truth", async ({ page }, testInfo) => {
  for (const state of ["permission-denied", "offline"] as const) {
    await page.goto(`/?state=${state}`);
    await expect(page.getByRole("region", { name: "Office outline" })).toBeVisible();
    await expect(page.getByTestId("workspace-cause")).not.toContainText(
      "Canonical workspace revision 42 is current",
    );
    await page.screenshot({ path: testInfo.outputPath(`${state}.png`) });
  }
});

test("@visual Phase 4 captures reconnect recovery", async ({ page }, testInfo) => {
  await page.goto("/?state=offline");
  await page.getByRole("button", { name: "Reconnect runtime" }).click();
  await expect(page.getByTestId("workspace-cause")).toContainText(
    "Canonical workspace revision 42 is current",
  );
  await page.screenshot({ path: testInfo.outputPath("reconnected.png") });
});

test("@visual Phase 4 captures keyboard-first focus", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to Office outline" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("keyboard-focus.png") });
});
