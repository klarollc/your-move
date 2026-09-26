/**
 * Pure logic for the agent command runner (tasks/agent-runner-plan.md). No I/O lives here: every
 * function takes what it needs as arguments, so all of it runs under `node --test` from any shell.
 *
 * The runner's safety rests on three independent layers, none of which reads prose:
 *
 * 1. The allowlist names every runnable command, and requests carry no arguments.
 * 2. `allowlistViolations` refuses an entry whose npm closure contains an evidence write, an
 *    install, an inline environment assignment or a force flag, or invokes a script file whose code
 *    reads a `process.env.CUCKCODE_*` opt-in. Live runs, promotions and evidence regeneration are
 *    all gated that way, so none of them can be allow-listed by accident.
 * 3. The child process never receives any `CUCKCODE_*` variable (see `scrubEnvironment`), so a
 *    gated script that did slip through would refuse itself.
 */

import { Buffer } from "node:buffer";

const NPM_RUN = /\bnpm(?:\.cmd)?\s+run\s+([\w:.-]+)/g;
const SCRIPT_FILE = /\bscripts\/[\w./-]+\.(?:ts|mjs|js|cjs)\b/g;
const OPT_IN_READ = /process\.env\.CUCKCODE_[A-Z0-9_]+/;

const COMMAND_REFUSALS = [
  { pattern: /(^|\s)--write(\s|$)/, reason: "writes evidence (--write)" },
  { pattern: /\bnpm(?:\.cmd)?\s+(?:install|i|ci|add|update)\b/, reason: "installs packages" },
  {
    pattern: /(^|\s|&&|;)[A-Z_][A-Z0-9_]*=\S*\s/,
    reason: "assigns an environment variable inline",
  },
  { pattern: /(^|\s)(--force|-f)(\s|$)/, reason: "uses a force flag" },
];

/**
 * Every command an npm script runs, following `npm run` references, and every script file those
 * commands name. A reference to a script that does not exist is reported, never ignored.
 */
export function scriptClosure(scripts, name) {
  const commands = [];
  const files = new Set();
  const missing = [];
  const seen = new Set();
  const visit = (current) => {
    if (seen.has(current)) return;
    seen.add(current);
    const command = scripts[current];
    if (typeof command !== "string") {
      missing.push(current);
      return;
    }
    commands.push(command);
    for (const file of command.match(SCRIPT_FILE) ?? []) files.add(file);
    for (const [, reference] of command.matchAll(NPM_RUN)) visit(reference);
  };
  visit(name);
  return { commands, files: [...files], missing };
}

/** Every reason the allowlist must not be used, one string per offending entry. Empty means usable. */
export async function allowlistViolations({ allowlist, scripts, readSource }) {
  const violations = [];
  for (const [name, entry] of Object.entries(allowlist?.commands ?? {})) {
    const reasons = await entryViolations(entry, scripts, readSource);
    if (reasons.length > 0) violations.push(`${name}: ${reasons.join("; ")}`);
  }
  return violations;
}

async function entryViolations(entry, scripts, readSource) {
  if (entry?.kind === "git") {
    const reasons = [];
    if (!Array.isArray(entry.args) || entry.args.some((arg) => typeof arg !== "string")) {
      return ["git entry needs a string argument array"];
    }
    if (entry.args.some((arg) => arg === "--force" || arg === "-f" || arg.startsWith("--force"))) {
      reasons.push("uses a force flag");
    }
    if (entry.args[0] === "push" && entry.requires !== "allow-push") {
      reasons.push("git push must require allow-push");
    }
    return reasons;
  }
  if (entry?.kind !== "npm" || typeof entry.script !== "string") {
    return [`unknown entry kind ${JSON.stringify(entry?.kind)}`];
  }
  const closure = scriptClosure(scripts, entry.script);
  const reasons = closure.missing.map((missing) => `script ${missing} does not exist`);
  for (const command of closure.commands) {
    for (const refusal of COMMAND_REFUSALS) {
      if (refusal.pattern.test(command)) reasons.push(`${refusal.reason} in "${command}"`);
    }
  }
  for (const file of closure.files) {
    if (/\.test\.[a-z]+$/.test(file)) continue;
    let source;
    try {
      source = await readSource(file);
    } catch {
      reasons.push(`${file} cannot be read`);
      continue;
    }
    const read = source.match(OPT_IN_READ);
    if (read) reasons.push(`${file} reads ${read[0]}`);
  }
  return reasons;
}

const REQUEST_ID = /^[a-z0-9][a-z0-9-]{7,63}$/;
const REQUEST_KEYS = ["command", "id"];
const OPT_IN_VARIABLE = /^cuckcode_/i;

/** Ten minutes. A request older than this at pickup was written for a tree that may have moved. */
export const MAX_REQUEST_AGE_MS = 10 * 60 * 1000;

/**
 * A request is exactly `{ id, command }`, where the command is an own property of the allowlist.
 * Anything else, including any attempt to pass arguments or environment, is refused by name.
 */
export function parseRequest(text, { commands, maxBytes = 1024 }) {
  if (Buffer.byteLength(text, "utf8") > maxBytes) return { ok: false, reason: "oversized" };
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not-json" };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "not-object" };
  }
  if (Object.keys(value).some((key) => !REQUEST_KEYS.includes(key))) {
    return { ok: false, reason: "extra-key" };
  }
  if (typeof value.id !== "string" || !REQUEST_ID.test(value.id)) {
    return { ok: false, reason: "bad-id" };
  }
  if (typeof value.command !== "string") return { ok: false, reason: "missing-command" };
  if (!Object.prototype.hasOwnProperty.call(commands, value.command)) {
    return { ok: false, reason: "unknown-command" };
  }
  return { ok: true, request: { id: value.id, command: value.command } };
}

/** A request whose creation time is unknown, or older than the limit, is stale. */
export function isStale(createdAtMs, nowMs, maxAgeMs = MAX_REQUEST_AGE_MS) {
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(nowMs)) return true;
  return nowMs - createdAtMs > maxAgeMs;
}

/**
 * Every `CUCKCODE_*` variable present, sorted. The runner refuses to start, and refuses each
 * request, while any is set. This is deliberately wider than the live, promotion and evidence
 * opt-ins: `CUCKCODE_CODEX_EXE` and `CUCKCODE_CODEX_AUTH` redirect the runtime, and a variable
 * nobody has named yet should fail closed.
 */
export function refuseEnvironment(env) {
  return Object.keys(env)
    .filter((key) => OPT_IN_VARIABLE.test(key))
    .sort();
}

/** A copy of the environment with every `CUCKCODE_*` variable removed. The input is not changed. */
export function scrubEnvironment(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !OPT_IN_VARIABLE.test(key)));
}

/**
 * The exact program and argument array for an allow-listed entry. npm scripts run through
 * `node npm-cli.js run <script>`: current Node refuses to spawn `npm.cmd` without a shell on
 * Windows, and DF-014 forbids the shell. The only substitution is `{branch}`, and only a real,
 * non-flag branch name may fill it.
 */
export function resolveInvocation({ entry, execPath, npmCli, branch, allowPush }) {
  if (entry.kind === "npm") {
    return { ok: true, file: execPath, args: [npmCli, "run", entry.script] };
  }
  if (entry.kind !== "git") return { ok: false, refusal: "unknown-kind" };
  if (entry.requires === "allow-push" && !allowPush) {
    return { ok: false, refusal: "push-not-enabled" };
  }
  if (entry.args.includes("{branch}")) {
    if (
      typeof branch !== "string" ||
      branch === "" ||
      branch === "HEAD" ||
      branch.startsWith("-")
    ) {
      return { ok: false, refusal: "detached-head" };
    }
  }
  return {
    ok: true,
    file: "git",
    args: entry.args.map((arg) => (arg === "{branch}" ? branch : arg)),
  };
}

/**
 * The npm CLI script to run under node: `npm_execpath` when npm itself set it to `npm-cli.js`,
 * otherwise the copy installed beside `node.exe`. Never a guess: null when neither exists.
 */
export function locateNpmCli({ execPath, npmExecPath, exists, path }) {
  const candidates = [];
  if (typeof npmExecPath === "string" && path.basename(npmExecPath) === "npm-cli.js") {
    candidates.push(npmExecPath);
  }
  candidates.push(path.join(path.dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js"));
  return candidates.find((candidate) => exists(candidate)) ?? null;
}

/** Every reason the runner must not start. Empty means it may. */
export function startupProblems({ npmCli, env, violations }) {
  const problems = [];
  if (!npmCli) problems.push("npm-cli.js was not found beside node or in npm_execpath");
  const variables = refuseEnvironment(env);
  if (variables.length > 0) problems.push(`environment carries ${variables.join(", ")}`);
  for (const violation of violations) problems.push(`allowlist: ${violation}`);
  return problems;
}
