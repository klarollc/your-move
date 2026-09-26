import { readFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { composeRole, type RoleBrief } from "@cuckcode/domain";
import {
  CodexStdioSupervisor,
  classifyTurnError,
  classifyTurnItems,
  describeFailure,
  runTurn,
  buildBindingReport,
  collectHandshakeFacts,
  createControlledCodexHome,
  enumerateMcpServers,
  exerciseThreadStartParams,
  type BindingExpectation,
  type ControlledCodexHome,
  type TurnAttempt,
  openSessionLog,
  resolveInstalledCodexExecutable,
  CODEX_PIN,
} from "@cuckcode/runtime-codex";
import type { RuntimeBindingReport } from "@cuckcode/contracts";

import { assertNoCodexDrift } from "./codex-drift.js";
import { KICKOFF_TASK_CONTRACT } from "./phase4-kickoff-briefing.js";

/**
 * One persistent Codex thread for one role, held open across the whole bounded round.
 *
 * The thread must persist, because a revision is a response to a synthesis that the same role has
 * to have seen. Opening a fresh thread per turn would give six roles with no memory of their own
 * contributions, and the revisions would be six strangers reacting to a document they had not read.
 *
 * Everything the role is comes from its controlled home. The task contract attached at thread start
 * is identical for all six — that is the equal-briefing requirement — so the only difference between
 * these six sessions is the brief each one carries.
 */
const ROOT = resolve(process.cwd());
const ROLES_ROOT = resolve(ROOT, "roles");
/** CX-5: one diagnostic log per session, written before the controlled home is deleted. */
const SESSIONS_ROOT = resolve(ROOT, "docs/evidence/runtime/sessions");
const SCRIPT_NAME = basename(process.argv[1] ?? "unknown").replace(/\.[cm]?[jt]s$/u, "");

const CREDENTIAL_SOURCE = resolve(
  process.env.CUCKCODE_CODEX_AUTH ??
    join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
);

export type ObservedTurnEffect = { kind: string; phase: string };

export type TurnResult =
  | { ok: true; text: string; effects: ObservedTurnEffect[]; attempts: TurnAttempt[] }
  | {
      ok: false;
      code: string;
      detail: string;
      effects: ObservedTurnEffect[];
      attempts: TurnAttempt[];
    };

export type KickoffSession = {
  roleId: string;
  agentId: string;
  bindingId: string;
  report: RuntimeBindingReport;
  turn: (text: string) => Promise<TurnResult>;
  close: () => Promise<void>;
};

export async function openKickoffSession(input: {
  roleId: string;
  agentId: string;
  bindingId: string;
  expected: BindingExpectation;
  cwd: string;
}): Promise<{ ok: true; session: KickoffSession } | { ok: false; code: string; detail: string }> {
  // R3: refuse before anything is spawned for a turn if the installed Codex is not the pinned one.
  try {
    await assertNoCodexDrift();
  } catch (cause) {
    return {
      ok: false,
      code: "CODEX_DRIFT",
      detail: cause instanceof Error ? cause.message : "drift preflight failed",
    };
  }
  const artifact = await readFile(resolve(ROLES_ROOT, "authored", `${input.roleId}.json`));
  const composed = composeRole(JSON.parse(artifact.toString("utf8")) as RoleBrief);
  if (!composed.ok) {
    return { ok: false, code: "COMPOSITION_REFUSED", detail: composed.refusal.code };
  }

  let home: ControlledCodexHome | undefined;
  let supervisor: CodexStdioSupervisor | undefined;
  let log: { close: () => Promise<string> } | undefined;

  try {
    home = await createControlledCodexHome({
      parentDirectory: tmpdir(),
      instruction: composed.text,
      credentialSourcePath: CREDENTIAL_SOURCE,
    });
    const controlledHome = home;

    supervisor = new CodexStdioSupervisor({
      // Resolved per session, not at import, so a module that only parses turns never needs Codex
      // installed. CUCKCODE_CODEX_EXE overrides the path, never the pin (R1.3).
      executable: resolveInstalledCodexExecutable(),
      codexHome: controlledHome.path,
    });
    log = openSessionLog(supervisor, {
      root: SESSIONS_ROOT,
      script: SCRIPT_NAME,
      roleId: input.roleId,
      pin: CODEX_PIN,
    });
    const initialized = await supervisor.start();

    const auth = await supervisor.readAccountStatus();
    if (!auth.ok) {
      return { ok: false, code: "AUTH_REQUIRED", detail: "managed runtime authentication absent" };
    }

    const threadStart = await supervisor.request(
      "thread/start",
      exerciseThreadStartParams(input.cwd, input.expected, KICKOFF_TASK_CONTRACT),
      30_000,
    );

    const sources = (threadStart as { instructionSources?: unknown }).instructionSources;
    if (
      !Array.isArray(sources) ||
      sources.length !== 1 ||
      sources[0] !== controlledHome.instructionPath
    ) {
      return {
        ok: false,
        code: "INSTRUCTION_SOURCE_MISMATCH",
        detail: `${input.roleId} loaded ${Array.isArray(sources) ? sources.length : "unknown"} instruction sources`,
      };
    }

    // F1.3: what the session started, listed before any turn so the binding can refuse it.
    const mcpServers = await enumerateMcpServers(
      supervisor,
      (threadStart as { thread?: { id?: string } }).thread?.id ?? null,
    );
    const facts = collectHandshakeFacts({
      agentId: input.agentId,
      bindingId: input.bindingId,
      roleId: input.roleId,
      userAgent: initialized.userAgent,
      auth,
      threadStart,
      mcpServers,
    });
    const binding = buildBindingReport(facts, input.expected);
    if (!binding.ok) {
      return {
        ok: false,
        code: "BINDING_REFUSED",
        detail: `${binding.failure.code}: ${binding.failure.detail}`,
      };
    }

    const threadId = (threadStart as { thread?: { id?: string } }).thread?.id;
    if (typeof threadId !== "string") {
      return { ok: false, code: "THREAD_ID_MISSING", detail: "thread/start returned no thread id" };
    }

    const live = supervisor;
    const liveLog = log;
    const session: KickoffSession = {
      roleId: input.roleId,
      agentId: input.agentId,
      bindingId: input.bindingId,
      report: binding.report,
      turn: async (text: string): Promise<TurnResult> => {
        const effects: ObservedTurnEffect[] = [];
        // The shared runner (CP-3): activity-aware limits with interrupt, Codex's retries and
        // failure class recorded, refused server requests failing by name, and at most one
        // transport retry from the run's budget. It matches on the turn id, which is what keeps a
        // thirteen-turn round from replaying turn one.
        const run = await runTurn(live, { threadId, input: [{ type: "text", text }] });
        const turnId = run.turn?.id ?? run.attempts.at(-1)?.turnId ?? "unknown";
        const items = run.turn?.items ?? [];

        // One classification for every caller (R5). Effects are reported even from a turn that
        // failed, and an item nobody has classified stops the turn rather than passing as text.
        const classified = classifyTurnItems(items);
        for (const type of classified.effects) {
          effects.push({ kind: itemKindFor(type), phase: "completed" });
        }
        if (!run.ok) {
          return { ok: false, code: run.code, detail: run.detail, effects, attempts: run.attempts };
        }
        if (classified.unclassified.length > 0) {
          return {
            ok: false,
            code: "UNCLASSIFIED_ITEM_TYPE",
            detail: `turn ${turnId} reported item types with no classification: ${classified.unclassified.join(", ")}`,
            effects,
            attempts: run.attempts,
          };
        }

        const message = items
          .filter((item) => (item as { type?: unknown }).type === "agentMessage")
          .map((item) => String((item as { text?: unknown }).text ?? ""))
          .join("\n")
          .trim();

        if (message.length === 0) {
          return {
            ok: false,
            code: "EMPTY_RESPONSE",
            detail: "no agent message",
            effects,
            attempts: run.attempts,
          };
        }
        return { ok: true, text: message, effects, attempts: run.attempts };
      },
      close: async (): Promise<void> => {
        await live.stop();
        await liveLog.close();
        await controlledHome.dispose();
      },
    };

    home = undefined;
    supervisor = undefined;
    log = undefined;
    return { ok: true, session };
  } catch (cause) {
    return {
      ok: false,
      code: "SESSION_OPEN_FAILED",
      detail: cause instanceof Error ? cause.message : "session did not open",
    };
  } finally {
    // Only reached when the session was not handed back; a live session owns its own teardown.
    if (supervisor) await supervisor.stop();
    if (log) await log.close();
    if (home) await home.dispose();
  }
}

export function describeTurnCompletionFailure(
  turnId: string,
  turn: { status?: string; error?: unknown } | undefined,
): string {
  // One description for every failure record: message, then Codex's class and HTTP status.
  return describeFailure(turnId, String(turn?.status), classifyTurnError(turn?.error));
}

function itemKindFor(type: string): string {
  if (type === "commandExecution") return "runtime.command";
  if (type === "fileChange") return "runtime.file";
  if (["mcpToolCall", "dynamicToolCall", "collabAgentToolCall"].includes(type))
    return "runtime.tool";
  return "runtime.artifact";
}

/**
 * Parses one JSON object from a turn.
 *
 * Models fence JSON even when told not to, so a fence is stripped rather than treated as a refusal —
 * that is a formatting habit, not a failure to answer. Anything else that does not parse is a failed
 * turn: a turn was spent and produced nothing the domain can accept, which is exactly what the
 * kickoff runner records as a per-role failure.
 */
export function parseTurnJson(
  text: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; detail: string } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/u);
  const body = (fenced?.[1] ?? text).trim();
  // An array is a different shape, not a malformed object. Slicing from the first brace would take
  // element one and adopt it as the role's whole position, which is the quiet coercion this project
  // refuses: a role that answered with a list did not answer with a position.
  if (body.startsWith("[")) {
    return { ok: false, detail: "response was a JSON array, not a single position object" };
  }
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: false, detail: "no JSON object in the response" };
  try {
    const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, detail: "response JSON was not an object" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (cause) {
    return { ok: false, detail: cause instanceof Error ? cause.message : "unparseable JSON" };
  }
}
