import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test, type CDPSession, type Page, type TestInfo } from "@playwright/test";

import { readPhase5Contract } from "../support/contract-input.js";
import { evidenceOutputPath } from "../support/evidence-output.js";

/**
 * C-09, closed properly — the owner ruled it on 2026-09-14 after release review pass 4.
 *
 * The criterion reads: "At both D-07 viewports, reduced motion and 200% zoom each preserve **every
 * state's** accessible name and structure, with no horizontal overflow and no content lost."
 *
 * What existed was one state under zoom and nine under axe. The reviewer refused it in those words:
 * the evidence "does not establish preservation of accessible names and structure for every
 * inventory state under both reduced motion and 200% zoom at both approved viewports."
 *
 * The word doing the work is **preserve**, which is a comparison, not a property. So each state is
 * measured three times — unconstrained, under reduced motion, under real 200% zoom — and the two
 * constrained readings must equal the baseline. A test that only checked "the name is non-empty
 * under zoom" would pass on a build that silently swapped every name, which is exactly the kind of
 * guard this project keeps finding: exact inside a boundary nobody examined.
 *
 * The states are read from the surface contract, not listed here. C-20 taught that lesson: "every
 * state" is only a claim when the set is written down somewhere a test can read.
 */

// Phase 5 fixture removal (D-2): the fixture's own production build, not the office bundle.
const ORIGIN = "http://127.0.0.1:4175";

type SurfaceContract = {
  requiredStates: string[];
  contract: { stateInventory: Array<{ id: string; accessibleName: string }> };
};

const surface = readPhase5Contract<SurfaceContract>("surface-contract.json");

type Condition = "baseline" | "reduced-motion" | "zoom-200";

/**
 * The structural signature of the rendered card.
 *
 * Roles and accessible names are what a screen reader consumes; the data markers are what the
 * contract's non-colour cues are built from. Recording both means a change that keeps the names and
 * loses the markers — or the reverse — still fails.
 */
type Signature = {
  roles: string[];
  markers: string[];
  labels: string[];
};

const signature = (page: Page): Promise<Signature> =>
  page.evaluate(() => {
    const card = document.querySelector("article");
    if (!card) return { roles: [], markers: [], labels: [] };

    /**
     * Rendered, not merely present.
     *
     * The first version of this read `textContent`, which returns text that CSS has hidden. A
     * mutant adding `@media (max-width: 800px) { .severity span { display: none } }` — a label that
     * vanishes at exactly the width 200% zoom produces — survived it. The whole criterion is about
     * what survives a constraint, so the measurement has to be of what is perceivable under it.
     */
    const rendered = [...card.querySelectorAll<HTMLElement>("*")].filter((element) =>
      typeof element.checkVisibility === "function"
        ? element.checkVisibility({
            contentVisibilityAuto: true,
            opacityProperty: true,
            visibilityProperty: true,
          })
        : element.getClientRects().length > 0,
    );

    return {
      roles: rendered
        .filter((element) => element.getAttribute("role") !== null)
        .map(
          (element) =>
            `${element.getAttribute("role")}:${element.getAttribute("aria-label") ?? element.getAttribute("aria-labelledby") ?? ""}`,
        )
        .sort(),
      markers: rendered
        .flatMap((element) =>
          [...element.attributes]
            .filter((attribute) => attribute.name.startsWith("data-"))
            .filter((attribute) => attribute.name !== "data-capture-state")
            .map((attribute) => `${attribute.name}=${attribute.value}`),
        )
        .sort(),
      // Every leaf's visible text, so "content lost" is measurable rather than assumed.
      labels: rendered
        .filter((element) => element.children.length === 0)
        .map((element) => (element.textContent ?? "").trim())
        .filter((text) => text !== "")
        .sort(),
    };
  });

/**
 * Content is lost when a box clips it, not when it wraps. The Visual QA truncation check got this
 * wrong once and reported a wrapped heading as truncated; overflow only counts where `overflow`
 * actually clips.
 */
const clippedElements = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const card = document.querySelector("article");
    if (!card) return [];
    return [...card.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const clips =
          ["hidden", "clip", "scroll", "auto"].includes(style.overflowX) ||
          ["hidden", "clip"].includes(style.overflowY);
        if (!clips) return false;
        return (
          element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1
        );
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
  });

const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const animatedElements = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const card = document.querySelector("article");
    if (!card) return [];
    return [...card.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const duration = (value: string): number =>
          Math.max(0, ...value.split(",").map((part) => Number.parseFloat(part) || 0));
        return duration(style.transitionDuration) > 0 || duration(style.animationDuration) > 0;
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
  });

/** Real browser zoom, with the emulation asserted before anything is measured through it. */
const zoomTo200 = async (page: Page): Promise<CDPSession> => {
  const viewport = page.viewportSize();
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: Math.round((viewport?.width ?? 1440) / 2),
    height: Math.round((viewport?.height ?? 900) / 2),
    deviceScaleFactor: 2,
    mobile: false,
  });
  const emulation = await page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
    innerWidth: window.innerWidth,
  }));
  // Decision 9-C: setPageScaleFactor left all of this unchanged and the test passed anyway.
  expect(emulation.devicePixelRatio, "the zoom emulation did not take effect").toBe(2);
  expect(emulation.innerWidth).toBe(Math.round((viewport?.width ?? 1440) / 2));
  return client;
};

const record = async (testInfo: TestInfo, body: unknown): Promise<void> => {
  const path = evidenceOutputPath(
    testInfo,
    `phase-5/browser/${testInfo.project.name}/a11y-state-matrix.json`,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
};

type Observation = Signature & {
  state: string;
  condition: Condition;
  horizontalOverflowPx: number;
  clipped: string[];
  animated: string[];
};

test("@a11y Phase 5 every contract state preserves name and structure under reduced motion and 200% zoom", async ({
  page,
}, testInfo) => {
  test.slow();
  const observations: Observation[] = [];

  const measure = async (state: string, condition: Condition): Promise<Observation> => ({
    state,
    condition,
    ...(await signature(page)),
    horizontalOverflowPx: await horizontalOverflow(page),
    clipped: await clippedElements(page),
    animated: await animatedElements(page),
  });

  for (const state of surface.requiredStates) {
    for (const condition of ["baseline", "reduced-motion", "zoom-200"] as const) {
      await page.emulateMedia({
        reducedMotion: condition === "baseline" ? "no-preference" : "reduce",
      });
      await page.goto(`${ORIGIN}/?surface=decision-notice-capture&state=${state}`);
      await expect(page.locator(`[data-capture-state="${state}"]`)).toBeVisible();

      const client = condition === "zoom-200" ? await zoomTo200(page) : null;
      observations.push(await measure(state, condition));
      await client?.detach();
    }
  }

  await record(testInfo, {
    schema: "cuckcode.phase5-a11y-state-matrix.v1",
    viewport: testInfo.project.name,
    // No wall clock: this record is compared byte-for-byte across two capture runs by the C-08
    // determinism check, and a timestamp would make it differ every time for no reason anyone cares
    // about. The other a11y records already follow this.
    criterion: "C-09",
    // Addressed relative to the evidence root, the way the provenance ledger addresses every
    // artifact. A spec may not name the committed evidence tree at all — the guard scans raw text and
    // does not read comments differently from code, which is what keeps it blunt enough to work.
    decisionRecord: "phase-5/decision-record-2026-09-14-c-09-c-11.md",
    statesFrom: "the surface contract's requiredStates, read rather than listed in the spec",
    conditions: {
      baseline: "prefers-reduced-motion: no-preference, at the approved viewport",
      "reduced-motion": "prefers-reduced-motion: reduce",
      "zoom-200":
        "Emulation.setDeviceMetricsOverride at half the CSS viewport with deviceScaleFactor 2, with devicePixelRatio asserted before measuring",
    },
    passCondition:
      "For every contract state, the roles, accessible names, data markers and visible text under " +
      "reduced motion and under 200% zoom are identical to the baseline; no page-level horizontal " +
      "overflow; nothing clipped; and no element animates under reduced motion.",
    statesMeasured: surface.requiredStates.length,
    observations,
  });

  // Decision 9-G's shape: the set is declared in the contract and the coverage is asserted against
  // it, so a state the contract names and the matrix does not is a failure rather than a silence.
  expect([...new Set(observations.map((entry) => entry.state))].sort()).toStrictEqual(
    [...surface.requiredStates].sort(),
  );
  expect(observations).toHaveLength(surface.requiredStates.length * 3);

  for (const state of surface.requiredStates) {
    const baseline = observations.find(
      (entry) => entry.state === state && entry.condition === "baseline",
    ) as Observation;

    for (const condition of ["reduced-motion", "zoom-200"] as const) {
      const observed = observations.find(
        (entry) => entry.state === state && entry.condition === condition,
      ) as Observation;

      expect(observed.roles, `${state} under ${condition} lost or renamed a role`).toStrictEqual(
        baseline.roles,
      );
      expect(
        observed.markers,
        `${state} under ${condition} lost a non-colour marker`,
      ).toStrictEqual(baseline.markers);
      expect(observed.labels, `${state} under ${condition} lost visible content`).toStrictEqual(
        baseline.labels,
      );
      expect(
        observed.horizontalOverflowPx,
        `${state} under ${condition} scrolls sideways`,
      ).toBeLessThanOrEqual(1);
      expect(observed.clipped, `${state} under ${condition} clips content`).toStrictEqual([]);
    }

    const reduced = observations.find(
      (entry) => entry.state === state && entry.condition === "reduced-motion",
    ) as Observation;
    expect(reduced.animated, `${state} still animates under reduced motion`).toStrictEqual([]);
  }
});
