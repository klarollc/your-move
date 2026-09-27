import { expect, test, type Page } from "@playwright/test";

// Phase 7-O Task 9d. Geometry the component tests cannot see: F-9-3 (V2), an outline card's
// Inspect button covering the person's name, and F-9-2 (V1), the project bar clipping its own
// controls at 200% zoom.

const PEOPLE = [
  "Delivery Lead",
  "Product Designer",
  "Implementation Engineer",
  "Test Engineer",
  "Visual QA Reviewer",
  "Release Reviewer",
];

const ZONES = [
  "Reception",
  "Team work area",
  "Project Library",
  "Collaboration table",
  "Review station",
  "Manager desk",
  "Delivery area",
];

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function expectWhollyVisible(page: Page, name: RegExp | string) {
  const control = page.getByRole("button", { name });
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  const width = await page.evaluate(() => window.innerWidth);
  expect(box, `${String(name)} has no box`).not.toBeNull();
  expect(box!.x, `${String(name)} starts off screen`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${String(name)} runs past the viewport`).toBeLessThanOrEqual(width);
  // Clipped when its label overflows the button, or when any ancestor that hides overflow cuts
  // the button off (the project bar has a fixed height and hides what spills out of it).
  const clipping = await control.evaluate((element) => {
    const own = element.getBoundingClientRect();
    const problems: string[] = [];
    if (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight) {
      problems.push("label overflows the button");
    }
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.overflowX === "visible" && style.overflowY === "visible") continue;
      const box = parent.getBoundingClientRect();
      if (
        own.left < box.left - 0.5 ||
        own.right > box.right + 0.5 ||
        own.top < box.top - 0.5 ||
        own.bottom > box.bottom + 0.5
      ) {
        problems.push(`cut off by <${parent.tagName.toLowerCase()} class="${parent.className}">`);
      }
    }
    return problems;
  });
  expect(clipping, `${String(name)} is clipped`).toStrictEqual([]);
  // The bar does not hide its overflow; the scene below paints over whatever spills out of it.
  // So the control must sit inside the bar's own box.
  const bar = await page.locator('header[aria-label="Project bar"]').boundingBox();
  expect(bar).not.toBeNull();
  expect(box!.y, `${String(name)} rises above the project bar`).toBeGreaterThanOrEqual(bar!.y);
  expect(box!.y + box!.height, `${String(name)} spills out of the project bar`).toBeLessThanOrEqual(
    bar!.y + bar!.height,
  );
}

/**
 * Every name in the outline is drawn whole: not covered by its button, and not cut off by its card.
 * People and zones both (the zone cards regressed in Task 9d's first capture).
 */
async function expectNamesReadable(page: Page) {
  const cards = [
    ...PEOPLE.map((person) => ({ person, action: `Inspect ${person}` })),
    ...ZONES.map((person) => ({ person, action: `Locate ${person}` })),
  ];
  for (const { person, action } of cards) {
    const button = page.getByRole("button", { name: action });
    const name = page
      .getByRole("region", { name: "Office outline" })
      .getByRole("heading", { name: person, exact: true });
    await button.scrollIntoViewIfNeeded();
    const buttonBox = await button.boundingBox();
    // The rendered text, not the heading's box: a narrow heading lets its words overflow it.
    const { glyphs, card } = await name.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const box = element.closest("li")!.getBoundingClientRect();
      return {
        glyphs: [...range.getClientRects()].map(({ x, y, width, height }) => ({
          x,
          y,
          width,
          height,
        })),
        card: { x: box.x, width: box.width },
      };
    });
    expect(buttonBox, person).toBeTruthy();
    expect(glyphs.length, `${person}: name has no rendered text`).toBeGreaterThan(0);
    for (const glyph of glyphs) {
      expect(overlaps(buttonBox!, glyph), `${person}: button covers the name`).toBe(false);
      expect(
        glyph.x >= card.x - 0.5 && glyph.x + glyph.width <= card.x + card.width + 0.5,
        `${person}: name runs outside its card`,
      ).toBe(true);
    }
  }
}

/** Nothing is painted over the control: hit tests at its centre and four inset corners land on it. */
async function expectUncovered(page: Page, name: string) {
  const control = page.getByRole("button", { name });
  const covered = await control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const inset = 3;
    const points = [
      [box.x + box.width / 2, box.y + box.height / 2],
      [box.left + inset, box.top + inset],
      [box.right - inset, box.top + inset],
      [box.left + inset, box.bottom - inset],
      [box.right - inset, box.bottom - inset],
    ];
    return points.flatMap(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      return hit && (hit === element || element.contains(hit))
        ? []
        : [`(${Math.round(x!)},${Math.round(y!)}) ${hit?.outerHTML.slice(0, 60) ?? "nothing"}`];
    });
  });
  expect(covered, `${name} is covered by another element`).toStrictEqual([]);
}

test("@e2e Phase 7-O outline cards never cover or cut off a person's name", async ({ page }) => {
  await page.goto("/");
  await expectNamesReadable(page);
});

test("@e2e Phase 7-O the project bar keeps its controls whole at 200% zoom", async ({ page }) => {
  await page.goto("/");
  const viewport = page.viewportSize();
  const halfWidth = Math.round((viewport?.width ?? 1440) / 2);
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: halfWidth,
    height: Math.round((viewport?.height ?? 900) / 2),
    deviceScaleFactor: 2,
    mobile: false,
  });
  expect(await page.evaluate(() => window.innerWidth), "zoom did not narrow the layout").toBe(
    halfWidth,
  );
  await expectWhollyVisible(page, "Manager attention (2)");
  await expectWhollyVisible(page, "Reset view");
  await expectNamesReadable(page);
  // With the inspector open, it must not be drawn over the wrapped project bar.
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  await expect(page.getByRole("complementary", { name: "Entity inspector" })).toBeVisible();
  await expectUncovered(page, "Manager attention (2)");
  await expectUncovered(page, "Reset view");
  await client.send("Emulation.clearDeviceMetricsOverride");
  await client.detach();
});
