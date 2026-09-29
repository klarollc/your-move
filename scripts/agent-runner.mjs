/**
 * The agent command runner (tasks/agent-runner-plan.md). The owner starts it in a visible terminal:
 *
 *   node scripts/agent-runner.mjs                 # or: npm run agent:runner
 *   node scripts/agent-runner.mjs --allow-push    # also permits the git-push entry
 *
 * While it runs it picks up request files from node_modules/.cache/agent-runner/inbox/, runs the
 * allow-listed command they name — one at a time, with an argument array and no shell — and writes
 * a result to outbox/ and a full log to logs/. Stop it with Ctrl+C.
 *
 * `createRunner` holds all the behaviour and takes its I/O as arguments, so the tests drive it with
 * a fake spawner and a fake git. `main` wires the real ones.
 */
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  allowlistViolations,
  isStale,
  locateNpmCli,
  parseRequest,
  refuseEnvironment,
  resolveInvocation,
  scrubEnvironment,
  startupProblems,
} from "./agent-runner-core.mjs";

const EVIDENCE_STATUS = ["status", "--porcelain=v1", "--", "docs/evidence"];

export function createRunner({
  allowlist,
  env,
  execPath,
  npmCli,
  allowPush,
  now,
  logPathFor,
  git,
  spawnLogged,
  // DF-028: keeps a failed run's Playwright traces before the next run wipes them. Optional so a
  // runner without it still runs.
  archiveFailure = async () => null,
}) {
  let queue = Promise.resolve();

  const gitText = async (args) => (await git(args)).stdout;

  async function execute(request) {
    const startedAt = now().toISOString();
    const base = { id: request.id, command: request.command, startedAt };
    const refuse = (refusal) => ({
      ...base,
      status: "refused",
      refusal,
      endedAt: now().toISOString(),
    });

    const variables = refuseEnvironment(env);
    if (variables.length > 0) return refuse(`environment carries ${variables.join(", ")}`);

    const entry = allowlist.commands[request.command];
    const branch = (await gitText(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
    const invocation = resolveInvocation({ entry, execPath, npmCli, branch, allowPush });
    if (!invocation.ok) return refuse(invocation.refusal);

    const head = (await gitText(["rev-parse", "HEAD"])).trim();
    const porcelain = await gitText(["status", "--porcelain=v1"]);
    const evidenceBefore = await gitText(EVIDENCE_STATUS);
    const logPath = logPathFor(request.id);
    const exitCode = await spawnLogged(invocation.file, invocation.args, {
      env: scrubEnvironment(env),
      shell: false,
      logPath,
    });
    const evidenceAfter = await gitText(EVIDENCE_STATUS);

    // DF-028: keep a failed run's traces, screenshots and videos before the next run wipes them.
    let failure = {};
    if (exitCode !== 0) {
      try {
        failure = { failureArtifacts: await archiveFailure(request.id) };
      } catch (error) {
        failure = { failureArtifacts: null, archiveError: String(error?.message ?? error) };
      }
    }

    return {
      ...base,
      status: "completed",
      exitCode,
      endedAt: now().toISOString(),
      head,
      branch,
      porcelain,
      dirty: porcelain.trim().length > 0,
      evidenceChanged: evidenceBefore !== evidenceAfter,
      logPath,
      ...failure,
    };
  }

  return {
    /** Runs after every earlier submission has finished, never alongside one. */
    submit(request) {
      const result = queue.then(() => execute(request));
      queue = result.catch(() => undefined);
      return result;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Real I/O. Not exercised by the unit tests; Task 7 is the owner-run check of this half.
// ---------------------------------------------------------------------------------------------

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = path.join(ROOT, "node_modules", ".cache", "agent-runner");
const DIRS = {
  inbox: path.join(BASE, "inbox"),
  outbox: path.join(BASE, "outbox"),
  logs: path.join(BASE, "logs"),
  done: path.join(BASE, "done"),
};

/**
 * Copies Playwright's output of a failed run into failures/<id>/ (DF-028). Returns the folder, or
 * null when the run left no Playwright output to keep.
 */
async function realArchiveFailure(id) {
  const target = path.join(BASE, "failures", id);
  let kept = false;
  for (const name of ["test-results", "playwright-report"]) {
    const source = path.join(ROOT, name);
    if (!existsSync(source)) continue;
    await cp(source, path.join(target, name), { recursive: true });
    kept = true;
  }
  return kept ? target : null;
}
const MAX_RUN_MS = 60 * 60 * 1000;

function realGit(args) {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd: ROOT, shell: false, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", () => resolve({ code: -1, stdout: "" }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout }));
  });
}

function realSpawnLogged(file, args, { env, shell, logPath }) {
  return new Promise((resolve) => {
    const log = createWriteStream(logPath, { flags: "w" });
    log.write(`$ ${file} ${JSON.stringify(args)}\n`);
    const child = spawn(file, args, { cwd: ROOT, env, shell, windowsHide: true });
    const timer = setTimeout(() => {
      log.write(`\n[agent-runner] exceeded ${MAX_RUN_MS} ms; killing\n`);
      child.kill();
    }, MAX_RUN_MS);
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on("error", (error) => {
      clearTimeout(timer);
      log.end(`\n[agent-runner] spawn failed: ${error.message}\n`);
      resolve(-1);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      log.end(`\n[agent-runner] exit ${code}\n`);
      resolve(code ?? -1);
    });
  });
}

async function writeOutbox(result) {
  await writeFile(
    path.join(DIRS.outbox, `${result.id}.json`),
    `${JSON.stringify(result, null, 2)}\n`,
  );
}

async function main() {
  const allowPush = process.argv.slice(2).includes("--allow-push");
  const allowlist = JSON.parse(
    await readFile(path.join(ROOT, "scripts", "agent-runner.allowlist.json"), "utf8"),
  );
  const { scripts } = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  const violations = await allowlistViolations({
    allowlist,
    scripts,
    readSource: (file) => readFile(path.join(ROOT, file), "utf8"),
  });
  const npmCli = locateNpmCli({
    execPath: process.execPath,
    npmExecPath: process.env.npm_execpath,
    exists: existsSync,
    path,
  });
  const problems = startupProblems({ npmCli, env: process.env, violations });
  if (problems.length > 0) {
    for (const problem of problems) console.error(`[agent-runner] refusing to start: ${problem}`);
    process.exitCode = 1;
    return;
  }
  for (const dir of Object.values(DIRS)) await mkdir(dir, { recursive: true });

  const runner = createRunner({
    allowlist,
    env: process.env,
    execPath: process.execPath,
    npmCli,
    allowPush,
    now: () => new Date(),
    logPathFor: (id) => path.join(DIRS.logs, `${id}.log`),
    git: realGit,
    spawnLogged: realSpawnLogged,
    archiveFailure: realArchiveFailure,
  });
  console.log(
    `[agent-runner] watching ${DIRS.inbox}${allowPush ? " (git-push enabled)" : ""}. Ctrl+C to stop.`,
  );

  for (;;) {
    const names = (await readdir(DIRS.inbox)).filter((name) => name.endsWith(".json")).sort();
    for (const name of names) {
      const source = path.join(DIRS.inbox, name);
      let text;
      let created;
      try {
        text = await readFile(source, "utf8");
        created = (await stat(source)).mtimeMs;
      } catch {
        continue;
      }
      await rename(source, path.join(DIRS.done, `${Date.now()}-${name}`));
      const fallbackId = name
        .replace(/\.json$/, "")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 64);
      const parsed = parseRequest(text, { commands: allowlist.commands });
      if (!parsed.ok) {
        if (fallbackId.length >= 8) {
          await writeOutbox({ id: fallbackId, status: "refused", refusal: parsed.reason });
        }
        console.log(`[agent-runner] refused ${name}: ${parsed.reason}`);
        continue;
      }
      const { request } = parsed;
      if (existsSync(path.join(DIRS.outbox, `${request.id}.json`))) {
        console.log(`[agent-runner] refused ${request.id}: duplicate id`);
        continue;
      }
      if (isStale(created, Date.now())) {
        await writeOutbox({ ...request, status: "refused", refusal: "stale" });
        console.log(`[agent-runner] refused ${request.id}: stale`);
        continue;
      }
      console.log(`[agent-runner] ${request.id}: ${request.command}`);
      const result = await runner.submit(request);
      await writeOutbox(result);
      console.log(
        `[agent-runner] ${request.id}: ${result.status} ${result.exitCode ?? result.refusal}`,
      );
    }
    await delay(1000);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
