import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * R2.3, R2.4 and R1.4 as an executable guard (Task 5).
 *
 * The Codex version lives in exactly one place, `@openai/codex` in
 * `packages/runtime-codex/package.json`. Before this guard it was written independently in the
 * supervisor, seven live scripts, the generator and the checker, and the desktop app's copy of the
 * binary was spawned by path — which is how a vendor update made every run refuse while every
 * check stayed green (DF-021).
 *
 * The version pattern is Codex's own numbering (`0.1xx.y`), in plain or regex-escaped form. It is a
 * heuristic: a Codex version written some other way would pass. Test files are exempt from the
 * version rule, because comparing a pin with something else needs a second version, and are not
 * exempt from the desktop-binary rule.
 */
const VERSION_LITERAL = /(?<![\d.])0(?:\.|\\\.)1\d{2}(?:\.|\\\.)\d+(?![\d.])/u;
const DESKTOP_BINARY = /Programs(?:[\\/]+)OpenAI(?:[\\/]+)Codex/iu;
const TEST_FILE = /(?:\.test\.|\.spec\.)[cm]?[jt]sx?$/u;
const SOURCE_FILE = /\.(?:[cm]?[jt]s|tsx)$/u;
const ROOTS = ["apps", "packages", "scripts", "tests"];
const SKIPPED = new Set(["node_modules", "dist", "test-results", "playwright-report", "coverage"]);
const HISTORICAL = ["packages/runtime-codex/protocol/"];

export function listGuardedFiles(root) {
  const found = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || SKIPPED.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      const path = relative(root, absolute).split(sep).join("/");
      if (HISTORICAL.some((prefix) => `${path}/`.startsWith(prefix) || path.startsWith(prefix)))
        continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && SOURCE_FILE.test(entry.name)) found.push(path);
    }
  };
  for (const name of ROOTS) {
    try {
      visit(join(root, name));
    } catch {
      // An absent root holds nothing to guard.
    }
  }
  return found.sort();
}

/**
 * `files` is `{ path, text }[]` with repository-relative paths; `context` is
 * `{ pin, bundleManifest }`, where `bundleManifest` is the parsed `protocol/<pin>/manifest.json`
 * or `null`.
 */
export function findPinViolations(files, context) {
  const violations = [];
  for (const { path, text } of files) {
    const isTest = TEST_FILE.test(path) || path.startsWith("tests/");
    text.split(/\r?\n/u).forEach((content, index) => {
      if (!isTest && VERSION_LITERAL.test(content)) {
        violations.push({
          rule: "version-literal",
          path,
          line: index + 1,
          content: content.trim(),
        });
      }
      if (DESKTOP_BINARY.test(content)) {
        violations.push({ rule: "desktop-binary", path, line: index + 1, content: content.trim() });
      }
    });
  }
  if (!context.bundleManifest) {
    violations.push({
      rule: "bundle-missing",
      path: `packages/runtime-codex/protocol/${context.pin}`,
      line: 0,
    });
  } else if (context.bundleManifest.version !== context.pin) {
    violations.push({
      rule: "bundle-version-mismatch",
      path: `packages/runtime-codex/protocol/${context.pin}/manifest.json`,
      line: 0,
    });
  }
  return violations;
}
