import { expect, test, type Page } from "@playwright/test";
import { openOfficeOutline } from "../support/office-outline.js";

/** Phase 7 Task 6 (AR-01, AR-04): furnishings stay static and decorative around the office. */
const art = (page: Page) => page.locator("[data-office-canvas-host] svg [data-scene-art]");

const furnitureMarkup = async (page: Page) =>
  art(page).evaluate((scene) =>
    [...scene.querySelectorAll("[data-furniture]")].map((piece) => piece.outerHTML),
  );

async function furnitureLabelIntersections(page: Page) {
  return art(page).evaluate((scene) => {
    const furniture = new Set<SVGGeometryElement>();
    for (const piece of scene.querySelectorAll<SVGElement>("[data-furniture]")) {
      // This is Phase 6's unchanged original rug fill, identified and byte-checked by the unit
      // parity contract. New textile marks remain in the separately checked rug-detail group.
      if (piece.getAttribute("data-furniture") === "rug-surface") continue;
      if (piece instanceof SVGGeometryElement) furniture.add(piece);
      for (const shape of piece.querySelectorAll<SVGGeometryElement>(
        "path, polygon, polyline, rect, circle, ellipse, line",
      )) {
        furniture.add(shape);
      }
    }
    const paintAlpha = (paint: string) => {
      const slashAlpha = paint.match(/\/\s*(\d+(?:\.\d+)?%?)\s*\)$/)?.[1];
      const rgbaAlpha = paint.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*(\d+(?:\.\d+)?%?)\s*\)$/)?.[1];
      const alpha = slashAlpha ?? rgbaAlpha;
      if (alpha === undefined) return 1;
      return alpha.endsWith("%") ? Number(alpha.slice(0, -1)) / 100 : Number(alpha);
    };
    const sceneMatrix = scene.getScreenCTM()?.inverse();
    const paintOrder = [
      ...scene.querySelectorAll<SVGGeometryElement>(
        "path, polygon, polyline, rect, circle, ellipse, line",
      ),
    ].map((element) => {
      const style = getComputedStyle(element);
      let effectiveOpacity = 1;
      for (let node: Element | null = element; node && node !== scene; node = node.parentElement) {
        const opacity = Number(getComputedStyle(node).opacity);
        if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
      }
      const matrix = element.getScreenCTM();
      const clip = element.closest<SVGElement>("[clip-path]")?.getAttribute("clip-path");
      const clipId = clip?.match(/^url\(#([^)]*)\)$/)?.[1];
      const clipPath = clipId
        ? (scene.ownerDocument.getElementById(clipId) as SVGClipPathElement | null)
        : null;
      return {
        element,
        box: element.getBoundingClientRect(),
        inverse: matrix?.inverse(),
        clipShape: clipPath?.querySelector<SVGGeometryElement>(
          "path, polygon, polyline, rect, circle, ellipse",
        ),
        visible: style.visibility !== "hidden" && effectiveOpacity >= 0.999,
        opaqueFill:
          style.fill !== "none" &&
          Number(style.fillOpacity) >= 0.999 &&
          paintAlpha(style.fill) >= 0.999,
        opaqueStroke:
          style.stroke !== "none" &&
          Number(style.strokeOpacity) >= 0.999 &&
          paintAlpha(style.stroke) >= 0.999,
      };
    });
    const paintIndexes = new Map(paintOrder.map((entry, index) => [entry.element, index]));
    const fullyOpaqueAt = (index: number, screen: DOMPoint) => {
      const later = paintOrder[index];
      if (!later?.visible || !later.inverse) return false;
      const { box } = later;
      if (
        screen.x < box.left ||
        screen.x > box.right ||
        screen.y < box.top ||
        screen.y > box.bottom
      ) {
        return false;
      }
      if (
        later.clipShape &&
        sceneMatrix &&
        !later.clipShape.isPointInFill(screen.matrixTransform(sceneMatrix))
      ) {
        return false;
      }
      const local = screen.matrixTransform(later.inverse);
      return (
        (later.opaqueFill && later.element.isPointInFill(local)) ||
        (later.opaqueStroke && later.element.isPointInStroke(local))
      );
    };
    const labels = [...document.querySelectorAll<HTMLElement>("[data-scene-label]")];
    const findings = [...furniture].flatMap((piece) => {
      const pieceBox = piece.getBoundingClientRect();
      return labels.flatMap((label) => {
        const labelBox = label.getBoundingClientRect();
        const boundsOverlap =
          pieceBox.left < labelBox.right &&
          labelBox.left < pieceBox.right &&
          pieceBox.top < labelBox.bottom &&
          labelBox.top < pieceBox.bottom;
        if (!boundsOverlap) return [];
        const matrix = piece.getScreenCTM();
        if (!matrix)
          return [
            {
              furniture: piece
                .closest<SVGElement>("[data-furniture]")
                ?.getAttribute("data-furniture"),
              shape: piece.tagName.toLowerCase(),
              label: label.dataset.sceneLabel,
              reason: "no screen matrix",
            },
          ];
        const inverse = matrix.inverse();
        const computed = getComputedStyle(piece);
        const hasFill = computed.fill !== "none" && Number(computed.fillOpacity) > 0;
        const hasStroke = computed.stroke !== "none" && Number(computed.strokeOpacity) > 0;
        let effectiveOpacity = 1;
        for (let node: Element | null = piece; node && node !== scene; node = node.parentElement) {
          const opacity = Number(getComputedStyle(node).opacity);
          if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
        }
        if ((!hasFill && !hasStroke) || effectiveOpacity <= 0 || computed.visibility === "hidden") {
          return [];
        }
        const sampleLeft = Math.max(labelBox.left, pieceBox.left);
        const sampleRight = Math.min(labelBox.right, pieceBox.right);
        const sampleTop = Math.max(labelBox.top, pieceBox.top);
        const sampleBottom = Math.min(labelBox.bottom, pieceBox.bottom);
        const clip = piece.closest<SVGElement>("[clip-path]")?.getAttribute("clip-path");
        const clipId = clip?.match(/^url\(#([^)]*)\)$/)?.[1];
        const clipPath = clipId
          ? (scene.ownerDocument.getElementById(clipId) as SVGClipPathElement | null)
          : null;
        const clipShape = clipPath?.querySelector<SVGGeometryElement>(
          "path, polygon, polyline, rect, circle, ellipse",
        );
        const sceneMatrix = scene.getScreenCTM()?.inverse();
        // Group boxes include empty gaps; sample the actual primitive fill/stroke and honor its
        // computed paint, ancestor opacity and clip path. This reports true drawn geometry only.
        for (let y = sampleTop + 0.25; y < sampleBottom; y += 0.5) {
          for (let x = sampleLeft + 0.25; x < sampleRight; x += 0.5) {
            const screen = new DOMPoint(x, y);
            if (
              clipShape &&
              sceneMatrix &&
              !clipShape.isPointInFill(screen.matrixTransform(sceneMatrix))
            ) {
              continue;
            }
            const local = screen.matrixTransform(inverse);
            const painted =
              (hasFill && piece.isPointInFill(local)) ||
              (hasStroke && piece.isPointInStroke(local));
            if (painted) {
              const pieceIndex = paintIndexes.get(piece) ?? -1;
              let occluded = false;
              for (let index = pieceIndex + 1; index < paintOrder.length; index += 1) {
                if (fullyOpaqueAt(index, screen)) {
                  occluded = true;
                  break;
                }
              }
              if (occluded) continue;
              const owner = piece.closest<SVGElement>("[data-furniture]");
              const furniture = owner?.getAttribute("data-furniture");
              const item = owner?.getAttribute("data-item");
              const part = piece
                .closest<SVGElement>("[data-furniture-part]")
                ?.getAttribute("data-furniture-part");
              // Owner-approved narrow exception: the existing desk body and edge can sit under
              // that desk's own label; other work-surface details remain subject to clearance.
              if (
                furniture === "work-surface" &&
                item === label.dataset.sceneLabel &&
                part === "desk-surface"
              ) {
                continue;
              }
              return [
                {
                  furniture: furniture ?? piece.tagName,
                  zone: owner?.getAttribute("data-zone"),
                  item,
                  part,
                  shape: piece.tagName.toLowerCase(),
                  seam: piece.getAttribute("data-floor-seam"),
                  label: label.dataset.sceneLabel,
                  screen: [Math.round(x), Math.round(y)],
                  local: [Math.round(local.x * 100) / 100, Math.round(local.y * 100) / 100],
                  fill: computed.fill,
                  stroke: computed.stroke,
                  opacity: effectiveOpacity,
                  clip,
                },
              ];
            }
          }
        }
        // A half-CSS-pixel grid can still miss a thin diagonal stroke at inspector zoom. Probe
        // each SVG path's actual stroked centerline at subpixel intervals as a second pass.
        if (hasStroke && piece instanceof SVGPathElement) {
          const matrix = piece.getScreenCTM();
          if (matrix) {
            const screenScale = Math.max(
              Math.hypot(matrix.a, matrix.b),
              Math.hypot(matrix.c, matrix.d),
            );
            const length = piece.getTotalLength();
            const step = Math.max(0.05, 0.2 / Math.max(screenScale, 0.01));
            for (let distance = 0; distance <= length; distance += step) {
              const local = piece.getPointAtLength(distance);
              const screen = local.matrixTransform(matrix);
              if (
                screen.x < labelBox.left ||
                screen.x > labelBox.right ||
                screen.y < labelBox.top ||
                screen.y > labelBox.bottom ||
                (clipShape &&
                  sceneMatrix &&
                  !clipShape.isPointInFill(screen.matrixTransform(sceneMatrix))) ||
                !piece.isPointInStroke(local)
              ) {
                continue;
              }
              const pieceIndex = paintIndexes.get(piece) ?? -1;
              let occluded = false;
              for (let index = pieceIndex + 1; index < paintOrder.length; index += 1) {
                if (fullyOpaqueAt(index, screen)) {
                  occluded = true;
                  break;
                }
              }
              if (occluded) continue;
              const owner = piece.closest<SVGElement>("[data-furniture]");
              const furniture = owner?.getAttribute("data-furniture");
              const item = owner?.getAttribute("data-item");
              const part = piece
                .closest<SVGElement>("[data-furniture-part]")
                ?.getAttribute("data-furniture-part");
              if (
                furniture === "work-surface" &&
                item === label.dataset.sceneLabel &&
                part === "desk-surface"
              ) {
                continue;
              }
              return [
                {
                  furniture: furniture ?? piece.tagName,
                  zone: owner?.getAttribute("data-zone"),
                  item,
                  part,
                  shape: piece.tagName.toLowerCase(),
                  seam: piece.getAttribute("data-floor-seam"),
                  label: label.dataset.sceneLabel,
                  screen: [Math.round(screen.x), Math.round(screen.y)],
                  local: [Math.round(local.x * 100) / 100, Math.round(local.y * 100) / 100],
                  fill: computed.fill,
                  stroke: computed.stroke,
                  opacity: effectiveOpacity,
                  clip,
                },
              ];
            }
          }
        }
        return [];
      });
    });
    const unique = new Map<string, (typeof findings)[number]>();
    for (const finding of findings) {
      const key =
        typeof finding === "string"
          ? finding
          : JSON.stringify([
              finding.furniture,
              finding.item,
              finding.part,
              finding.shape,
              finding.label,
              finding.seam,
            ]);
      if (!unique.has(key)) unique.set(key, finding);
    }
    return [...unique.values()];
  });
}

const summarizeCollisions = (findings: Awaited<ReturnType<typeof furnitureLabelIntersections>>) => {
  const groups = new Map<string, { count: number; first: (typeof findings)[number] }>();
  for (const finding of findings) {
    const key = JSON.stringify([finding.furniture, finding.item, finding.part, finding.label]);
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { count: 1, first: finding });
  }
  return [...groups.entries()].map(([key, value]) => ({ key: JSON.parse(key), ...value }));
};

test("@e2e Phase 7 Task 6 static furniture stays identical across office fixtures", async ({
  page,
}) => {
  await page.goto("/?state=ready");
  const scene = art(page);
  await expect(scene).toHaveCount(1);
  const ready = await furnitureMarkup(page);
  const hitGeometry = await page
    .locator("[data-office-canvas-host] svg [data-entity-id]")
    .evaluateAll((targets) =>
      targets.map((target) => [
        target.getAttribute("data-entity-id"),
        target.getAttribute("points"),
      ]),
    );
  expect(ready.length, "the browser scene includes the approved furniture layer").toBeGreaterThan(
    0,
  );

  // Ready contains manager-waiting review; stale/offline make present activity unknown; named
  // fixtures add dependency blocks and permission stops; kickoff exercises the collaboration flow.
  for (const query of [
    "?state=stale",
    "?state=offline",
    "?state=partial",
    "?state=conflict",
    "?fixture=blocked-elsewhere",
    "?fixture=missing-artifact",
    "?kickoff=round",
  ]) {
    await page.goto(`/${query}`);
    await expect(art(page)).toHaveCount(1);
    expect(await furnitureMarkup(page), `furniture changed under ${query}`).toStrictEqual(ready);
    expect(
      await page
        .locator("[data-office-canvas-host] svg [data-entity-id]")
        .evaluateAll((targets) =>
          targets.map((target) => [
            target.getAttribute("data-entity-id"),
            target.getAttribute("points"),
          ]),
        ),
      `entity hit geometry changed under ${query}`,
    ).toStrictEqual(hitGeometry);
  }
});

test("@e2e Phase 7 Task 6 decoration is hidden from assistive technology and adds no text or controls", async ({
  page,
}) => {
  await page.goto("/");
  const decoration = art(page).locator("[data-furniture]");
  await expect(decoration.first()).toBeAttached();
  const violations = await art(page).evaluate((scene) => {
    const pieces = [...scene.querySelectorAll<SVGElement>("[data-furniture]")];
    return pieces.flatMap((piece) => {
      const problems: string[] = [];
      if (piece.querySelector("text")) problems.push("contains text");
      if (piece.querySelector("animate, animateMotion, animateTransform, set")) {
        problems.push("contains SVG animation");
      }
      if (piece.querySelector("a, button, input, [tabindex], [role], [onclick]")) {
        problems.push("contains an interactive descendant");
      }
      if (
        [piece, ...piece.querySelectorAll("*")].some((node) =>
          [...node.attributes].some(({ name }) => name.toLowerCase().startsWith("on")),
        )
      ) {
        problems.push("has an event handler");
      }
      return problems.map((problem) => `${piece.getAttribute("data-furniture")}: ${problem}`);
    });
  });
  await expect(page.locator("[data-office-canvas-host] svg")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(violations).toStrictEqual([]);
  await expect(page.locator("[data-scene-label]")).toHaveCount(13);
  const seams = await art(page).evaluate((scene) => {
    const paths = [...scene.querySelectorAll("path[data-floor-seam]")];
    return {
      count: paths.length,
      allClippedToFloor: paths.every(
        (path) =>
          path.closest("[clip-path]")?.getAttribute("clip-path") === "url(#furniture-floor-clip)",
      ),
    };
  });
  expect(seams.count, "floor seams are rendered as individual paths").toBeGreaterThan(0);
  expect(seams.allClippedToFloor).toBe(true);
  const personLabels = page.locator('[data-scene-label][data-placement="desk"]');
  const labelLayerIsAboveArt = await page.evaluate(() => {
    const svg = document.querySelector("[data-office-canvas-host] svg");
    const labels = document.querySelector(".office-scene-labels");
    return Boolean(
      svg && labels && svg.compareDocumentPosition(labels) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(labelLayerIsAboveArt, "the DOM label layer follows the decorative SVG").toBe(true);
  const personLabelPaint = await personLabels.evaluateAll((labels) =>
    labels.map((label) => getComputedStyle(label).backgroundColor),
  );
  expect(personLabelPaint.length).toBeGreaterThan(0);
  expect(
    personLabelPaint.every((color) => {
      if (color === "transparent") return false;
      if (color.startsWith("rgba(")) {
        const slashAlpha = color.match(/\/\s*([0-9.]+)\s*\)$/)?.[1];
        if (slashAlpha !== undefined) return Number(slashAlpha) === 1;
        const channels = color
          .slice(5, -1)
          .split(",")
          .map((part) => part.trim());
        return channels.length < 4 || Number(channels[3]) === 1;
      }
      return true;
    }),
    "person label plates have opaque computed backgrounds",
  ).toBe(true);
});

test("@e2e Phase 7 Task 6 labels stay clear and transparent hit targets remain operable", async ({
  page,
}) => {
  await page.goto("/");
  const initialCollisions = await furnitureLabelIntersections(page);
  await openOfficeOutline(page);
  await expect(page.getByRole("region", { name: "Office outline" })).toBeVisible();
  const inspect = page.getByRole("button", { name: "Inspect Test Engineer" });
  await inspect.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("complementary", { name: "Entity inspector" })).toBeVisible();
  // Return from the keyboard-opened inspector before exercising the canvas target by pointer.
  const closeInspector = page.getByRole("button", { name: "Close inspector" });
  const outlineToggle = page.getByRole("button", { name: "Office outline", exact: true });
  await closeInspector.focus();
  await page.keyboard.press("Enter");
  await expect(outlineToggle).toBeFocused();

  // The app's entity polygons intentionally occupy their represented furniture. They stay above
  // the art in paint order, transparent to vision and active for pointer selection.
  const svg = page.locator("[data-office-canvas-host] svg");
  await expect(svg.locator("[data-scene-art] + [data-scene-hits]")).toHaveCount(1);
  const target = svg.locator('[data-entity-id="agent_test_engineer"]');
  const box = await target.boundingBox();
  expect(box, "the existing person target remains present").not.toBeNull();
  const hitPointsBeforeSelection = await target.getAttribute("points");
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByRole("complementary", { name: "Entity inspector" })).toHaveAttribute(
    "data-selected-entity-id",
    "agent_test_engineer",
  );
  expect(await target.getAttribute("points"), "selection preserves canonical hit geometry").toBe(
    hitPointsBeforeSelection,
  );
  const pointerCollisions = await furnitureLabelIntersections(page);
  const collisions = [...initialCollisions, ...pointerCollisions];
  expect(
    collisions,
    `furniture leaves label plates clear before, during, and after inspector use; count=${collisions.length}; groups=${JSON.stringify(summarizeCollisions(collisions))}`,
  ).toStrictEqual([]);
});

test("@e2e Phase 7 Task 6 the browser clearance guard catches a moved-chair label collision", async ({
  page,
}) => {
  await page.goto("/");
  const mutation = await art(page).evaluate((scene) => {
    const chair = scene.querySelector<SVGGraphicsElement>('[data-furniture="team-chair"]');
    const label = document.querySelector<HTMLElement>("[data-scene-label]");
    const parent = chair?.parentElement;
    if (!chair || !label || !parent) return null;
    const labelBox = label.getBoundingClientRect();
    const target = new DOMPoint(
      labelBox.left + labelBox.width / 2,
      labelBox.top + labelBox.height / 2,
    );
    const world = target.matrixTransform(parent.getScreenCTM()!.inverse());
    const bounds = chair.getBBox();
    chair.setAttribute(
      "transform",
      `translate(${world.x - bounds.x - bounds.width / 2} ${world.y - bounds.y - bounds.height / 2})`,
    );
    return {
      chair: chair.getAttribute("data-furniture"),
      item: chair.getAttribute("data-item"),
      label: label.dataset.sceneLabel,
    };
  });
  expect(
    mutation,
    "the scene exposes a team chair and a rendered label for the mutation",
  ).not.toBeNull();
  const mutatedIntersections = await furnitureLabelIntersections(page);
  expect(
    mutatedIntersections.some(
      (intersection) =>
        typeof intersection !== "string" &&
        intersection.furniture === mutation!.chair &&
        intersection.label === mutation!.label,
    ),
    "the actual painted chair geometry now intersects the selected label plate",
  ).toBe(true);

  const cover = await art(page).evaluate((scene) => {
    const label = document.querySelector<HTMLElement>("[data-scene-label]");
    const matrix = scene.getScreenCTM()?.inverse();
    if (!label || !matrix) return false;
    const bounds = label.getBoundingClientRect();
    const corners = [
      new DOMPoint(bounds.left, bounds.top),
      new DOMPoint(bounds.right, bounds.top),
      new DOMPoint(bounds.right, bounds.bottom),
      new DOMPoint(bounds.left, bounds.bottom),
    ].map((point) => point.matrixTransform(matrix));
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const rect = scene.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("data-test-opaque-cover", "true");
    rect.setAttribute("x", String(Math.min(...xs)));
    rect.setAttribute("y", String(Math.min(...ys)));
    rect.setAttribute("width", String(Math.max(...xs) - Math.min(...xs)));
    rect.setAttribute("height", String(Math.max(...ys) - Math.min(...ys)));
    rect.setAttribute("fill", "rgb(255, 255, 255)");
    scene.append(rect);
    return true;
  });
  expect(cover, "the test can add an opaque later-painted art cover over the plate").toBe(true);
  const coveredIntersections = await furnitureLabelIntersections(page);
  expect(
    coveredIntersections.some(
      (intersection) =>
        typeof intersection !== "string" &&
        intersection.furniture === mutation!.chair &&
        intersection.item === mutation!.item &&
        intersection.label === mutation!.label,
    ),
    "later opaque art hides the moved chair at the sampled plate region",
  ).toBe(false);
});

test("@e2e Phase 7 Task 6 furniture stays label-clear at inspector-open zoom and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const defaultCollisions = await furnitureLabelIntersections(page);
  await openOfficeOutline(page);
  await page.getByRole("button", { name: "Inspect Test Engineer" }).click();
  await expect(page.getByRole("complementary", { name: "Entity inspector" })).toBeVisible();
  const inspectorCollisions = await furnitureLabelIntersections(page);
  const collisions = [...defaultCollisions, ...inspectorCollisions];
  expect(
    collisions,
    `furniture remains clear at default and inspector-open zoom with reduced motion; count=${collisions.length}; groups=${JSON.stringify(summarizeCollisions(collisions))}`,
  ).toStrictEqual([]);
  expect(
    await art(page).locator("[data-furniture] animate, [data-furniture] animateMotion").count(),
  ).toBe(0);
});

test("@e2e Phase 7 Task 6 browser rendering has no new console, page, or external-network errors", async ({
  page,
  baseURL,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const externalRequests: string[] = [];
  const failedResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.url()} ${request.failure()?.errorText}`),
  );
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) {
      externalRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto("/");
  await expect(art(page).locator("[data-furniture]").first()).toBeAttached();

  expect(consoleErrors).toStrictEqual([]);
  expect(pageErrors).toStrictEqual([]);
  expect(failedRequests).toStrictEqual([]);
  expect(failedResponses).toStrictEqual([]);
  expect(externalRequests).toStrictEqual([]);
});
