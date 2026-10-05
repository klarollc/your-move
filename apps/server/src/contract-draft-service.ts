import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  boundedWorkContractSchema,
  contractDraftRecordSchema,
  type AgentContractDraftProvenance,
  type AgentContractDraftRecord,
  type ContractDraftRecord,
} from "@cuckcode/contracts";
import {
  CODEX_PIN,
  CodexStdioSupervisor,
  createControlledCodexHome,
  createRetryBudget,
  featureDisableConfig,
  resolveInstalledCodexExecutable,
  runTurn,
} from "@cuckcode/runtime-codex";
import { stableStringify } from "@cuckcode/domain";

export const CONTRACT_DRAFTER_PROCEDURE_ID = "contract-drafter-v1" as const;
export const CONTRACT_DRAFTER_PROCEDURE_VERSION = "1.0.0" as const;
export const CONTRACT_DRAFTER_RUNTIME = `@openai/codex@${CODEX_PIN}` as const;
export const CONTRACT_DRAFTER_MODEL = "gpt-6.1-sol" as const;
export const CONTRACT_DRAFTER_INSTRUCTIONS = `
You are the CuckCode ${CONTRACT_DRAFTER_PROCEDURE_ID} procedure.
Turn the manager's plain-language request into one bounded structured work contract.
Return exactly one JSON object. Include outcome, exclusions, acceptanceCriteria,
dependencies, evidenceObligations, permissionCeiling, stopConditions, definitionOfDone,
contextRefs, and positive integer maxTurns. Do not add markdown or commentary. Do not invent
repository facts, file references, or manager approval. Use empty arrays when a list has no items.
For permissionCeiling use sandboxMode read-only, approvalPolicy never, networkAccess false,
and windowsSandbox unelevated. Make assumptions explicit in exclusions or stopConditions.
`;

const MAX_DESCRIPTION_LENGTH = 4_000;
const RECEIPT_TTL_MS = 10 * 60_000;
const SHA256 = /^[a-f0-9]{64}$/u;
const DRAFT_ID = /^draft_[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export type ContractDraftCapture = Readonly<{
  providerSessionId: string;
  providerTurnId: string;
  status: "completed" | "failed";
  assistantText: string;
}>;

/**
 * Production adapter for the approved source. Constructing it is inert; a live turn requires the
 * separate explicit environment gate. The loopback launcher can construct it without starting a
 * turn, and the route fails closed until separate live-run authorization is present.
 */
export function createCodexContractDraftSessionAdapter(): ContractDraftSessionAdapter {
  return {
    kind: "codex-app-server",
    get available() {
      return process.env.CUCKCODE_LIVE_CONTRACT_DRAFT === "1";
    },
    async capture(input) {
      if (process.env.CUCKCODE_LIVE_CONTRACT_DRAFT !== "1") {
        throw new Error("CONTRACT_DRAFT_LIVE_RUN_NOT_AUTHORIZED");
      }

      const workspace = await mkdtemp(join(tmpdir(), "cuckcode-contract-draft-workspace-"));
      let home: Awaited<ReturnType<typeof createControlledCodexHome>> | undefined;
      let supervisor: CodexStdioSupervisor | undefined;
      try {
        const authSource =
          process.env.CUCKCODE_CODEX_AUTH ??
          join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json");
        home = await createControlledCodexHome({
          parentDirectory: tmpdir(),
          instruction: input.procedure,
          credentialSourcePath: authSource,
        });
        supervisor = new CodexStdioSupervisor({
          executable: resolveInstalledCodexExecutable(),
          codexHome: home.path,
        });
        await supervisor.start();
        const account = await supervisor.readAccountStatus();
        if (!account.ok) throw new Error("CONTRACT_DRAFT_AUTH_REQUIRED");

        const threadStart = await supervisor.request(
          "thread/start",
          {
            cwd: workspace,
            ephemeral: true,
            model: input.model,
            sandbox: "read-only",
            approvalPolicy: "never",
            config: { features: featureDisableConfig() },
          },
          30_000,
        );
        const thread = asRecord(threadStart)?.thread;
        const providerSessionId = asRecord(thread)?.id;
        const instructionSources = asRecord(threadStart)?.instructionSources;
        if (
          typeof providerSessionId !== "string" ||
          !Array.isArray(instructionSources) ||
          instructionSources.length !== 1 ||
          instructionSources[0] !== home.instructionPath
        ) {
          throw new Error("CONTRACT_DRAFT_SESSION_BINDING_INVALID");
        }

        const run = await runTurn(supervisor, {
          threadId: providerSessionId,
          input: [{ type: "text", text: input.description }],
          retryBudget: createRetryBudget(0),
          limits: {
            idleMs: 45_000,
            hardMs: 120_000,
            startTimeoutMs: 30_000,
            interruptGraceMs: 5_000,
          },
        });
        if (!run.ok || run.turn.status !== "completed") {
          throw new Error("CONTRACT_DRAFT_TURN_FAILED");
        }
        const observed = [...run.streamedItems, ...run.turn.items];
        if (
          observed.some(
            (item) => !["userMessage", "agentMessage"].includes(String(asRecord(item)?.type)),
          )
        ) {
          throw new Error("CONTRACT_DRAFT_TOOL_ITEM_REFUSED");
        }
        const messages = run.turn.items
          .map(asRecord)
          .filter((item) => item?.type === "agentMessage");
        if (
          messages.length !== 1 ||
          typeof messages[0]?.text !== "string" ||
          messages[0].text.length === 0
        ) {
          throw new Error("CONTRACT_DRAFT_ASSISTANT_CAPTURE_INVALID");
        }
        return {
          providerSessionId,
          providerTurnId: run.turn.id,
          status: "completed",
          assistantText: messages[0].text,
        };
      } finally {
        await supervisor?.stop();
        await home?.dispose();
        await rm(workspace, { recursive: true, force: true });
      }
    },
  };
}

export type ContractDraftSessionAdapter = Readonly<{
  kind: "codex-app-server" | "test-fake";
  available?: boolean;
  capture: (
    input: Readonly<{
      procedureId: typeof CONTRACT_DRAFTER_PROCEDURE_ID;
      procedureVersion: typeof CONTRACT_DRAFTER_PROCEDURE_VERSION;
      procedure: typeof CONTRACT_DRAFTER_INSTRUCTIONS;
      model: typeof CONTRACT_DRAFTER_MODEL;
      runtime: typeof CONTRACT_DRAFTER_RUNTIME;
      description: string;
    }>,
  ) => Promise<ContractDraftCapture>;
}>;

export type ContractDraftRequest = Readonly<{
  managerSessionId: string;
  projectId: string;
  expectedRevision: number;
  description: string;
}>;

export type TestOnlyContractDraftReceipt = Readonly<{
  kind: "test-fake";
  testOnly: true;
  state: "fresh" | "used";
  receiptId: string;
  managerSessionId: string;
  projectId: string;
  expectedRevision: number;
  expiresAt: string;
  draft: ContractDraftRecord;
}>;

type StoredReceipt = Readonly<{
  kind: ContractDraftSessionAdapter["kind"];
  receiptId: string;
  managerSessionId: string;
  projectId: string;
  expectedRevision: number;
  expiresAt: string;
  draft: ContractDraftRecord;
}>;

export type ContractDraftService = Readonly<{
  readonly available: boolean;
  create: (request: ContractDraftRequest) => Promise<ContractDraftCreateResult>;
  resolveForCommand: (
    receiptHandle: string,
    binding: Pick<ContractDraftRequest, "managerSessionId" | "projectId" | "expectedRevision">,
  ) =>
    | (StoredReceipt & { kind: "codex-app-server"; state: "fresh" })
    | (TestOnlyContractDraftReceipt & { state: "fresh" })
    | undefined;
  consume: (receiptHandle: string) => void;
  discard: (receiptHandle: string) => void;
  readonly pendingReceiptCount: number;
}>;

export type ContractDraftCreateResult =
  | Readonly<{
      ok: true;
      candidate: AgentContractDraftRecord["candidate"];
      provenance: AgentContractDraftProvenance;
      receiptHandle: string;
      expiresAt: string;
      source: ContractDraftSessionAdapter["kind"];
      testOnly: boolean;
    }>
  | Readonly<{ ok: false; code: string; detail: string }>;

export function createContractDraftService(options: {
  mode: "development" | "test" | "production";
  adapter: ContractDraftSessionAdapter;
  now: () => string;
  createId?: () => string;
}): ContractDraftService {
  if (options.adapter.kind === "test-fake" && options.mode !== "test") {
    throw new Error("CONTRACT_DRAFT_TEST_ADAPTER_FORBIDDEN");
  }
  const createId = options.createId ?? (() => randomUUID().replaceAll("-", ""));
  const receipts = new Map<string, StoredReceipt>();

  return {
    get available() {
      return (
        options.mode !== "test" &&
        options.adapter.kind === "codex-app-server" &&
        options.adapter.available === true
      );
    },
    get pendingReceiptCount() {
      return receipts.size;
    },
    async create(request) {
      const invalid = validateRequest(request);
      if (invalid) return { ok: false, code: "CONTRACT_DRAFT_REQUEST_INVALID", detail: invalid };

      let captured: ContractDraftCapture;
      try {
        captured = await options.adapter.capture({
          procedureId: CONTRACT_DRAFTER_PROCEDURE_ID,
          procedureVersion: CONTRACT_DRAFTER_PROCEDURE_VERSION,
          procedure: CONTRACT_DRAFTER_INSTRUCTIONS,
          model: CONTRACT_DRAFTER_MODEL,
          runtime: CONTRACT_DRAFTER_RUNTIME,
          description: request.description.trim(),
        });
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : "";
        if (reason === "CONTRACT_DRAFT_LIVE_RUN_NOT_AUTHORIZED") {
          return {
            ok: false,
            code: "CONTRACT_DRAFT_NOT_AUTHORIZED",
            detail: "Live agent drafting has not been authorized. No draft was created.",
          };
        }
        return {
          ok: false,
          code: "CONTRACT_DRAFT_SESSION_FAILED",
          detail:
            "The pinned draft session did not complete. No draft was saved and no alternate model or template was substituted; owner review is required before retrying.",
        };
      }

      if (
        captured.status !== "completed" ||
        !boundedId(captured.providerSessionId) ||
        !boundedId(captured.providerTurnId) ||
        typeof captured.assistantText !== "string" ||
        captured.assistantText.length === 0 ||
        captured.assistantText.length > 100_000
      ) {
        return {
          ok: false,
          code: "CONTRACT_DRAFT_CAPTURE_INVALID",
          detail: "The pinned session did not return one complete, bound assistant response.",
        };
      }

      let decoded: unknown;
      try {
        decoded = JSON.parse(captured.assistantText) as unknown;
      } catch {
        return {
          ok: false,
          code: "CONTRACT_DRAFT_SCHEMA_INVALID",
          detail: "The agent response was not a structured work contract.",
        };
      }
      const parsed = boundedWorkContractSchema.safeParse(decoded);
      if (!parsed.success) {
        return {
          ok: false,
          code: "CONTRACT_DRAFT_SCHEMA_INVALID",
          detail: "The agent response did not satisfy the bounded work contract schema.",
        };
      }

      const draftId = createId();
      if (!DRAFT_ID.test(draftId)) {
        return {
          ok: false,
          code: "CONTRACT_DRAFT_ID_INVALID",
          detail: "The draft session could not be assigned a valid receipt identity.",
        };
      }
      let requestSha256: string;
      let candidateSha256: string;
      try {
        requestSha256 = digest(stableStringify({ description: request.description.trim() }));
        candidateSha256 = digest(stableStringify(parsed.data));
      } catch {
        return {
          ok: false,
          code: "CONTRACT_DRAFT_DIGEST_INVALID",
          detail: "The captured request or candidate could not be canonically digested.",
        };
      }
      if (!SHA256.test(requestSha256) || !SHA256.test(candidateSha256)) {
        return {
          ok: false,
          code: "CONTRACT_DRAFT_DIGEST_INVALID",
          detail: "The captured request or candidate digest was invalid.",
        };
      }

      const provenance: AgentContractDraftProvenance = {
        draftSource: "agent",
        draftId,
        procedureId: CONTRACT_DRAFTER_PROCEDURE_ID,
        procedureVersion: CONTRACT_DRAFTER_PROCEDURE_VERSION,
        procedureSha256: digest(CONTRACT_DRAFTER_INSTRUCTIONS),
        runtime: CONTRACT_DRAFTER_RUNTIME,
        model: CONTRACT_DRAFTER_MODEL,
        providerSessionId: captured.providerSessionId,
        providerTurnId: captured.providerTurnId,
        requestSha256,
        candidateSha256,
      };
      const draft = contractDraftRecordSchema.parse({
        candidate: parsed.data,
        provenance,
      }) as AgentContractDraftRecord;
      const nowMs = Date.parse(options.now());
      if (!Number.isFinite(nowMs)) {
        return {
          ok: false,
          code: "CONTRACT_DRAFT_CLOCK_INVALID",
          detail: "The server clock could not establish a draft expiry.",
        };
      }
      const expiresAt = new Date(nowMs + RECEIPT_TTL_MS).toISOString();
      const receiptHandle = `draft-receipt_${createId()}`;
      receipts.set(receiptHandle, {
        kind: options.adapter.kind,
        receiptId: receiptHandle,
        managerSessionId: request.managerSessionId,
        projectId: request.projectId,
        expectedRevision: request.expectedRevision,
        expiresAt,
        draft,
      });
      return {
        ok: true,
        candidate: parsed.data,
        provenance,
        receiptHandle,
        expiresAt,
        source: options.adapter.kind,
        testOnly: options.adapter.kind === "test-fake",
      };
    },
    resolveForCommand(receiptHandle, binding) {
      const stored = receipts.get(receiptHandle);
      const currentTime = Date.parse(options.now());
      if (
        !stored ||
        !Number.isFinite(currentTime) ||
        Date.parse(stored.expiresAt) <= currentTime ||
        stored.managerSessionId !== binding.managerSessionId ||
        stored.projectId !== binding.projectId ||
        stored.expectedRevision !== binding.expectedRevision
      ) {
        return undefined;
      }
      if (stored.kind === "test-fake") {
        return { ...stored, kind: "test-fake", testOnly: true, state: "fresh" };
      }
      return { ...stored, kind: "codex-app-server", state: "fresh" };
    },
    consume(receiptHandle) {
      receipts.delete(receiptHandle);
    },
    discard(receiptHandle) {
      receipts.delete(receiptHandle);
    },
  };
}

function validateRequest(request: ContractDraftRequest): string | undefined {
  if (typeof request.managerSessionId !== "string" || request.managerSessionId.trim().length === 0)
    return "an authenticated manager session is required";
  if (!/^project_[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(request.projectId))
    return "the project id is invalid";
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0)
    return "the expected project revision is invalid";
  if (
    typeof request.description !== "string" ||
    request.description.trim().length === 0 ||
    request.description.trim().length > MAX_DESCRIPTION_LENGTH
  ) {
    return `the plain-language request must contain 1 to ${String(MAX_DESCRIPTION_LENGTH)} characters`;
  }
  return undefined;
}

function boundedId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
