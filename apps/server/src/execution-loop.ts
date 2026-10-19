import { randomUUID } from "node:crypto";

import type { ExecutionRecord, ExecutionStore, TurnCommit } from "./execution-store.js";
import { DEFAULT_MAX_TURNS } from "./execution-store.js";
import {
  toolScopeForCeiling,
  toolsForScope,
  type Tool,
  type ToolAuditEntry,
  type ToolContext,
  type ToolRegistry,
} from "./execution-tools.js";
import type { IntegrationsVault } from "./integrations-vault.js";
import { validateArgs } from "./json-schema-lite.js";
import {
  chatWithTools,
  type ChatReply,
  type ToolCall,
  type TranscriptEntry,
} from "./provider-chat.js";
import {
  ProviderAuthorizationError,
  ProviderResponseError,
  ProviderUnavailableError,
  listProviderModels,
} from "./provider-client.js";
import type { ProviderKind, openProviderVault } from "./provider-vault.js";
import { PROPOSAL_STALE_CODE, PROPOSAL_STALE_MESSAGE } from "./tool-github.js";
import type { BoundedContract } from "./work-contract.js";
import { pickModels } from "./work-drafts.js";

// The hosted execution loop (R3).
//
// Deviation, recorded for the Cinder gate: this is a NEW loop, not runBoundedKickoff()
// (packages/application/src/kickoff-run.ts). That function drives a D-25 kickoff only: its turns
// are contribution/synthesis/revision, each payload is validated by the kickoff domain, and its
// bound is the kickoff budget (6 + 1 + 6 within 13 turns, kickoff-policy.ts). An execution turn
// would be rejected there and stop the run at NO_CONTRIBUTIONS. The kickoff-run TurnRunner type is
// not imported either: apps/server does not depend on @cuckcode/application, and adding it would
// change the lockfile for shape alone. The bound here is `hasTurnsRemaining`, one checked function.

type ProviderVault = ReturnType<typeof openProviderVault>;

/** The run's bound: a turn may start only while turns remain. Checked before every model call. */
export function hasTurnsRemaining(turnCount: number, maxTurns: number): boolean {
  return Number.isInteger(turnCount) && Number.isInteger(maxTurns) && turnCount < maxTurns;
}

export const CONTROL_MESSAGE = "proposal recorded, awaiting owner approval";
const DENIAL_NOTE =
  "The owner denied this proposal; the change was not made. Do not repeat it unchanged. Continue " +
  "within the approved scope, or stop and explain what you need from the owner.";

export function buildSystemPrompt(contract: BoundedContract, tools: readonly Tool[]): string {
  const list = (items: readonly string[]) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- (none stated)";
  return [
    "You are carrying out one piece of work the owner has approved. Stay inside it.",
    "",
    `Outcome:\n${contract.outcome}`,
    "",
    `In scope:\n${list(contract.scope)}`,
    "",
    `Out of scope:\n${list(contract.exclusions)}`,
    "",
    `Done when:\n${list(contract.acceptanceCriteria)}`,
    "",
    "Tools you can use:",
    ...tools.map(
      (tool) =>
        `- ${tool.name} (${tool.sideEffectClass === "read" ? "reads only" : "needs owner approval"}): ${tool.description}`,
    ),
    "",
    "Rules:",
    "- You can act only through the tools listed above. Nothing else you write has any effect.",
    "- A tool that needs owner approval does not act when you call it: it records a proposal and the work pauses until the owner approves or denies it. Make at most one proposal at a time.",
    "- Before proposing a change to a file, read it with github_read and pass the sha you read as base_sha (an empty string for a new file).",
    "- When the work is done, or you need the owner's input, reply in plain language with what you did and what is left, and call no tools.",
  ].join("\n");
}

const SECRET_KEY = /token|secret|password|passwd|authorization|api[_-]?key|credential|^pat$/i;
const SECRET_VALUE = [
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /sk-[A-Za-z0-9_-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
];
const AUDIT_STRING_LIMIT = 2_000;

/** Arguments as recorded in tool_audit: secrets removed, long strings shortened. */
export function redactForAudit(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === "string") {
    let text = value;
    for (const secret of secrets) if (secret) text = text.split(secret).join("[REDACTED]");
    for (const pattern of SECRET_VALUE) text = text.replace(pattern, "[REDACTED]");
    return text.length > AUDIT_STRING_LIMIT
      ? `${text.slice(0, AUDIT_STRING_LIMIT)}…[${text.length} chars]`
      : text;
  }
  if (Array.isArray(value)) return value.map((item) => redactForAudit(item, secrets));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? "[REDACTED]" : redactForAudit(item, secrets),
      ]),
    );
  }
  return value;
}

export type GateOutcome = {
  results: TranscriptEntry[];
  proposal?: { id: string; tool: string; args: Record<string, unknown> };
  /** Audit rows that reference the proposal; written in the same transaction that creates it. */
  deferredAudits: ToolAuditEntry[];
};

/**
 * The approval gate: the product's safety kernel. Calls are handled in order. A read tool is
 * validated, run and audited, and its result goes back to the model. The first propose-class call
 * is validated and becomes a pending proposal; its one tool result is the control message, and the
 * turn ends there. Calls after it get a "not run" result. The agent path never runs a propose tool.
 */
export async function gateToolCalls(
  calls: readonly ToolCall[],
  options: {
    tools: readonly Tool[];
    ctx: ToolContext;
    newProposalId?: () => string;
  },
): Promise<GateOutcome> {
  const available = new Map(options.tools.map((tool) => [tool.name, tool]));
  const results: TranscriptEntry[] = [];
  const deferredAudits: ToolAuditEntry[] = [];
  let proposal: GateOutcome["proposal"];

  const answer = (call: ToolCall, payload: unknown) =>
    results.push({
      role: "tool",
      toolCallId: call.id,
      name: call.name,
      content: JSON.stringify(payload),
    });

  for (const call of calls) {
    if (proposal) {
      const message = `not run — turn ended at proposal ${proposal.id}`;
      answer(call, { status: "not_run", message });
      deferredAudits.push({
        tool: call.name,
        args: call.arguments,
        resultSummary: message,
        proposalId: proposal.id,
      });
      continue;
    }
    const tool = available.get(call.name);
    if (!tool) {
      answer(call, {
        error: "TOOL_NOT_AVAILABLE",
        message: `${call.name} is not an available tool`,
      });
      options.ctx.audit({
        tool: call.name,
        args: call.arguments,
        resultSummary: "rejected: not an available tool",
      });
      continue;
    }
    const validation = validateArgs(tool.inputSchema, call.arguments);
    if (!validation.ok) {
      answer(call, { error: "TOOL_ARGUMENTS_INVALID", message: validation.error });
      options.ctx.audit({
        tool: call.name,
        args: call.arguments,
        resultSummary: `rejected: invalid arguments (${validation.error})`,
      });
      continue;
    }
    const args = call.arguments as Record<string, unknown>;

    if (tool.sideEffectClass === "propose") {
      const id = options.newProposalId?.() ?? `proposal_${randomUUID()}`;
      proposal = { id, tool: tool.name, args };
      answer(call, { status: "pending_owner_approval", proposalId: id, message: CONTROL_MESSAGE });
      deferredAudits.push({
        tool: tool.name,
        args,
        resultSummary: "diverted: proposal recorded, awaiting owner approval",
        proposalId: id,
      });
      continue;
    }

    let result;
    try {
      result = await tool.run(args, options.ctx);
    } catch {
      result = { ok: false as const, code: "TOOL_FAILED", message: "the tool failed unexpectedly" };
    }
    answer(call, result.ok ? result.data : { error: result.code, message: result.message });
    options.ctx.audit({
      tool: tool.name,
      args,
      resultSummary: result.ok ? `ok: ${result.summary}` : `error: ${result.code}`,
    });
  }
  return { results, ...(proposal ? { proposal } : {}), deferredAudits };
}

export type ExecutionEngine = ReturnType<typeof createExecutionEngine>;

export function createExecutionEngine(options: {
  store: ExecutionStore;
  providerVault: ProviderVault;
  integrationsVault: IntegrationsVault;
  registry: ToolRegistry;
  providerFetch: typeof fetch;
  getContract: (draftId: string) => BoundedContract | undefined;
  now?: () => string;
  shutdownGraceMs?: number;
}) {
  const { store, providerVault, integrationsVault, registry } = options;
  const now = options.now ?? (() => new Date().toISOString());
  const abort = new AbortController();
  let cancelled = false;
  let running: Promise<void> | undefined;
  let kickAgain = false;

  // Boot rule: nothing is mid-turn after a restart, and queued work does not start on its own.
  store.interruptUnfinished("SERVER_RESTARTED", now());

  const credentialsForTools = () => {
    const github =
      integrationsVault.getStatus("github") === "connected"
        ? integrationsVault.getCredential("github")
        : null;
    return github ? { github } : {};
  };

  const contextFor = (executionId: string): ToolContext => {
    const credentials = credentialsForTools();
    const secrets = Object.values(credentials).filter((value): value is string => !!value);
    return {
      executionId,
      credentials,
      signal: abort.signal,
      audit: (entry) => writeAudit(executionId, entry, secrets),
    };
  };

  function writeAudit(executionId: string, entry: ToolAuditEntry, secrets: readonly string[]) {
    store.audit({
      executionId,
      ts: now(),
      tool: entry.tool,
      argsRedacted: JSON.stringify(redactForAudit(entry.args ?? null, secrets)),
      resultSummary: String(redactForAudit(entry.resultSummary, secrets)),
      proposalId: entry.proposalId ?? null,
    });
  }

  /** The provider this pass talks to, chosen once; it must stay connected for every turn. */
  function chooseProvider(): ProviderKind | undefined {
    const selection = providerVault.getModelSelection();
    const candidates: ProviderKind[] =
      selection.mode === "specific" ? [selection.provider] : ["openai", "anthropic"];
    return candidates.find((provider) => providerVault.getProviderStatus(provider) === "connected");
  }

  function credentialFor(provider: ProviderKind): string | null {
    if (providerVault.getProviderStatus(provider) !== "connected") return null;
    return providerVault.getCredential(provider);
  }

  async function callModel(
    provider: ProviderKind,
    credential: string,
    models: string[],
    transcript: readonly TranscriptEntry[],
    tools: readonly Tool[],
  ): Promise<ChatReply> {
    const automatic = providerVault.getModelSelection().mode === "automatic";
    for (const [index, model] of models.entries()) {
      try {
        return await chatWithTools({
          provider,
          credential,
          model,
          transcript,
          tools,
          fetcher: options.providerFetch,
          signal: abort.signal,
        });
      } catch (error) {
        const another = automatic && index < models.length - 1;
        if (error instanceof ProviderUnavailableError && another && !cancelled) continue;
        throw error;
      }
    }
    throw new ProviderResponseError();
  }

  const stop = (execution: ExecutionRecord, status: "interrupted" | "failed", error: string) =>
    store.setStatus(execution.id, status, error, now());

  async function applyApprovedProposal(
    execution: ExecutionRecord,
    transcript: TranscriptEntry[],
  ): Promise<void> {
    const decided = new Set(
      transcript.flatMap((entry) => (entry.role === "proposal_outcome" ? [entry.proposalId] : [])),
    );
    const approved = store
      .listProposals(execution.id)
      .find((proposal) => proposal.status === "approved" && !decided.has(proposal.id));
    if (!approved) return;
    const tool = registry.get(approved.tool);
    const ctx = contextFor(execution.id);
    let content: string;
    let summary: string;
    if (!tool || tool.sideEffectClass !== "propose") {
      content = `Approved, but ${approved.tool} is no longer available, so nothing was changed.`;
      summary = "apply failed: TOOL_NOT_AVAILABLE";
    } else {
      // The server-side applier: the only place a propose-class tool's run() is ever called.
      let result;
      try {
        result = await tool.run(approved.args, ctx);
      } catch {
        result = { ok: false as const, code: "TOOL_FAILED", message: "the applier failed" };
      }
      if (result.ok) {
        store.setProposalStatus(approved.id, "applied", now());
        content = `The owner approved this proposal and it was applied: ${result.summary}. Result: ${JSON.stringify(result.data)}`;
        summary = `applied: ${result.summary}`;
      } else if (result.code === PROPOSAL_STALE_CODE) {
        store.setProposalStatus(approved.id, "stale", now());
        content = PROPOSAL_STALE_MESSAGE;
        summary = "stale: sha changed since the proposal";
      } else {
        content = `The owner approved this proposal, but applying it failed (${result.code}: ${result.message}). Nothing was changed.`;
        summary = `apply failed: ${result.code}`;
      }
    }
    transcript.push({ role: "proposal_outcome", proposalId: approved.id, content });
    ctx.audit({
      tool: approved.tool,
      args: approved.args,
      resultSummary: summary,
      proposalId: approved.id,
    });
    store.commitTurn(
      execution.id,
      { transcript, turnCount: execution.turnCount, status: "working" },
      now(),
    );
  }

  async function processExecution(queued: ExecutionRecord): Promise<void> {
    if (!store.claim(queued.id, now())) return;
    const execution = store.get(queued.id)!;
    const transcript = [...execution.transcript];
    let turnCount = execution.turnCount;
    const contract = options.getContract(execution.draftId);
    if (!contract) return stop(execution, "failed", "WORK_DRAFT_NOT_FOUND");
    const tools = toolsForScope(registry, toolScopeForCeiling(contract.permissionCeiling));

    await applyApprovedProposal(execution, transcript);

    const provider = chooseProvider();
    if (!provider) return stop(execution, "interrupted", "PROVIDER_DISCONNECTED");
    let models: string[] | undefined;

    for (;;) {
      if (cancelled) return stop(execution, "interrupted", "SERVER_SHUTDOWN");
      if (!hasTurnsRemaining(turnCount, execution.maxTurns)) {
        return stop(execution, "failed", "TURN_BUDGET_EXHAUSTED");
      }
      // Per-turn credential check: a disconnect lands here, after the turn in flight finished.
      const credential = credentialFor(provider);
      if (!credential) return stop(execution, "interrupted", "PROVIDER_DISCONNECTED");

      let reply: ChatReply;
      try {
        if (!models) {
          models = pickModels(
            provider,
            await listProviderModels(provider, credential, options.providerFetch),
            providerVault.getModelSelection(),
          );
        }
        reply = await callModel(provider, credential, models, transcript, tools);
      } catch (error) {
        if (cancelled) return stop(execution, "interrupted", "SERVER_SHUTDOWN");
        if (error instanceof ProviderAuthorizationError) {
          providerVault.markNeedsReauth(provider);
          return stop(execution, "interrupted", "PROVIDER_REAUTH_REQUIRED");
        }
        if (error instanceof ProviderUnavailableError) {
          return stop(execution, "interrupted", "PROVIDER_UNAVAILABLE");
        }
        return stop(execution, "failed", "PROVIDER_RESPONSE_INVALID");
      }
      turnCount += 1;
      transcript.push({ role: "assistant", content: reply.content, toolCalls: reply.toolCalls });

      if (reply.toolCalls.length === 0) {
        // The model ended without calling a tool: the work now waits on the owner.
        store.commitTurn(
          execution.id,
          { transcript, turnCount, status: "waiting-on-you", output: reply.content },
          now(),
        );
        return;
      }

      const ctx = contextFor(execution.id);
      const gate = await gateToolCalls(reply.toolCalls, { tools, ctx });
      transcript.push(...gate.results);
      const commit: TurnCommit = gate.proposal
        ? { transcript, turnCount, status: "waiting-on-you", proposal: gate.proposal }
        : { transcript, turnCount, status: "working" };
      store.commitTurn(execution.id, commit, now());
      for (const entry of gate.deferredAudits) ctx.audit(entry);
      if (gate.proposal) return;
    }
  }

  async function drain(): Promise<void> {
    for (;;) {
      if (cancelled) return;
      const next = store.nextQueued();
      if (!next) return;
      try {
        await processExecution(next);
      } catch {
        if (cancelled) return;
        try {
          store.setStatus(next.id, "failed", "EXECUTION_INTERNAL_ERROR", now());
        } catch {
          return;
        }
      }
    }
  }

  function kick(): void {
    if (cancelled) return;
    if (running) {
      kickAgain = true;
      return;
    }
    running = drain().finally(() => {
      running = undefined;
      if (kickAgain) {
        kickAgain = false;
        kick();
      }
    });
  }

  const initialTranscript = (contract: BoundedContract): TranscriptEntry[] => [
    {
      role: "system",
      content: buildSystemPrompt(
        contract,
        toolsForScope(registry, toolScopeForCeiling(contract.permissionCeiling)),
      ),
    },
    { role: "user", content: "Begin the approved work now." },
  ];

  return {
    /** Idempotent per draft revision. */
    enqueue(draftId: string, revision: number, contract: BoundedContract): ExecutionRecord {
      const execution = store.enqueue({
        draftId,
        revision,
        maxTurns: DEFAULT_MAX_TURNS,
        transcript: initialTranscript(contract),
        now: now(),
      });
      setImmediate(kick);
      return execution;
    },
    restart(executionId: string) {
      const result = store.restart(
        executionId,
        (previous) => ({
          maxTurns: DEFAULT_MAX_TURNS,
          transcript: [
            ...previous.transcript,
            {
              role: "user",
              content: `The previous attempt stopped before finishing (${previous.error ?? previous.status}). This is a new attempt: continue the work from where it left off.`,
            },
          ],
        }),
        now(),
      );
      if (typeof result !== "string") setImmediate(kick);
      return result;
    },
    decide(executionId: string, proposalId: string, decision: "approved" | "denied") {
      const result = store.decideProposal(
        executionId,
        proposalId,
        decision,
        (transcript) =>
          decision === "denied"
            ? [...transcript, { role: "proposal_outcome", proposalId, content: DENIAL_NOTE }]
            : transcript,
        now(),
      );
      if (result === "OK") {
        if (decision === "denied") {
          const proposal = store.getProposal(proposalId);
          if (proposal) {
            writeAudit(
              executionId,
              {
                tool: proposal.tool,
                args: proposal.args,
                resultSummary: "denied by the owner",
                proposalId,
              },
              [],
            );
          }
        }
        setImmediate(kick);
      }
      return result;
    },
    /** Bounded shutdown: cancel, abort in-flight calls, wait briefly, then mark what was running. */
    async close(): Promise<void> {
      cancelled = true;
      abort.abort();
      const current = running;
      if (current) {
        await Promise.race([
          current.catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, options.shutdownGraceMs ?? 5_000).unref()),
        ]);
      }
      store.interruptUnfinished("SERVER_SHUTDOWN", now());
    },
    /** For tests: resolves once the loop has nothing in flight. */
    async idle(): Promise<void> {
      await new Promise((resolve) => setImmediate(resolve));
      while (running) await running.catch(() => undefined);
    },
  };
}
