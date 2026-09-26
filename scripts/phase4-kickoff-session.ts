import { readFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { composeRole, type RoleBrief } from "@cuckcode/domain";
import {
  CodexStdioSupervisor,
  buildBindingReport,
  collectHandshakeFacts,
  createControlledCodexHome,
  exerciseThreadStartParams,
  type BindingExpectation,
  type ControlledCodexHome,
  resolveInstalledCodexExecutable,
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

const CREDENTIAL_SOURCE = resolve(
  process.env.CUCKCODE_CODEX_AUTH ??
    join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
);

/** Item types that mean the turn produced an effect outside the text channel. */
const EFFECT_ITEM_TYPES = new Set([
  "commandExecution",
  "fileChange",
  "mcpToolCall",
  "dynamicToolCall",
  "collabAgentToolCall",
  "webSearch",
  "imageGeneration",
]);

export type ObservedTurnEffect = { kind: string; phase: string };

export type TurnResult =
  | { ok: true; text: string; effects: ObservedTurnEffect[] }
  | { ok: false; code: string; detail: string; effects: ObservedTurnEffect[] };

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

    const facts = collectHandshakeFacts({
      agentId: input.agentId,
      bindingId: input.bindingId,
      roleId: input.roleId,
      userAgent: initialized.userAgent,
      auth,
      threadStart,
    });
    const binding = buildBindingReport(facts, input.expected);
    if (!binding.ok) {
      return { ok: false, code: "BINDING_REFUSED", detail: binding.failure.code };
    }

    const threadId = (threadStart as { thread?: { id?: string } }).thread?.id;
    if (typeof threadId !== "string") {
      return { ok: false, code: "THREAD_ID_MISSING", detail: "thread/start returned no thread id" };
    }

    const live = supervisor;
    const session: KickoffSession = {
      roleId: input.roleId,
      agentId: input.agentId,
      bindingId: input.bindingId,
      report: binding.report,
      turn: async (text: string): Promise<TurnResult> => {
        const effects: ObservedTurnEffect[] = [];
        try {
          const started = await live.request(
            "turn/start",
            { threadId, input: [{ type: "text", text }] },
            60_000,
          );
          const turnId = (started as { turn?: { id?: string } }).turn?.id;
          if (typeof turnId !== "string") {
            return {
              ok: false,
              code: "TURN_ID_MISSING",
              detail: "turn/start returned no turn id",
              effects,
            };
          }

          // Matching on the turn id is what keeps a thirteen-turn round from replaying turn one.
          const completed = await live.waitForTurnCompleted(turnId, 180_000);
          const turn = (
            completed.params as {
              turn?: {
                status?: string;
                items?: unknown[];
                error?: { message?: string } | null;
              };
            }
          ).turn;
          const items = Array.isArray(turn?.items) ? turn.items : [];

          for (const item of items) {
            const type = (item as { type?: unknown }).type;
            if (typeof type === "string" && EFFECT_ITEM_TYPES.has(type)) {
              effects.push({ kind: itemKindFor(type), phase: "completed" });
            }
          }

          if (turn?.status !== "completed") {
            return {
              ok: false,
              code: "TURN_COMPLETION_INVALID",
              detail: describeTurnCompletionFailure(turnId, turn),
              effects,
            };
          }

          const message = items
            .filter((item) => (item as { type?: unknown }).type === "agentMessage")
            .map((item) => String((item as { text?: unknown }).text ?? ""))
            .join("\n")
            .trim();

          if (message.length === 0) {
            return { ok: false, code: "EMPTY_RESPONSE", detail: "no agent message", effects };
          }
          return { ok: true, text: message, effects };
        } catch (cause) {
          return {
            ok: false,
            code: "RUNTIME_FAILURE",
            detail: cause instanceof Error ? cause.message : "turn did not complete",
            effects,
          };
        }
      },
      close: async (): Promise<void> => {
        await live.stop();
        await controlledHome.dispose();
      },
    };

    home = undefined;
    supervisor = undefined;
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
    if (home) await home.dispose();
  }
}

export function describeTurnCompletionFailure(
  turnId: string,
  turn: { status?: string; error?: { message?: string } | null } | undefined,
): string {
  const status = String(turn?.status);
  const message = turn?.error?.message?.trim();
  return message
    ? `turn ${turnId} reported status ${status}: ${message}`
    : `turn ${turnId} reported status ${status}`;
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
