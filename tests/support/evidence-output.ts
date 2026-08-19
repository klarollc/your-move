import type { TestInfo } from "@playwright/test";

/**
 * Resolves where a rendered capture is written.
 *
 * Committed evidence under docs/evidence backs owner-accepted decisions and is immutable once its
 * gate closes. Writing there on every ordinary test run rewrites owner-reviewed artifacts, and the
 * change surfaces only as an unexplained dirty working tree — the condition that produced defects
 * D4-P-001 and D4-P-003.
 *
 * The default is therefore the ephemeral per-test output directory. Regenerating committed
 * evidence requires setting CUCKCODE_REGENERATE_EVIDENCE explicitly, which makes it a deliberate
 * act with a reviewable diff rather than a side effect of running the suite.
 */
export function evidenceOutputPath(testInfo: TestInfo, relativePath: string): string {
  if (process.env.CUCKCODE_REGENERATE_EVIDENCE === "1") {
    return `docs/evidence/${relativePath}`;
  }
  return testInfo.outputPath(relativePath.replaceAll("/", "-"));
}
