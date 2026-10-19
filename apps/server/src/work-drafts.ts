import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";

import {
  parseContractDraft,
  renderProse,
  type BoundedContract,
  type ProseDraft,
} from "./work-contract.js";
import {
  ProviderAuthorizationError,
  ProviderResponseError,
  ProviderUnavailableError,
  listProviderModels,
  type ProviderModel,
} from "./provider-client.js";
import type { ModelSelection, ProviderKind } from "./provider-vault.js";

export type WorkDraftStatus = "draft" | "approved";

export type WorkDraftView = {
  id: string;
  status: WorkDraftStatus;
  description: string;
  prose: ProseDraft;
  revision: number;
  updatedAt: string;
  approvedAt: string | null;
};

type StoredDraft = {
  id: string;
  status: WorkDraftStatus;
  description: string;
  contract: BoundedContract;
  revision: number;
  updatedAt: string;
  approvedAt: string | null;
};

const DRAFT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS work_drafts (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('draft', 'approved')),
    description TEXT NOT NULL,
    contract_json TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    updated_at TEXT NOT NULL,
    approved_at TEXT
  );
`;

export function openWorkDraftStore(options: { dataDir: string }) {
  if (!isAbsolute(options.dataDir)) throw new Error("WORK_DRAFT_DATA_DIR_MUST_BE_ABSOLUTE");
  const dataDir = resolve(options.dataDir);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const databasePath = join(dataDir, "work-drafts.sqlite");
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("secure_delete = ON");
  database.exec(DRAFT_SCHEMA);
  if (process.platform !== "win32") chmodSync(databasePath, 0o700);

  const rowToStored = (row: {
    id: string;
    status: WorkDraftStatus;
    description: string;
    contract_json: string;
    revision: number;
    updated_at: string;
    approved_at: string | null;
  }): StoredDraft => ({
    id: row.id,
    status: row.status,
    description: row.description,
    contract: JSON.parse(row.contract_json) as BoundedContract,
    revision: row.revision,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
  });

  return {
    insert(description: string, contract: BoundedContract, now: string): StoredDraft {
      const id = `draft_${randomUUID()}`;
      database
        .prepare(
          "INSERT INTO work_drafts (id, status, description, contract_json, revision, updated_at, approved_at) VALUES (?, 'draft', ?, ?, 1, ?, NULL)",
        )
        .run(id, description, JSON.stringify(contract), now);
      return {
        id,
        status: "draft",
        description,
        contract,
        revision: 1,
        updatedAt: now,
        approvedAt: null,
      };
    },
    get(id: string): StoredDraft | undefined {
      const row = database.prepare("SELECT * FROM work_drafts WHERE id = ?").get(id);
      return row ? rowToStored(row as Parameters<typeof rowToStored>[0]) : undefined;
    },
    list(): StoredDraft[] {
      return (
        database.prepare("SELECT * FROM work_drafts ORDER BY updated_at DESC").all() as Parameters<
          typeof rowToStored
        >[0][]
      ).map(rowToStored);
    },
    // Only draft-status rows can be revised; approved rows are immutable.
    revise(id: string, contract: BoundedContract, now: string): boolean {
      const result = database
        .prepare(
          "UPDATE work_drafts SET contract_json = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND status = 'draft'",
        )
        .run(JSON.stringify(contract), now, id);
      return result.changes === 1;
    },
    // The single irreversible transition. Guarded so a second approval cannot succeed.
    approve(id: string, now: string): boolean {
      const result = database
        .prepare(
          "UPDATE work_drafts SET status = 'approved', approved_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'",
        )
        .run(now, now, id);
      return result.changes === 1;
    },
    close(): void {
      database.close();
    },
  };
}

export function toView(draft: StoredDraft): WorkDraftView {
  return {
    id: draft.id,
    status: draft.status,
    description: draft.description,
    prose: renderProse(draft.contract),
    revision: draft.revision,
    updatedAt: draft.updatedAt,
    approvedAt: draft.approvedAt,
  };
}

// ---- Drafting via the owner's connected provider ----

export class DraftProviderUnavailableError extends Error {
  readonly code = "PROVIDER_NOT_CONNECTED";
  constructor() {
    super("PROVIDER_NOT_CONNECTED");
    this.name = "DraftProviderUnavailableError";
  }
}

const preferredModelPatterns: Record<ProviderKind, RegExp[]> = {
  openai: [/^gpt-4o-mini/, /^gpt-4o/, /^gpt-4/],
  anthropic: [/haiku/i, /sonnet/i, /claude/i],
};

// Automatic selection picks a model the account actually lists, preferring cheaper tiers.
export function pickModels(
  provider: ProviderKind,
  models: ProviderModel[],
  selection: ModelSelection,
): string[] {
  if (selection.mode === "specific" && selection.provider === provider) return [selection.modelId];
  const selected: string[] = [];
  for (const pattern of preferredModelPatterns[provider]) {
    const match = models.find(({ id }) => pattern.test(id) && !selected.includes(id));
    if (match) selected.push(match.id);
  }
  if (selected.length === 0 && models[0]) selected.push(models[0].id);
  if (selected.length === 0) throw new ProviderResponseError();
  return selected;
}

const openAIChatSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});
const anthropicMessageSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

const drafterInstruction = [
  "You turn an owner's plain-language description of a piece of work into a bounded work contract.",
  "Reply with ONLY one JSON object, no prose around it, with exactly these keys:",
  '"outcome" (string: the result in one or two sentences),',
  '"scope" (array of 1-10 short strings: what is in scope),',
  '"exclusions" (array of 0-10 short strings: what is explicitly out of scope),',
  '"acceptanceCriteria" (array of 1-10 short strings: observable checks that prove it is done),',
  '"permissionCeiling" (must be the string "draft_only").',
  "Do not invent requirements the owner did not state; put open questions in exclusions.",
].join(" ");

export type DraftRequest = {
  description: string;
  currentContract?: BoundedContract;
  feedback?: string;
};

export function buildDraftUserMessage(request: DraftRequest): string {
  const parts = [`Owner description:\n${request.description}`];
  if (request.currentContract) {
    parts.push(`Current draft (JSON):\n${JSON.stringify(request.currentContract)}`);
  }
  if (request.feedback) parts.push(`Owner's requested change:\n${request.feedback}`);
  return parts.join("\n\n");
}

export async function draftContractWithProvider(options: {
  request: DraftRequest;
  providers: { provider: ProviderKind; credential: string }[];
  selection: ModelSelection;
  fetcher: typeof fetch;
}): Promise<BoundedContract | "CONTRACT_DRAFT_INVALID"> {
  const chosen = options.providers.find(({ provider }) =>
    options.selection.mode === "specific" ? options.selection.provider === provider : true,
  );
  if (!chosen) throw new DraftProviderUnavailableError();

  try {
    const models = await listProviderModels(chosen.provider, chosen.credential, options.fetcher);
    const modelIds = pickModels(chosen.provider, models, options.selection);
    const userMessage = buildDraftUserMessage(options.request);

    for (const [index, modelId] of modelIds.entries()) {
      try {
        const raw = await completeOnce(
          chosen.provider,
          chosen.credential,
          modelId,
          userMessage,
          options.fetcher,
        );
        const parsed = parseContractDraft(raw);
        return parsed.ok ? parsed.contract : "CONTRACT_DRAFT_INVALID";
      } catch (error) {
        const hasAnotherAutomaticModel =
          options.selection.mode === "automatic" && index < modelIds.length - 1;
        if (error instanceof ProviderUnavailableError && hasAnotherAutomaticModel) continue;
        throw error;
      }
    }
    throw new ProviderResponseError();
  } catch (error) {
    if (error instanceof ProviderAuthorizationError) throw new AuthRejected(chosen.provider);
    throw error;
  }
}

async function completeOnce(
  provider: ProviderKind,
  credential: string,
  modelId: string,
  userMessage: string,
  fetcher: typeof fetch,
): Promise<string> {
  const url =
    provider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.anthropic.com/v1/messages";
  const headers =
    provider === "openai"
      ? { authorization: `Bearer ${credential}`, "content-type": "application/json" }
      : {
          "x-api-key": credential,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        };
  const body =
    provider === "openai"
      ? {
          model: modelId,
          messages: [
            { role: "system", content: drafterInstruction },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
        }
      : {
          model: modelId,
          max_tokens: 1024,
          system: drafterInstruction,
          messages: [{ role: "user", content: userMessage }],
        };

  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ProviderUnavailableError();
  }
  if (response.status === 401 || response.status === 403) throw new AuthRejected(provider);
  if (!response.ok) throw new ProviderUnavailableError();

  if (provider === "openai") {
    const parsed = openAIChatSchema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) throw new ProviderResponseError();
    return parsed.data.choices[0]!.message.content ?? "";
  }
  const parsed = anthropicMessageSchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new ProviderResponseError();
  return parsed.data.content
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("");
}

export class AuthRejected extends Error {
  readonly code = "PROVIDER_AUTHORIZATION_REJECTED";
  readonly provider: ProviderKind;
  constructor(provider: ProviderKind) {
    super("PROVIDER_AUTHORIZATION_REJECTED");
    this.name = "AuthRejected";
    this.provider = provider;
  }
}
