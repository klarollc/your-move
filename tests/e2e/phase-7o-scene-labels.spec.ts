import { expect, test, type Locator } from "@playwright/test";

/**
 * Phase 7-O Task 9f-3, owner ruling P-3 (AR-01; constitution rules 2 and 9). The office carries
 * each person's name and plain state as horizontal screen-space text over their desk, and each
 * zone's name. Labels must be readable: inside the office, clear of the project bar, and never
 * on top of one another. They do not take the pointer, so the desk beneath stays selectable.
 */
const people = [
  "Delivery Lead",
  "Product Designer",
  "Implementation Engineer",
  "Test Engineer",
  "Visual QA Reviewer",
  "Release Reviewer",
];

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return box!;
};

test("@e2e Phase 7-O the office labels people and zones where they are", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const scene = page.getByRole("region", { name: "Office scene" });
  const labels = scene.getByRole("list", { name: "People and places in the office" });
  await expect(labels).toBeVisible();
  const sceneBox = await boxOf(scene);

  // Words, not colour alone: the Test Engineer's label says it needs the manager.
  const test = labels.getByRole("listitem").filter({ hasText: "Test Engineer" });
  await expect(test).toHaveText("Test Engineer · Blocked · Needs you");
  await expect(test).toHaveAttribute("data-needs-you", "true");
  const quiet = labels.getByRole("listitem").filter({ hasText: "Delivery Lead" });
  await expect(quiet).toHaveAttribute("data-needs-you", "false");
  const amber = await test.evaluate((element) => getComputedStyle(element).backgroundColor);
  const plain = await quiet.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(amber).not.toBe(plain);

  const items = labels.getByRole("listitem");
  await expect(items).toHaveCount(13);
  const boxes = [];
  for (let index = 0; index < 13; index += 1) {
    const item = items.nth(index);
    const box = await boxOf(item);
    const text = (await item.textContent()) ?? "";
    expect(box.y, `${text} runs above the office`).toBeGreaterThanOrEqual(sceneBox.y - 0.5);
    expect(box.x, `${text} runs off the left`).toBeGreaterThanOrEqual(sceneBox.x - 0.5);
    expect(box.x + box.width, `${text} runs off the right`).toBeLessThanOrEqual(
      sceneBox.x + sceneBox.width + 0.5,
    );
    boxes.push({ text, box });
  }
  for (const [index, left] of boxes.entries()) {
    for (const right of boxes.slice(index + 1)) {
      const overlap =
        left.box.x < right.box.x + right.box.width &&
        right.box.x < left.box.x + left.box.width &&
        left.box.y < right.box.y + right.box.height &&
        right.box.y < left.box.y + left.box.height;
      expect(overlap, `${left.text} overlaps ${right.text}`).toBe(false);
    }
  }

  // Moved (P-4, Phase 7 Task 3b, G-3): the graybox ran the desks left to right; the Active office
  // groups four in the team area and two at review. Each label now sits on the desk it names: the
  // scene's own hit region under the label's centre is that person's.
  const centres = [];
  for (const person of people) {
    const label = labels.getByRole("listitem").filter({ hasText: person }).first();
    const box = await boxOf(label);
    centres.push(box.x + box.width / 2);
    const under = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.getAttribute("data-entity-id") ?? null,
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(under, `${person}'s label is not on their desk`).toBe(
      `agent_${person.toLowerCase().replaceAll(" ", "_")}`,
    );
  }

  // Independently of the labels: the scene publishes the Implementation Engineer's desk centre.
  const anchor = await page
    .locator("[data-office-canvas-host]")
    .getAttribute("data-agent-implementation-screen");
  const [deskX] = (anchor ?? "").split(",").map(Number);
  expect(Math.abs(centres[2]! - (sceneBox.x + deskX!))).toBeLessThanOrEqual(2);

  // The label does not take the pointer: clicking the desk under it still selects the person.
  const pointer = await test.evaluate((element) => getComputedStyle(element).pointerEvents);
  expect(pointer).toBe("none");
  await page.screenshot({ path: testInfo.outputPath("scene-labels.png") });
});
