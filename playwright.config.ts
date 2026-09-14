import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  /**
   * Playwright's default testMatch is `*.test.ts` as well as `*.spec.ts`, so it collected the Vitest
   * files under `tests/` and died loading `describe` from the wrong runner. Every Playwright test
   * here is a `.spec.ts`; every Vitest one is a `.test.ts`. Naming the pattern is what keeps the two
   * runners out of each other's directories.
   */
  testMatch: "**/*.spec.ts",
  outputDir: "./test-results",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chromium-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  /**
   * Two servers, deliberately.
   *
   * 4173 is the dev server every Phase 4 spec has always used; moving those would re-serve
   * owner-accepted evidence from a different build without anyone asking for that. 4174 serves the
   * production bundle and is what the Phase 5 captures use, per decision 9-E: C-11 asks for an
   * auditable network panel and the dev server issues ninety-five module requests per journey.
   */
  webServer: [
    {
      command: "npm run dev --workspace @cuckcode/web -- --host 127.0.0.1",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run preview:web",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
