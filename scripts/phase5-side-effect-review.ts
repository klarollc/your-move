import { readFile } from "node:fs/promises";
import { dirname, posix, relative, resolve } from "node:path";

/**
 * C-11's static half — the owner ruled it on 2026-09-14 after release review pass 4.
 *
 * The behavioral evidence was never in doubt: the isolation records show nine contract journeys
 * making zero external requests, writing nothing, leaking no credential-shaped string. The reviewer
 * refused it anyway, and was right to: "The defined journeys show zero external requests … but no
 * cited independent static examination establishes absence of destructive, deployment, credential,
 * network, or paid side effects **across all reachable code paths**."
 *
 * A journey exercises the paths it walks. A path nobody walked is exactly where an unwanted effect
 * would live, and no number of clean journeys can speak for it. So this walks the import graph from
 * the declared entry points and reads every module that is reachable, whether or not any test has
 * ever executed it.
 *
 * It is a static scan and its limits are part of the artifact rather than a footnote: it cannot see
 * through dynamic dispatch, computed member access, `eval`, or the internals of external packages.
 * Those are reported, not silently excluded.
 */

export type EffectCategory = "network" | "credential" | "deployment" | "destructive" | "paid";

export type EffectPattern = {
  category: EffectCategory;
  name: string;
  pattern: RegExp;
};

/**
 * The five categories C-11 names, each with the concrete surfaces that would realise it.
 *
 * Deliberately broad. A false positive costs one look and a line in the artifact explaining why it
 * is allowed; a missed effect costs the claim the whole local-first argument rests on. The same
 * trade the credential scan in the isolation spec already makes.
 */
export const EFFECT_PATTERNS: EffectPattern[] = [
  { category: "network", name: "fetch", pattern: /\bfetch\s*\(/u },
  { category: "network", name: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/u },
  { category: "network", name: "WebSocket", pattern: /\bWebSocket\b/u },
  { category: "network", name: "EventSource", pattern: /\bEventSource\b/u },
  { category: "network", name: "sendBeacon", pattern: /\bsendBeacon\s*\(/u },
  {
    category: "network",
    name: "node http client",
    pattern: /\brequire\(['"]https?['"]\)|from\s+['"]node:https?['"]/u,
  },
  {
    category: "network",
    name: "dynamic import of a URL",
    pattern: /\bimport\s*\(\s*[`'"]https?:/u,
  },
  {
    category: "network",
    name: "form posting to a remote action",
    pattern: /action\s*=\s*[`'"]https?:/u,
  },

  { category: "credential", name: "cookie access", pattern: /\bdocument\s*\.\s*cookie\b/u },
  { category: "credential", name: "environment secrets", pattern: /\bprocess\s*\.\s*env\b/u },
  {
    category: "credential",
    name: "authorization header",
    pattern: /['"]Authorization['"]|\bBearer\s/u,
  },
  {
    category: "credential",
    name: "named secret",
    pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\b\s*[:=]/iu,
  },
  { category: "credential", name: "key export", pattern: /\bexportKey\s*\(|\bsubtle\s*\./u },

  {
    category: "deployment",
    name: "child process",
    pattern: /\bchild_process\b|\bexecFile\s*\(|\bspawn\s*\(|\bexecSync\s*\(/u,
  },
  {
    category: "deployment",
    name: "package publish",
    pattern: /npm\s+publish|\bpublish\s*\(\s*\)/u,
  },
  { category: "deployment", name: "git write", pattern: /git\s+(?:push|commit|tag)\b/u },

  {
    category: "destructive",
    name: "filesystem removal",
    pattern: /\b(?:rmSync|rmdirSync|unlinkSync|rm|rmdir|unlink)\s*\(/u,
  },
  {
    category: "destructive",
    name: "filesystem write",
    pattern: /\bwriteFileSync?\s*\(|\bfs\s*\.\s*write/u,
  },
  {
    category: "destructive",
    name: "storage clear",
    pattern: /\b(?:localStorage|sessionStorage)\s*\.\s*(?:clear|removeItem)\s*\(/u,
  },
  {
    category: "destructive",
    name: "database deletion",
    pattern: /\bdeleteDatabase\s*\(|DROP\s+TABLE/iu,
  },

  {
    category: "paid",
    name: "payment provider",
    pattern: /\b(?:stripe|paypal|braintree|adyen)\b/iu,
  },
  {
    category: "paid",
    name: "charge or billing call",
    pattern: /\b(?:createPaymentIntent|createCharge|chargeCard|billingAccount)\b/u,
  },
  { category: "paid", name: "payment request API", pattern: /\bPaymentRequest\s*\(/u },
];

/** Workspace package name to its source entry, read from the workspace manifests at build time. */
export type WorkspaceMap = ReadonlyMap<string, string>;

/**
 * Import specifiers, including the multi-line form.
 *
 * The first version used `[^'"\n]*?` between `import` and `from`, which cannot cross a newline — so
 * a named-import block spanning eighteen lines, which is exactly what the component opens with, was
 * invisible. The graph came back as three modules and a clean result, and the clean result was an
 * artifact of the parser rather than of the code. Newlines are allowed here; quotes are not, which
 * is what keeps the match inside one statement.
 */
const IMPORT_SPECIFIER =
  /(?:^|\n)\s*(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/gu;

export function importSpecifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1] ?? match[2];
    if (specifier) found.push(specifier);
  }
  return found;
}

/**
 * Resolves one specifier to a repository-relative source file, or null when it leaves the tree.
 *
 * `.js` specifiers resolving to `.ts` sources is the repo's NodeNext convention; a resolver that
 * missed that would silently declare the entire graph unreachable and report a clean scan of one
 * file. That failure mode — a guard that matches nothing and therefore passes — is the one this
 * project keeps rediscovering, so unresolved specifiers are returned as `external` and counted
 * rather than dropped.
 */
export function resolveSpecifier(
  fromFile: string,
  specifier: string,
  workspaces: WorkspaceMap,
):
  | { kind: "internal"; candidates: string[] }
  | { kind: "external"; specifier: string }
  | { kind: "asset" } {
  if (/\.(?:css|svg|png|jpg|jpeg|webp|woff2?)$/u.test(specifier)) return { kind: "asset" };

  /**
   * Candidates, not a guess.
   *
   * The repo's NodeNext convention writes `./decision-notice.js` for a source file that is actually
   * `.tsx`. The first version of this resolver rewrote `.js` to `.ts` and stopped, so the component
   * — a `.tsx` file — fell out of its own import graph and the review reported three modules and a
   * clean result. A resolver that resolves nothing produces a scan that finds nothing, which is the
   * shape of every guard this project has had to repair.
   */
  const withExtensions = (base: string): string[] => [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];

  if (specifier.startsWith(".")) {
    const joined = posix.normalize(
      posix.join(posix.dirname(fromFile.replaceAll("\\", "/")), specifier),
    );
    const base = joined.replace(/\.(?:js|jsx|ts|tsx)$/u, "");
    return { kind: "internal", candidates: [joined, ...withExtensions(base)] };
  }

  const workspace = workspaces.get(specifier);
  if (workspace) return { kind: "internal", candidates: [workspace] };

  return { kind: "external", specifier };
}

export type ModuleScan = {
  file: string;
  hits: Array<{ category: EffectCategory; name: string; line: number; text: string }>;
};

/**
 * Comments are stripped before scanning.
 *
 * Every one of these patterns appears in prose somewhere in this repository — the isolation spec's
 * own doc comment names `fetch`, and this file names all five categories. Scanning comment text
 * would make the guard fire on its own explanation, and a guard that cries wolf on documentation
 * gets its patterns narrowed until it finds nothing.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, " "))
    .replace(
      /(^|[^:])\/\/[^\n]*/gu,
      (line, lead: string) => lead + " ".repeat(line.length - lead.length),
    );
}

export function scanModule(file: string, source: string): ModuleScan {
  const lines = stripComments(source).split("\n");
  const hits: ModuleScan["hits"] = [];
  for (const [index, line] of lines.entries()) {
    for (const effect of EFFECT_PATTERNS) {
      if (effect.pattern.test(line)) {
        hits.push({
          category: effect.category,
          name: effect.name,
          line: index + 1,
          text: line.trim().slice(0, 160),
        });
      }
    }
  }
  return { file, hits };
}

export type ReachabilityResult = {
  modules: string[];
  external: string[];
  unreadable: string[];
  assets: string[];
};

/** The first candidate that exists on disk, or null when the specifier resolves to nothing. */
export async function firstReadable(root: string, candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const body = await readFile(resolve(root, candidate), "utf8").catch(() => null);
    if (body !== null) return candidate;
  }
  return null;
}

/** Every module reachable from the entry points, by import, transitively. */
export async function reachableModules(
  root: string,
  entryPoints: string[],
  workspaces: WorkspaceMap,
): Promise<ReachabilityResult> {
  const seen = new Set<string>();
  const external = new Set<string>();
  const assets = new Set<string>();
  const unreadable = new Set<string>();
  const queue = [...entryPoints];

  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = await readFile(resolve(root, file), "utf8").catch(() => null);
    if (source === null) {
      seen.delete(file);
      unreadable.add(file);
      continue;
    }

    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveSpecifier(file, specifier, workspaces);
      if (resolved.kind === "asset") {
        assets.add(specifier);
        continue;
      }
      if (resolved.kind === "external") {
        external.add(resolved.specifier);
        continue;
      }
      const found = await firstReadable(root, resolved.candidates);
      // A relative import that resolves to nothing is a hole in the graph, not an absence of code.
      if (found === null) unreadable.add(`${file} -> ${specifier}`);
      else if (!seen.has(found)) queue.push(found);
    }
  }

  return {
    modules: [...seen].sort(),
    external: [...external].sort(),
    unreadable: [...unreadable].sort(),
    assets: [...assets].sort(),
  };
}

export const repositoryRelative = (root: string, file: string): string =>
  relative(root, file).replaceAll("\\", "/");

export const moduleDirectory = (file: string): string => dirname(file).replaceAll("\\", "/");
