import { expect, test, type Locator } from "@playwright/test";

import { openOfficeOutline } from "../support/office-outline.js";

/**
 * Phase 7 Task 1, tokens (spec F-5; owner rulings T-1 and T-2, 2026-10-03). Fira Sans is the
 * office's interface face and Fira Mono its technical face, loaded from the app's own origin. The
 * assertion is the computed face and a loaded font file, not a stylesheet's text.
 */
const leadingFamily = (locator: Locator) =>
  locator.evaluate((element) =>
    getComputedStyle(element).fontFamily.split(",")[0]!.trim().replaceAll('"', ""),
  );
const loadedFaces = (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => face.family.replaceAll('"', ""));
  });

test("@e2e Phase 7 the office speaks Fira Sans, and shows identifiers in Fira Mono", async ({
  page,
}) => {
  await page.goto("/");
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  const inspector = page.getByRole("complementary", { name: "Entity inspector" });

  // T-2: the plain-language first screen stays in the interface face.
  const happening = inspector
    .getByText("What's happening", { exact: true })
    .locator("xpath=following-sibling::dd[1]");
  expect(await leadingFamily(happening)).toBe("Fira Sans");
  expect(
    await leadingFamily(page.getByRole("button", { name: "Office outline", exact: true })),
  ).toBe("Fira Sans");

  // T-2: identifiers and timestamps under Technical detail are in the technical face.
  await inspector.getByText("Technical detail", { exact: true }).click();
  const cause = inspector
    .locator(".office-inspector-technical")
    .getByText("Cause", { exact: true })
    .locator("xpath=following-sibling::dd[1]");
  await expect(cause).toContainText("event_office_");
  expect(await leadingFamily(cause)).toBe("Fira Mono");

  const faces = await loadedFaces(page);
  expect(faces).toContain("Fira Sans");
  expect(faces).toContain("Fira Mono");
});

test("@e2e Phase 7 the Decision Notice fixture page uses Fira Sans; its card keeps its own stack", async ({
  page,
}) => {
  // T-1: the fonts load from the one global stylesheet, which the fixture also loads.
  await page.goto("http://127.0.0.1:4175/?surface=decision-notice-capture&state=pending");
  const card = page.locator('[data-capture-state="pending"]');
  await expect(card).toBeVisible();
  expect(await leadingFamily(page.locator("body"))).toBe("Fira Sans");
  // A declared family is not an available one. Little on this page is set in the interface face,
  // so the face may never be needed; forcing a load proves it is declared and served here.
  const loadable = await page.evaluate(
    async () => (await document.fonts.load('16px "Fira Sans"')).length,
  );
  expect(loadable).toBeGreaterThan(0);
  // The card's own stylesheet sets its families; the token change does not reach them.
  const cardFamily = await page
    .locator(".decision-notice")
    .first()
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(cardFamily).toMatch(/^"Segoe UI Variable"/u);
});
