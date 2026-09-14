import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parseApprovedRoleExercisePlan } from "@cuckcode/runtime-codex";

import { buildKickoffPreflightInput } from "./phase4-kickoff-preflight.js";
import { openKickoffSession, parseTurnJson } from "./phase4-kickoff-session.js";
import {
  REQUIRED_SECTIONS,
  REQUIRED_STATES,
  buildSurfaceContractBrief,
} from "./phase5-surface-contract.js";

/**
 * Phase 5 Task 3 — the Product Designer authors the surface contract.
 *
 * Decision 5-A gives design to the agents, so this is the agent's artifact, not a draft it reviews.
 * The run is bounded: at most three turns, one to produce and up to two to address named omissions.
 * It spends against the 60-turn Phase 5 ceiling and records what it spent, because a budget nobody
 * debits is a budget that is discovered rather than set.
 *
 * Omissions are named back to the designer rather than filled in here. Completing an agent's contract
 * on its behalf would make the artifact partly mine and the evidence worth less than it looks.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5/surface-contract");
const LEDGER = resolve(ROOT, "docs/evidence/phase-5/turn-ledger.json");
const PACKET_PATH = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md");
const ROLE_ID = "product-designer";
const MAX_TURNS = 3;
const PHASE5_BUDGET = 60;

if (process.env.CUCKCODE_LIVE_PHASE5 !== "1") {
  throw new Error("LIVE_PHASE5_EXPLICIT_OPT_IN_REQUIRED");
}

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

type Ledger = { budget: number; spent: number; entries: Array<Record<string, unknown>> };

const ledger: Ledger = existsSync(LEDGER)
  ? (JSON.parse(await readFile(LEDGER, "utf8")) as Ledger)
  : { budget: PHASE5_BUDGET, spent: 0, entries: [] };

if (ledger.spent + MAX_TURNS > ledger.budget) {
  throw new Error(`PHASE5_BUDGET_EXHAUSTED:${ledger.spent}/${ledger.budget}`);
}

const approved = parseApprovedRoleExercisePlan(await readFile(PACKET_PATH, "utf8"));
if (!approved.ok) throw new Error(approved.code);
const configuration = approved.plan.find((entry) => entry.roleId === ROLE_ID);
if (!configuration) throw new Error("ROLE_NOT_IN_APPROVED_PLAN");

const preflight = await buildKickoffPreflightInput();
const candidate = preflight.bindings.find((entry) => entry.roleId === ROLE_ID);
if (!candidate) throw new Error("ROLE_NOT_BOUND");

const workspace = await mkdtemp(join(tmpdir(), "cuckcode-phase5-"));
await mkdir(OUT, { recursive: true });

const opened = await openKickoffSession({
  roleId: ROLE_ID,
  agentId: candidate.agentId,
  bindingId: candidate.bindingId,
  cwd: workspace,
  expected: {
    requestedModel: configuration.model,
    expectedReasoningEffort: configuration.reasoningEffort,
    expectedAuthMode: "chatgpt",
    protocolVersion: "0.146.0",
    promotedContentSha256: candidate.roleContractVersion.replace(/^content:/u, ""),
  },
});

if (!opened.ok) {
  await rm(workspace, { recursive: true, force: true });
  process.stderr.write(
    `${JSON.stringify({ ok: false, code: opened.code, detail: opened.detail })}\n`,
  );
  process.exitCode = 1;
} else {
  const session = opened.session;
  const attempts: Array<Record<string, unknown>> = [];
  let accepted: Record<string, unknown> | null = null;
  let turnsSpent = 0;

  /** What the contract is missing, in the designer's own vocabulary, so it can be named back. */
  const shortfalls = (value: Record<string, unknown>): string[] => {
    const missing: string[] = [];
    for (const section of REQUIRED_SECTIONS) {
      const present = value[section];
      const empty =
        present === undefined ||
        present === null ||
        (Array.isArray(present) && present.length === 0) ||
        (typeof present === "object" &&
          !Array.isArray(present) &&
          Object.keys(present).length === 0);
      if (empty) missing.push(`section "${section}" is absent or empty`);
    }

    const inventory = Array.isArray(value.stateInventory) ? value.stateInventory : [];
    const ids = new Set(
      inventory.map((entry) => String((entry as { id?: unknown }).id ?? "")).filter(Boolean),
    );
    for (const state of REQUIRED_STATES) {
      if (!ids.has(state.id)) missing.push(`state "${state.id}" is absent from stateInventory`);
    }

    // Distinguishable, not merely annotated: two states sharing a non-colour cue are one state.
    const cues = inventory
      .map((entry) =>
        String((entry as { nonColourCue?: unknown }).nonColourCue ?? "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    const duplicates = [...new Set(cues.filter((cue, index) => cues.indexOf(cue) !== index))];
    for (const cue of duplicates) {
      missing.push(
        `two or more states share the non-colour cue "${cue}"; they must be distinguishable`,
      );
    }
    for (const entry of inventory) {
      const id = String((entry as { id?: unknown }).id ?? "unnamed");
      if (!String((entry as { nonColourCue?: unknown }).nonColourCue ?? "").trim()) {
        missing.push(`state "${id}" has no non-colour cue`);
      }
    }
    return missing;
  };

  let prompt = await buildSurfaceContractBrief();

  while (turnsSpent < MAX_TURNS && accepted === null) {
    const turn = await session.turn(prompt);
    turnsSpent += 1;

    if (!turn.ok) {
      attempts.push({ turn: turnsSpent, accepted: false, code: turn.code, detail: turn.detail });
      break;
    }
    if (turn.effects.length > 0) {
      attempts.push({
        turn: turnsSpent,
        accepted: false,
        code: "EXTERNAL_EFFECT_OBSERVED",
        effects: turn.effects,
      });
      break;
    }

    const parsed = parseTurnJson(turn.text);
    if (!parsed.ok) {
      attempts.push({
        turn: turnsSpent,
        accepted: false,
        code: "PAYLOAD_UNPARSEABLE",
        detail: parsed.detail,
      });
      prompt = `Your reply could not be parsed as one JSON object: ${parsed.detail}. Return the surface contract again as a single JSON object with the required keys, and nothing else.`;
      continue;
    }

    const missing = shortfalls(parsed.value);
    attempts.push({
      turn: turnsSpent,
      accepted: missing.length === 0,
      shortfalls: missing,
      responseSha256: sha256(turn.text),
    });

    if (missing.length === 0) {
      accepted = parsed.value;
      break;
    }
    prompt = `Your surface contract is incomplete. These are the shortfalls, and nothing has been filled in for you:\n\n${missing.map((item) => `  - ${item}`).join("\n")}\n\nReturn the complete surface contract again as one JSON object with every required key and every required state id. Keep what was already right.`;
  }

  await session.close();
  await rm(workspace, { recursive: true, force: true });

  ledger.spent += turnsSpent;
  ledger.entries.push({
    task: "phase-5-task-3-surface-contract",
    roleId: ROLE_ID,
    turns: turnsSpent,
    accepted: accepted !== null,
    at: new Date().toISOString(),
  });
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  await writeFile(
    resolve(OUT, "surface-contract.json"),
    `${JSON.stringify(
      {
        schema: "cuckcode.phase5-surface-contract.v1",
        status:
          accepted === null
            ? "NOT ACCEPTED. The designer did not produce a complete contract within its turn allowance."
            : "Authored by the promoted product-designer. Candidate: the owner accepts fidelity, not this record.",
        roleId: ROLE_ID,
        authoredAt: new Date().toISOString(),
        turnsSpent,
        requiredStates: REQUIRED_STATES.map((state) => state.id),
        attempts,
        contract: accepted,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  process.stdout.write(
    `${JSON.stringify({
      ok: accepted !== null,
      turnsSpent,
      budget: `${ledger.spent}/${ledger.budget}`,
      shortfallsOnFinalAttempt: (attempts.at(-1)?.shortfalls as string[] | undefined)?.length ?? 0,
    })}\n`,
  );
  if (accepted === null) process.exitCode = 1;
}
