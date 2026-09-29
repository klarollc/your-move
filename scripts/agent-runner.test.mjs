import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix, win32 } from "node:path";
import { setImmediate } from "node:timers";
import test from "node:test";

import {
  allowlistViolations,
  isStale,
  locateNpmCli,
  parseRequest,
  refuseEnvironment,
  resolveInvocation,
  scriptClosure,
  scrubEnvironment,
  startupProblems,
} from "./agent-runner-core.mjs";
import { createRunner } from "./agent-runner.mjs";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const readSource = (path) => readFile(new URL(path, root), "utf8");

// ---------------------------------------------------------------------------------------------
// Task 1: the allowlist and its guard
// ---------------------------------------------------------------------------------------------

test("the committed allowlist passes against the real package.json and script sources", async () => {
  const allowlist = await readJson("scripts/agent-runner.allowlist.json");
  const { scripts } = await readJson("package.json");
  assert.deepEqual(await allowlistViolations({ allowlist, scripts, readSource }), []);
});

test("the six read-only checks ruled on 2026-09-26 are allow-listed as themselves", async () => {
  const { commands } = await readJson("scripts/agent-runner.allowlist.json");
  for (const name of [
    "check:toolchain",
    "test:toolchain",
    "test:protocol",
    "protocol:codex:check",
    "protocol:codex:drift",
    "test:runtime",
  ]) {
    assert.deepEqual(commands[name], { kind: "npm", script: name }, name);
  }
});

test("an entry naming a live provider run is refused, and the reason names the opt-in it reads", async () => {
  const { scripts } = await readJson("package.json");
  const allowlist = { commands: { release: { kind: "npm", script: "phase5:release:run" } } };
  const violations = await allowlistViolations({ allowlist, scripts, readSource });
  assert.equal(violations.length, 1);
  assert.match(
    violations[0],
    /^release: .*scripts\/run-phase5-release-review\.ts.*process\.env\.CUCKCODE_/,
  );
});

test("the signed-in surface probe cannot be run by the runner (F1.5)", async () => {
  const { scripts } = await readJson("package.json");
  const allowlist = { commands: { probe: { kind: "npm", script: "codex:probe-surface" } } };
  const violations = await allowlistViolations({ allowlist, scripts, readSource });
  assert.equal(violations.length, 1);
  assert.match(
    violations[0],
    /^probe: .*scripts\/run-codex-probe-surface\.ts.*process\.env\.CUCKCODE_LIVE_PROBE/,
  );
});

test("an entry naming an owner-run promotion is refused", async () => {
  const { scripts } = await readJson("package.json");
  const allowlist = { commands: { promote: { kind: "npm", script: "roles:promote" } } };
  const violations = await allowlistViolations({ allowlist, scripts, readSource });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /process\.env\.CUCKCODE_OWNER_PROMOTION/);
});

test("an entry whose command writes evidence is refused", async () => {
  const { scripts } = await readJson("package.json");
  const allowlist = { commands: { w: { kind: "npm", script: "phase5:provenance:write" } } };
  const violations = await allowlistViolations({ allowlist, scripts, readSource });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /--write/);
});

test("a write reached only through a nested npm run is still refused", async () => {
  const scripts = { outer: "npm run inner && echo ok", inner: "node x.mjs --write" };
  const allowlist = { commands: { outer: { kind: "npm", script: "outer" } } };
  const violations = await allowlistViolations({ allowlist, scripts, readSource: async () => "" });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /--write/);
});

test("installs, inline environment assignments and force flags are refused", async () => {
  const scripts = {
    a: "npm install left-pad",
    b: "npm ci",
    c: "CUCKCODE_LIVE_X=1 node run.mjs",
    d: "git push --force",
  };
  const allowlist = {
    commands: Object.fromEntries(Object.keys(scripts).map((k) => [k, { kind: "npm", script: k }])),
  };
  const violations = await allowlistViolations({ allowlist, scripts, readSource: async () => "" });
  assert.equal(violations.length, 4);
});

test("a missing script, an unknown kind and a forced git entry are each refused", async () => {
  const allowlist = {
    commands: {
      gone: { kind: "npm", script: "does-not-exist" },
      shell: { kind: "shell", command: "rm -rf /" },
      force: { kind: "git", args: ["push", "--force"] },
      forceShort: { kind: "git", args: ["push", "-f"] },
    },
  };
  const violations = await allowlistViolations({
    allowlist,
    scripts: {},
    readSource: async () => "",
  });
  assert.equal(violations.length, 4);
});

test("git push exists only behind the allow-push requirement", async () => {
  const allowlist = await readJson("scripts/agent-runner.allowlist.json");
  const pushes = Object.entries(allowlist.commands).filter(
    ([, entry]) => entry.kind === "git" && entry.args[0] === "push",
  );
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0][1].requires, "allow-push");
  const ungated = { commands: { p: { kind: "git", args: ["push", "origin", "main"] } } };
  assert.equal(
    (await allowlistViolations({ allowlist: ungated, scripts: {}, readSource })).length,
    1,
  );
});

test("the closure follows npm run references, names the files it invokes, and survives a cycle", () => {
  const scripts = { a: "npm run b && tsx scripts/one.ts", b: "node scripts/two.mjs && npm run a" };
  const closure = scriptClosure(scripts, "a");
  assert.deepEqual([...closure.files].sort(), ["scripts/one.ts", "scripts/two.mjs"]);
  assert.equal(closure.commands.length, 2);
  assert.deepEqual(closure.missing, []);
});

// ---------------------------------------------------------------------------------------------
// Task 2: request parsing and staleness
// ---------------------------------------------------------------------------------------------

const COMMANDS = { verify: { kind: "npm", script: "verify" } };
const parse = (value) =>
  parseRequest(typeof value === "string" ? value : JSON.stringify(value), { commands: COMMANDS });

test("a request with only an id and an allow-listed command is accepted", () => {
  assert.deepEqual(parse({ id: "req-00000001", command: "verify" }), {
    ok: true,
    request: { id: "req-00000001", command: "verify" },
  });
});

test("each malformed request is refused with its own named reason", () => {
  const cases = [
    [{ id: "req-00000001", command: "phase5:release:run" }, "unknown-command"],
    [{ id: "req-00000001", command: "verify", args: ["--write"] }, "extra-key"],
    [{ id: "req-00000001", command: "verify", env: { CUCKCODE_LIVE_PHASE5: "1" } }, "extra-key"],
    [{ id: "../../escape", command: "verify" }, "bad-id"],
    [{ id: "short", command: "verify" }, "bad-id"],
    [{ id: "req-00000001" }, "missing-command"],
    [["req-00000001", "verify"], "not-object"],
    ["{ not json", "not-json"],
    [JSON.stringify({ id: "req-00000001", command: "verify", pad: "x".repeat(2000) }), "oversized"],
  ];
  for (const [input, reason] of cases) {
    const result = parse(input);
    assert.equal(result.ok, false, `accepted ${JSON.stringify(input).slice(0, 60)}`);
    assert.equal(result.reason, reason, `wrong reason for ${JSON.stringify(input).slice(0, 60)}`);
  }
});

test("a command is looked up as an own property, never through the prototype", () => {
  assert.equal(parse({ id: "req-00000001", command: "toString" }).reason, "unknown-command");
  assert.equal(parse({ id: "req-00000001", command: "__proto__" }).reason, "unknown-command");
});

test("a request older than the limit is stale and a fresh one is not", () => {
  const now = Date.parse("2026-09-25T12:00:00Z");
  assert.equal(isStale(now - 10 * 60 * 1000 - 1, now), true);
  assert.equal(isStale(now - 60 * 1000, now), false);
  assert.equal(isStale(Number.NaN, now), true);
});

// ---------------------------------------------------------------------------------------------
// Task 3: environment refusal and the scrubbed child environment
// ---------------------------------------------------------------------------------------------

test("every CUCKCODE_ variable is refused, whatever its family or case", () => {
  const env = {
    PATH: "C:/bin",
    CUCKCODE_LIVE_PHASE5: "1",
    CUCKCODE_OWNER_PROMOTION: "1",
    CUCKCODE_REGENERATE_EVIDENCE: "1",
    CUCKCODE_CODEX_EXE: "C:/elsewhere/codex.exe",
    cuckcode_live_kickoff: "1",
  };
  assert.deepEqual(refuseEnvironment(env), [
    "CUCKCODE_CODEX_EXE",
    "CUCKCODE_LIVE_PHASE5",
    "CUCKCODE_OWNER_PROMOTION",
    "CUCKCODE_REGENERATE_EVIDENCE",
    "cuckcode_live_kickoff",
  ]);
  assert.deepEqual(refuseEnvironment({ PATH: "C:/bin" }), []);
});

test("the child environment keeps everything else and drops every CUCKCODE_ variable", () => {
  const env = { PATH: "C:/bin", HOME: "C:/Users/x", CUCKCODE_LIVE_PHASE5: "1", cuckcode_x: "1" };
  const scrubbed = scrubEnvironment(env);
  assert.deepEqual(scrubbed, { PATH: "C:/bin", HOME: "C:/Users/x" });
  assert.equal(env.CUCKCODE_LIVE_PHASE5, "1", "the input environment must not be mutated");
});

// ---------------------------------------------------------------------------------------------
// Task 4: execution through an injected spawner
// ---------------------------------------------------------------------------------------------

const NODE = "C:/Program Files/nodejs/node.exe";
const NPM_CLI = "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js";

function fakeWorld({
  porcelain = "",
  evidenceAfter = "",
  branch = "hermes/work",
  env = {},
  allowPush = false,
  archive = async (id) => `failures/${id}`,
} = {}) {
  const spawns = [];
  const archived = [];
  const gitCalls = [];
  const pending = [];
  let evidenceReads = 0;
  const world = {
    spawns,
    archived,
    gitCalls,
    pending,
    runner: createRunner({
      allowlist: {
        commands: {
          verify: { kind: "npm", script: "verify" },
          "git-status": { kind: "git", args: ["status", "--porcelain=v1", "--branch"] },
          "git-push": {
            kind: "git",
            args: ["push", "origin", "{branch}", "main"],
            requires: "allow-push",
          },
        },
      },
      env: { PATH: "C:/bin", ...env },
      execPath: NODE,
      npmCli: NPM_CLI,
      allowPush,
      now: () => new Date("2026-09-25T12:00:00Z"),
      logPathFor: (id) => `logs/${id}.log`,
      git: async (args) => {
        gitCalls.push(args);
        if (args[0] === "rev-parse" && args[1] === "HEAD") return { code: 0, stdout: "abc123\n" };
        if (args[0] === "rev-parse") return { code: 0, stdout: `${branch}\n` };
        if (args.includes("docs/evidence")) {
          evidenceReads += 1;
          return { code: 0, stdout: evidenceReads === 1 ? "" : evidenceAfter };
        }
        if (args[0] === "status") return { code: 0, stdout: porcelain };
        return { code: 0, stdout: "" };
      },
      spawnLogged: (file, args, options) => {
        spawns.push({ file, args, options });
        return new Promise((resolve) => pending.push(resolve));
      },
      archiveFailure: async (id) => {
        archived.push(id);
        return archive(id);
      },
    }),
  };
  return world;
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("an npm command spawns node with npm-cli.js, an argument array, no shell and a scrubbed environment", async () => {
  const clean = fakeWorld();
  const done = clean.runner.submit({ id: "req-00000001", command: "verify" });
  await settle();
  assert.equal(clean.spawns.length, 1);
  const [call] = clean.spawns;
  assert.equal(call.file, NODE);
  assert.deepEqual(call.args, [NPM_CLI, "run", "verify"]);
  assert.equal(call.options.shell, false);
  assert.deepEqual(Object.keys(call.options.env), ["PATH"]);
  clean.pending[0](0);
  const result = await done;
  assert.equal(result.status, "completed");
  assert.equal(result.exitCode, 0);
  assert.equal(result.logPath, "logs/req-00000001.log");
});

test("requests run one at a time: the second spawns only after the first finishes", async () => {
  const world = fakeWorld();
  const first = world.runner.submit({ id: "req-00000001", command: "verify" });
  const second = world.runner.submit({ id: "req-00000002", command: "verify" });
  await settle();
  assert.equal(world.spawns.length, 1, "the second request started while the first was running");
  world.pending[0](1);
  await first;
  await settle();
  assert.equal(world.spawns.length, 2);
  world.pending[1](0);
  assert.equal((await second).exitCode, 0);
});

test("the result says which tree was tested, whether it was dirty, and whether evidence changed", async () => {
  const world = fakeWorld({
    porcelain: " M README.md\n",
    evidenceAfter: " M docs/evidence/x.json\n",
  });
  const done = world.runner.submit({ id: "req-00000001", command: "verify" });
  await settle();
  assert.equal(world.spawns.length, 1);
  world.pending[0](0);
  const result = await done;
  assert.equal(result.head, "abc123");
  assert.equal(result.porcelain, " M README.md\n");
  assert.equal(result.dirty, true);
  assert.equal(result.evidenceChanged, true);
  assert.equal(result.startedAt, "2026-09-25T12:00:00.000Z");
});

test("a request is refused without spawning while any CUCKCODE_ variable is set", async () => {
  const world = fakeWorld({ env: { CUCKCODE_LIVE_PHASE5: "1" } });
  const result = await world.runner.submit({ id: "req-00000001", command: "verify" });
  assert.equal(result.status, "refused");
  assert.match(result.refusal, /CUCKCODE_LIVE_PHASE5/);
  assert.equal(world.spawns.length, 0);
});

test("npm-cli.js is found from npm_execpath or beside node, and is never guessed", () => {
  const exists = (set) => (path) => set.includes(path);
  const sibling = win32.join(
    win32.dirname("C:\\nodejs\\node.exe"),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  assert.equal(
    locateNpmCli({
      execPath: "C:\\nodejs\\node.exe",
      npmExecPath: "D:\\npm\\bin\\npm-cli.js",
      exists: exists(["D:\\npm\\bin\\npm-cli.js", sibling]),
      path: win32,
    }),
    "D:\\npm\\bin\\npm-cli.js",
  );
  assert.equal(
    locateNpmCli({
      execPath: "C:\\nodejs\\node.exe",
      npmExecPath: "C:\\nodejs\\npm.cmd",
      exists: exists(["C:\\nodejs\\npm.cmd", sibling]),
      path: win32,
    }),
    sibling,
  );
  assert.equal(
    locateNpmCli({
      execPath: "/usr/bin/node",
      npmExecPath: undefined,
      exists: exists([]),
      path: posix,
    }),
    null,
  );
});

test("startup is refused when npm-cli.js is missing, the environment is not clean, or the allowlist is unusable", () => {
  assert.deepEqual(startupProblems({ npmCli: NPM_CLI, env: { PATH: "x" }, violations: [] }), []);
  const problems = startupProblems({
    npmCli: null,
    env: { CUCKCODE_OWNER_PROMOTION: "1" },
    violations: ["release: reads process.env.CUCKCODE_LIVE_PHASE"],
  });
  assert.equal(problems.length, 3);
});

// ---------------------------------------------------------------------------------------------
// Task 5: git push behind --allow-push
// ---------------------------------------------------------------------------------------------

const PUSH = { kind: "git", args: ["push", "origin", "{branch}", "main"], requires: "allow-push" };

test("git push is refused unless the runner was started with --allow-push", () => {
  const result = resolveInvocation({
    entry: PUSH,
    execPath: NODE,
    npmCli: NPM_CLI,
    branch: "hermes/work",
    allowPush: false,
  });
  assert.deepEqual(result, { ok: false, refusal: "push-not-enabled" });
});

test("with --allow-push, the push argv is fixed: the current branch and main, never forced", () => {
  const result = resolveInvocation({
    entry: PUSH,
    execPath: NODE,
    npmCli: NPM_CLI,
    branch: "hermes/work",
    allowPush: true,
  });
  assert.deepEqual(result, {
    ok: true,
    file: "git",
    args: ["push", "origin", "hermes/work", "main"],
  });
});

test("a detached HEAD, or a branch name that looks like a flag, is refused", () => {
  for (const branch of ["HEAD", "", "--force", "-f"]) {
    const result = resolveInvocation({
      entry: PUSH,
      execPath: NODE,
      npmCli: NPM_CLI,
      branch,
      allowPush: true,
    });
    assert.equal(result.ok, false, `accepted branch ${JSON.stringify(branch)}`);
  }
});

test("through the runner, git push without --allow-push never reaches git", async () => {
  const world = fakeWorld();
  const result = await world.runner.submit({ id: "req-00000001", command: "git-push" });
  assert.equal(result.status, "refused");
  assert.equal(result.refusal, "push-not-enabled");
  assert.equal(world.spawns.length, 0);
  assert.equal(
    world.gitCalls.some((args) => args[0] === "push"),
    false,
  );
});

test("through the runner, an enabled push spawns git with the resolved branch", async () => {
  const world = fakeWorld({ branch: "hermes/work", allowPush: true });
  const done = world.runner.submit({ id: "req-00000001", command: "git-push" });
  await settle();
  assert.equal(world.spawns.length, 1);
  assert.equal(world.spawns[0].file, "git");
  assert.deepEqual(world.spawns[0].args, ["push", "origin", "hermes/work", "main"]);
  assert.equal(world.spawns[0].options.shell, false);
  world.pending[0](0);
  assert.equal((await done).status, "completed");
});

// DF-028 (owner-approved 2026-09-29): a failed run keeps its Playwright output. Three blank-page
// failures went unexplained because the next run wiped test-results/.
test("a failed command archives its test output and says where", async () => {
  const world = fakeWorld();
  const done = world.runner.submit({ id: "req-00000010", command: "verify" });
  await settle();
  world.pending[0](1);
  const result = await done;
  assert.deepEqual(world.archived, ["req-00000010"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.failureArtifacts, "failures/req-00000010");
});

test("a passing command archives nothing", async () => {
  const world = fakeWorld();
  const done = world.runner.submit({ id: "req-00000011", command: "verify" });
  await settle();
  world.pending[0](0);
  const result = await done;
  assert.deepEqual(world.archived, []);
  assert.equal("failureArtifacts" in result, false);
});

test("an archive that fails is reported and does not change the result", async () => {
  const world = fakeWorld({
    archive: async () => {
      throw new Error("disk full");
    },
  });
  const done = world.runner.submit({ id: "req-00000012", command: "verify" });
  await settle();
  world.pending[0](1);
  const result = await done;
  assert.equal(result.status, "completed");
  assert.equal(result.exitCode, 1);
  assert.equal(result.failureArtifacts, null);
  assert.equal(result.archiveError, "disk full");
});
