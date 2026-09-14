import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { readPhase5Contract } from "../support/contract-input.js";
import { evidenceOutputPath } from "../support/evidence-output.js";

/**
 * Phase 5 Task 7 — the isolation procedure the Test Engineer defined in Task 6, executed.
 *
 * Steps 1 to 6 assert that a clean run is clean. Step 7 is the one that makes the other six mean
 * anything: it injects a forbidden external request and requires the harness to catch it. A clean
 * result from a detector nobody has ever seen fire is indistinguishable from a detector that does
 * not work, and this repository has shipped that mistake before.
 *
 * Decision 9-E: the page under test is the **production bundle** on 4174, not the dev server. C-11
 * asks for an auditable network panel, and a dev-server page issues ninety-five module requests per
 * journey. A panel nobody reads is not an audit.
 *
 * Decision 9-G: the journeys are read from the surface contract, not listed here. "Every journey"
 * had no referent, so the claim could not be checked; a journey the contract names and the record
 * does not now fails.
 */

const ORIGIN = "http://127.0.0.1:4174";
const ROOT = resolve(process.cwd());

type JourneyContract = {
  journeys: Array<{ id: string; from: string; steps: string[]; why: string }>;
};

const contract = readPhase5Contract<JourneyContract>("journeys.json");

/**
 * Shapes that must never appear in rendered output, logs, or persisted state. Deliberately broad:
 * a false positive costs one look, and a missed credential costs the thing the whole local-first
 * argument rests on.
 */
const CREDENTIAL_SHAPES: Array<[string, RegExp]> = [
  ["openai-style key", /\bsk-[A-Za-z0-9]{16,}/u],
  ["github token", /\bgh[pousr]_[A-Za-z0-9]{16,}/u],
  ["bearer header", /\bBearer\s+[A-Za-z0-9._-]{16,}/u],
  ["aws access key", /\bAKIA[0-9A-Z]{12,}/u],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  ["named secret", /\b(?:api[_-]?key|client[_-]?secret|password)\b\s*[:=]\s*\S+/iu],
];

type Observation = {
  journey: string;
  from: string;
  steps: string[];
  requests: string[];
  externalRequests: string[];
  consoleLog: Array<{ type: string; text: string }>;
  storageWrites: string[];
  credentialHits: string[];
  evidenceStates: string[];
};

const watch = (page: Page, observation: Observation): void => {
  page.on("request", (request) => {
    observation.requests.push(request.url());
    if (!request.url().startsWith(ORIGIN)) observation.externalRequests.push(request.url());
  });
  page.on("console", (message) =>
    observation.consoleLog.push({ type: message.type(), text: message.text() }),
  );
};

/**
 * A browser's filesystem is its storage APIs. Every write target is recorded rather than blocked,
 * because the question the criterion asks is what the component wrote, not whether it could.
 */
const recordStorageWrites = (page: Page): Promise<void> =>
  page.addInitScript(() => {
    const recorded: string[] = [];
    (window as unknown as { __cuckcodeWrites: string[] }).__cuckcodeWrites = recorded;
    for (const [area, store] of [
      ["localStorage", window.localStorage],
      ["sessionStorage", window.sessionStorage],
    ] as const) {
      const setItem = store.setItem.bind(store);
      store.setItem = (key: string, value: string) => {
        recorded.push(`${area}:${key}`);
        setItem(key, value);
      };
    }
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name: string, version?: number) => {
      recorded.push(`indexedDB:${name}`);
      return open(name, version);
    };
  });

const scanForCredentials = (body: string): string[] =>
  CREDENTIAL_SHAPES.filter(([, pattern]) => pattern.test(body)).map(([name]) => name);

const digest = (path: string): string =>
  createHash("sha256")
    .update(readFileSync(resolve(ROOT, path), "utf8"))
    .digest("hex")
    .slice(0, 16);

const write = async (path: string, body: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
};

const recordPath = (testInfo: TestInfo, name: string): string =>
  evidenceOutputPath(testInfo, `phase-5/browser/${testInfo.project.name}/${name}`);

/** The step vocabulary the contract names, executed against the real surface. */
const runStep = async (page: Page, step: string): Promise<void> => {
  const reason = page.getByRole("textbox", { name: /Deferral reason/ });
  switch (step) {
    case "acknowledge":
      await page.getByRole("button", { name: "Acknowledge" }).click();
      return;
    case "open-defer":
      await page.getByRole("button", { name: "Defer" }).click();
      await expect(reason).toBeVisible();
      return;
    case "type-reason":
      await reason.fill("Wait for the owner decision record.");
      return;
    case "type-overlong-reason":
      await reason.fill("x".repeat(281));
      return;
    case "set-future-date":
      await page.getByLabel("Review date").fill("2026-12-01");
      return;
    case "set-past-date":
      await page.getByLabel("Review date").fill("2026-01-01");
      return;
    case "submit-defer":
      await page.getByRole("button", { name: "Submit deferral" }).click();
      return;
    case "undo":
      await page.getByRole("button", { name: "Undo latest decision change" }).click();
      return;
    case "inspect-evidence":
      await page.getByRole("button", { name: "Evidence link: resolved, Preflight packet" }).click();
      return;
    case "attempt-disabled-action":
      // force, because the control is disabled by design: the question is whether activating it
      // anyway changes anything, and a click the harness refuses to send answers nothing.
      await page.getByRole("button", { name: "Acknowledge" }).click({ force: true });
      return;
    default:
      throw new Error(`UNKNOWN_JOURNEY_STEP:${step}`);
  }
};

test("@e2e Phase 5 decision notice runs every contract journey in isolation", async ({
  page,
}, testInfo) => {
  const observations: Observation[] = [];
  await recordStorageWrites(page);

  for (const journey of contract.journeys) {
    const observation: Observation = {
      journey: journey.id,
      from: journey.from,
      steps: journey.steps,
      requests: [],
      externalRequests: [],
      consoleLog: [],
      storageWrites: [],
      credentialHits: [],
      evidenceStates: [],
    };
    watch(page, observation);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${ORIGIN}/?surface=decision-notice-capture&state=${journey.from}`);
    await expect(page.locator(`[data-capture-state="${journey.from}"]`)).toBeVisible();
    for (const step of journey.steps) await runStep(page, step);

    // Step 5: every evidence link resolves, and resolution stays inside the supplied fixture.
    observation.evidenceStates = await page
      .locator('[data-testid="decision-evidence-list"] li')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-evidence-state") ?? "none"));

    // Step 4: the rendered document, the console, and persisted state, all scanned.
    const rendered = (await page.locator("body").innerText()) + (await page.content());
    const persisted = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
      writes: (window as unknown as { __cuckcodeWrites?: string[] }).__cuckcodeWrites ?? [],
    }));
    observation.storageWrites = persisted.writes;
    observation.credentialHits = scanForCredentials(
      [rendered, persisted.local, persisted.session, JSON.stringify(observation.consoleLog)].join(
        "\n",
      ),
    );

    observations.push(observation);
    page.removeAllListeners("request");
    page.removeAllListeners("console");
  }

  // Step 6: what was under test, by content address, recorded with the result.
  const record = {
    schema: "cuckcode.phase5-isolation.v2",
    viewport: testInfo.project.name,
    servedFrom: `${ORIGIN} — the production bundle, per decision 9-E`,
    ranAt: new Date().toISOString(),
    journeySource: "the surface contract's journeys.json",
    artifactVersions: {
      "packages/domain/src/decision-notice.ts": digest("packages/domain/src/decision-notice.ts"),
      "apps/web/src/decision-notice.tsx": digest("apps/web/src/decision-notice.tsx"),
      "apps/web/src/decision-notice-capture.tsx": digest(
        "apps/web/src/decision-notice-capture.tsx",
      ),
    },
    passCondition:
      "Every contract journey completes with no request beyond the page's own origin and assets, " +
      "zero credential-shaped output, zero writes outside the injected fixture, and evidence " +
      "resolution limited to fixture artifacts.",
    observations,
  };
  await write(recordPath(testInfo, "isolation.json"), `${JSON.stringify(record, null, 2)}\n`);

  // Decision 9-G: a journey the contract names and the record does not is the failure this guard
  // exists for. "Every journey" is only a claim when the set is written down.
  expect(observations.map((entry) => entry.journey).sort()).toStrictEqual(
    contract.journeys.map((journey) => journey.id).sort(),
  );

  for (const observation of observations) {
    expect(
      observation.externalRequests,
      `${observation.journey} made an external request`,
    ).toStrictEqual([]);
    expect(
      observation.credentialHits,
      `${observation.journey} leaked a credential shape`,
    ).toStrictEqual([]);
    expect(
      observation.storageWrites,
      `${observation.journey} wrote outside the fixture`,
    ).toStrictEqual([]);
    expect(observation.consoleLog.filter((entry) => entry.type === "error")).toStrictEqual([]);
    // Four outcomes, each present, none of them a silent failure to resolve.
    expect([...new Set(observation.evidenceStates)].sort()).toStrictEqual([
      "invalid",
      "missing",
      "resolved",
      "unavailable",
    ]);
  }

  /**
   * Decision 9-E, the part that made the criterion checkable. C-11 asks for an empty network panel;
   * a page has to be fetched, so the honest reading is "nothing beyond the page's own assets". On
   * the dev server this was ninety-five module requests per journey. Bounding it is what makes the
   * panel something a person can actually audit.
   */
  for (const observation of observations) {
    expect(
      observation.requests.length,
      `${observation.journey} requested ${observation.requests.length} resources; the panel should be small enough to read`,
    ).toBeLessThanOrEqual(12);
  }
});

test("@e2e Phase 5 isolation detects a deliberately injected external request", async ({
  page,
}, testInfo) => {
  const observation: Observation = {
    journey: "deliberate-violation",
    from: "pending",
    steps: [],
    requests: [],
    externalRequests: [],
    consoleLog: [],
    storageWrites: [],
    credentialHits: [],
    evidenceStates: [],
  };
  watch(page, observation);

  // The injected violation: a request to a host outside the loopback origin, made by the page while
  // the same detector that guards the clean runs is watching. The request is expected to fail at the
  // network layer — what is under test is whether the harness *sees* it, not whether it succeeds.
  await page.route("https://forbidden.invalid/**", (route) => route.abort());
  await page.addInitScript(() => {
    void fetch("https://forbidden.invalid/telemetry").catch(() => undefined);
  });

  await page.goto(`${ORIGIN}/?surface=decision-notice-capture&state=pending`);
  await expect(page.locator('[data-capture-state="pending"]')).toBeVisible();
  await expect
    .poll(() => observation.externalRequests.length, { timeout: 5_000 })
    .toBeGreaterThan(0);

  const failure = {
    schema: "cuckcode.phase5-isolation-failure.v1",
    viewport: testInfo.project.name,
    ranAt: new Date().toISOString(),
    journey: "pending, with an injected forbidden external request",
    injectedViolation: "fetch('https://forbidden.invalid/telemetry') from page init",
    expectedCondition: `zero requests to any origin other than ${ORIGIN}`,
    observed: observation.externalRequests,
    consoleLog: observation.consoleLog,
    verdict:
      "FAIL — the isolation check fires on a forbidden request, so a clean run means something",
  };
  await write(
    recordPath(testInfo, "isolation-deliberate-failure.json"),
    `${JSON.stringify(failure, null, 2)}\n`,
  );

  expect(observation.externalRequests).toContain("https://forbidden.invalid/telemetry");
});
