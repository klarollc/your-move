import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { CODEX_PIN, parseApprovedRoleExercisePlan } from "@cuckcode/runtime-codex";

import { runCodexSmoke, type SmokeLedger } from "./codex-smoke.js";
import { buildKickoffPreflightInput } from "./phase4-kickoff-preflight.js";
import { openKickoffSession } from "./phase4-kickoff-session.js";

/**
 * `$env:CUCKCODE_LIVE_SMOKE='1'; npm run codex:smoke` — owner-run only (CP-2, spec §4.4).
 *
 * One text-only turn for the Release Reviewer at the pinned Codex. The session opener runs the
 * drift preflight first and writes the session log; this writes the smoke record and spends from
 * `docs/evidence/runtime/smoke-ledger.json`, never from the Phase 5 ledger.
 */
const ROOT = resolve(process.cwd());
const LEDGER = resolve(ROOT, "docs/evidence/runtime/smoke-ledger.json");
const RECORDS = resolve(ROOT, "docs/evidence/runtime/smoke");
const PACKET_PATH = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md");
const ROLE_ID = "release-reviewer";

const approved = parseApprovedRoleExercisePlan(await readFile(PACKET_PATH, "utf8"));
if (!approved.ok) throw new Error(approved.code);
const configuration = approved.plan.find((entry) => entry.roleId === ROLE_ID);
if (!configuration) throw new Error("ROLE_NOT_IN_APPROVED_PLAN");

const workspace = await mkdtemp(join(tmpdir(), "cuckcode-codex-smoke-"));
try {
  const outcome = await runCodexSmoke({
    optIn: process.env.CUCKCODE_LIVE_SMOKE === "1",
    pin: CODEX_PIN,
    requestedModel: configuration.model,
    readLedger: async () => JSON.parse(await readFile(LEDGER, "utf8")) as SmokeLedger,
    writeLedger: async (ledger) =>
      await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`, "utf8"),
    openSession: async () => {
      const preflight = await buildKickoffPreflightInput();
      const candidate = preflight.bindings.find((entry) => entry.roleId === ROLE_ID);
      if (!candidate) return { ok: false, code: "ROLE_NOT_BOUND", detail: ROLE_ID };
      return await openKickoffSession({
        roleId: ROLE_ID,
        agentId: candidate.agentId,
        bindingId: candidate.bindingId,
        cwd: workspace,
        expected: {
          requestedModel: configuration.model,
          expectedReasoningEffort: configuration.reasoningEffort,
          expectedAuthMode: "chatgpt",
          protocolVersion: CODEX_PIN,
          promotedContentSha256: candidate.roleContractVersion.replace(/^content:/u, ""),
        },
      });
    },
    writeRecord: async (record) => {
      await mkdir(RECORDS, { recursive: true });
      const path = resolve(
        RECORDS,
        `${String(record.startedAt).replace(/[:.]/gu, "-")}-${ROLE_ID}.json`,
      );
      await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      return relative(ROOT, path).split("\\").join("/");
    },
    now: () => new Date().toISOString(),
  });
  process.stdout.write(`${JSON.stringify(outcome)}\n`);
  if (!outcome.ok) process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
