# Proposal: browser suites on the production bundle (DF-028)

**Status: DRAFT for owner decision, 2026-10-03. Not authorized.** Author: agent. Source finding:
DF-028 in `docs/evidence/dogfood-register.md`, fourth occurrence, the first with a kept trace.

## 1. The problem

Four `verify` runs since 2026-09-26 failed one browser test each with a blank page: a different
test each time, either viewport, unrelated commits, a clean rerun every time. The fourth kept its
trace. The page's request for `/@react-refresh` on the **dev server** (4173) failed with
`net::ERR_NO_BUFFER_SPACE`, the Windows socket error WSAENOBUFS. Without that preamble no `.tsx`
module runs, so nothing renders. Every other request returned 200.

A dev-server page issues about ninety-five module requests (decision 9-E's own figure). The
Playwright config sets no `workers`, so the suites run about six pages at once on the owner's
twelve-thread machine, and they load hundreds of pages per `verify`. Any moment of socket pressure
(other local servers count; the owner runs another project's servers on this machine) can drop one
request, and one dropped preamble blanks a page. Each blank page costs a full rerun, about five
minutes.

## 2. What the dev server is still needed for

The config keeps Phase 4 on 4173 because "moving those would re-serve owner-accepted evidence from a
different build". Measured 2026-10-03, of the 25 specs on the dev server:

- **One** writes committed evidence: `tests/visual/phase-4-layout-trial.spec.ts` (through
  `evidenceOutputPath`, owner-run regeneration).
- The other 24 write screenshots to per-run output only (`testInfo.outputPath`) or none.

The Phase 5, Phase 7-O and Phase 7 capture specs already use production bundles (4174, 4175) under
decision 9-E.

## 3. Options

- **(a) Recommended: the production bundle by default.** Change the config's `baseURL` to 4174. The
  layout-trial spec keeps the dev server through an explicit `ORIGIN` of its own, so its committed
  evidence keeps its build; it is the only spec the config's reason covers. A page then makes a
  handful of requests instead of about ninety-five, which removes the exposure rather than reducing
  it. The 4174 server is already built and started for every run.
- **(b) Fewer workers** (for example two). Reduces the pressure, keeps the cause, and makes every
  `verify` slower.
- **(c) Retries.** Rejected: a retry would also pass a real intermittent defect, and this
  repository's rule is that a failure is investigated, not absorbed.

## 4. What (a) must check before it is ruled

1. No spec depends on dev-only behaviour: Vite's HMR client, unminified component names, dev-only
   console output, or source paths under `/src/`. A grep and one full run on 4174 answer this.
2. The production bundle is current when the suites run: `preview:web` builds before it serves,
   once per Playwright run.
3. Any assertion that changes is listed (P-4); none is expected beyond the base URL.
4. Phase 4 accepted evidence is untouched: the layout-trial spec still runs on 4173, and no other
   spec writes committed evidence.

## 5. Not in this proposal

Changing what any test asserts; the dev server for the owner's own development; the runner.
