import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import Database from "better-sqlite3";

import { sharedUtteranceVerdictSchema, type VerdictRow } from "@cuckcode/contracts";

import type { TranscriptEntry } from "./provider-chat.js";

export type ExecutionStatus =
  "queued" | "working" | "waiting-on-you" | "done" | "failed" | "interrupted";
export type ProposalStatus = "pending" | "approved" | "applied" | "denied" | "stale";

export type ExecutionRecord = {
  id: string;
  draftId: string;
  revision: number;
  attempt: number;
  restartedFrom: string | null;
  status: ExecutionStatus;
  turnCount: number;
  maxTurns: number;
  transcript: TranscriptEntry[];
  createdAt: string;
  updatedAt: string;
  output: string | null;
  error: string | null;
  /** R4: what the latest pass ran on — the ChatGPT plan or a pasted key's provider. */
  fundedBy: FundedBy | null;
};

export type FundedBy = "chatgpt_plan" | "openai" | "anthropic";

export type ProposalRecord = {
  id: string;
  executionId: string;
  tool: string;
  args: Record<string, unknown>;
  status: ProposalStatus;
  createdAt: string;
  decidedAt: string | null;
};

export type AuditRecord = {
  executionId: string;
  ts: string;
  tool: string;
  argsRedacted: string;
  resultSummary: string;
  proposalId: string | null;
};

/** W12 precedent: ten turns per run, recorded on each row. */
export const DEFAULT_MAX_TURNS = 10;

// Migration 1 of executions.sqlite (PRAGMA user_version = 1). A new file: nothing in R1/R2 changes.
const EXECUTION_SCHEMA_V1 = `
  CREATE TABLE IF NOT EXISTS work_executions (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    attempt INTEGER NOT NULL CHECK (attempt >= 1),
    restarted_from TEXT REFERENCES work_executions(id),
    status TEXT NOT NULL CHECK (status IN
      ('queued', 'working', 'waiting-on-you', 'done', 'failed', 'interrupted')),
    turn_count INTEGER NOT NULL CHECK (turn_count >= 0),
    max_turns INTEGER NOT NULL CHECK (max_turns >= 1),
    transcript_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    output TEXT,
    error TEXT,
    UNIQUE (draft_id, revision, attempt)
  );
  CREATE TABLE IF NOT EXISTS tool_proposals (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES work_executions(id),
    tool TEXT NOT NULL,
    args_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'applied', 'denied', 'stale')),
    created_at TEXT NOT NULL,
    decided_at TEXT
  );
  CREATE INDEX IF NOT EXISTS tool_proposals_execution ON tool_proposals(execution_id, created_at);
  CREATE TABLE IF NOT EXISTS tool_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL REFERENCES work_executions(id),
    ts TEXT NOT NULL,
    tool TEXT NOT NULL,
    args_redacted TEXT NOT NULL,
    result_summary TEXT NOT NULL,
    proposal_id TEXT REFERENCES tool_proposals(id)
  );
  CREATE INDEX IF NOT EXISTS tool_audit_execution ON tool_audit(execution_id, id);
`;

// Migration 2 (R4, PRAGMA user_version = 2): lamp verdicts, a projection. They live here and not in
// a jsonl file because Railway's filesystem is ephemeral; the volume holds this database. row_json
// is B's shared verdict row unchanged (sharedUtteranceVerdictSchema). latency_ms is telemetry kept
// beside the row, and owner_choice is the owner's dismiss/engage signal on the cue.
const EXECUTION_SCHEMA_V2 = `
  CREATE TABLE IF NOT EXISTS lamp_verdicts (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES work_executions(id),
    turn_index INTEGER NOT NULL CHECK (turn_index >= 1),
    verdict TEXT NOT NULL CHECK (verdict IN ('lamp', 'no-lamp')),
    verdict_ts TEXT NOT NULL,
    row_json TEXT NOT NULL,
    latency_ms REAL NOT NULL CHECK (latency_ms >= 0),
    owner_choice TEXT CHECK (owner_choice IS NULL OR owner_choice IN ('dismissed', 'engaged')),
    choice_ts TEXT
  );
  CREATE INDEX IF NOT EXISTS lamp_verdicts_execution ON lamp_verdicts(execution_id, turn_index);
`;

export type LampVerdictRecord = {
  executionId: string;
  row: VerdictRow;
  latencyMs: number;
  ownerChoice: "dismissed" | "engaged" | null;
  choiceTs: string | null;
};

/** Statuses a run can be closed from. `done` is written by close() and by nothing else. */
const CLOSABLE: readonly ExecutionStatus[] = [
  "queued",
  "working",
  "waiting-on-you",
  "interrupted",
  "failed",
];

type ExecutionRow = {
  id: string;
  draft_id: string;
  revision: number;
  attempt: number;
  restarted_from: string | null;
  status: ExecutionStatus;
  turn_count: number;
  max_turns: number;
  transcript_json: string;
  created_at: string;
  updated_at: string;
  output: string | null;
  error: string | null;
  funded_by?: FundedBy | null;
};

type ProposalRow = {
  id: string;
  execution_id: string;
  tool: string;
  args_json: string;
  status: ProposalStatus;
  created_at: string;
  decided_at: string | null;
};

const toExecution = (row: ExecutionRow): ExecutionRecord => ({
  id: row.id,
  draftId: row.draft_id,
  revision: row.revision,
  attempt: row.attempt,
  restartedFrom: row.restarted_from,
  status: row.status,
  turnCount: row.turn_count,
  maxTurns: row.max_turns,
  transcript: JSON.parse(row.transcript_json) as TranscriptEntry[],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  output: row.output,
  error: row.error,
  fundedBy: row.funded_by ?? null,
});

const toProposal = (row: ProposalRow): ProposalRecord => ({
  id: row.id,
  executionId: row.execution_id,
  tool: row.tool,
  args: JSON.parse(row.args_json) as Record<string, unknown>,
  status: row.status,
  createdAt: row.created_at,
  decidedAt: row.decided_at,
});

export type TurnCommit = Readonly<{
  transcript: TranscriptEntry[];
  turnCount: number;
  status: ExecutionStatus;
  output?: string | null;
  error?: string | null;
  proposal?: Readonly<{ id: string; tool: string; args: Record<string, unknown> }>;
}>;

export function openExecutionStore(options: { dataDir: string }) {
  if (!isAbsolute(options.dataDir)) throw new Error("EXECUTION_DATA_DIR_MUST_BE_ABSOLUTE");
  const dataDir = resolve(options.dataDir);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const databasePath = join(dataDir, "executions.sqlite");
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.transaction(() => {
    database.exec(EXECUTION_SCHEMA_V1);
    database.exec(EXECUTION_SCHEMA_V2);
    const columns = database.prepare("PRAGMA table_info(work_executions)").all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === "funded_by")) {
      database.exec("ALTER TABLE work_executions ADD COLUMN funded_by TEXT");
    }
    if ((database.pragma("user_version", { simple: true }) as number) < 2) {
      database.pragma("user_version = 2");
    }
  })();
  if (process.platform !== "win32") chmodSync(databasePath, 0o700);

  const selectExecution = database.prepare("SELECT * FROM work_executions WHERE id = ?");
  const get = (id: string): ExecutionRecord | undefined => {
    const row = selectExecution.get(id) as ExecutionRow | undefined;
    return row ? toExecution(row) : undefined;
  };
  const latestForDraft = (draftId: string): ExecutionRecord | undefined => {
    const row = database
      .prepare(
        "SELECT * FROM work_executions WHERE draft_id = ? ORDER BY revision DESC, attempt DESC LIMIT 1",
      )
      .get(draftId) as ExecutionRow | undefined;
    return row ? toExecution(row) : undefined;
  };

  return {
    get,
    latestForDraft,
    list(): ExecutionRecord[] {
      return (
        database
          .prepare("SELECT * FROM work_executions ORDER BY created_at DESC, attempt DESC")
          .all() as ExecutionRow[]
      ).map(toExecution);
    },
    /** Idempotent per draft revision: a second call returns the first attempt instead of a new one. */
    enqueue(input: {
      draftId: string;
      revision: number;
      maxTurns: number;
      transcript: TranscriptEntry[];
      now: string;
    }): ExecutionRecord {
      return database.transaction(() => {
        database
          .prepare(
            `INSERT OR IGNORE INTO work_executions
              (id, draft_id, revision, attempt, restarted_from, status, turn_count, max_turns,
               transcript_json, created_at, updated_at, output, error)
             VALUES (?, ?, ?, 1, NULL, 'queued', 0, ?, ?, ?, ?, NULL, NULL)`,
          )
          .run(
            `exec_${randomUUID()}`,
            input.draftId,
            input.revision,
            input.maxTurns,
            JSON.stringify(input.transcript),
            input.now,
            input.now,
          );
        const row = database
          .prepare(
            "SELECT * FROM work_executions WHERE draft_id = ? AND revision = ? AND attempt = 1",
          )
          .get(input.draftId, input.revision) as ExecutionRow;
        return toExecution(row);
      })();
    },
    /**
     * A new attempt linked to `previous`, carrying its transcript as context. Only the latest
     * attempt of a draft revision, and only once it has stopped (interrupted or failed) or been
     * closed (done: R4 "pick it up again", so a closed run still has an action).
     */
    restart(
      previousId: string,
      build: (previous: ExecutionRecord) => { transcript: TranscriptEntry[]; maxTurns: number },
      now: string,
    ): ExecutionRecord | "NOT_FOUND" | "NOT_RESTARTABLE" {
      return database.transaction(() => {
        const previous = get(previousId);
        if (!previous) return "NOT_FOUND" as const;
        const latest = latestForDraft(previous.draftId);
        if (
          latest?.id !== previous.id ||
          (previous.status !== "interrupted" &&
            previous.status !== "failed" &&
            previous.status !== "done")
        ) {
          return "NOT_RESTARTABLE" as const;
        }
        const next = build(previous);
        const id = `exec_${randomUUID()}`;
        database
          .prepare(
            `INSERT INTO work_executions
              (id, draft_id, revision, attempt, restarted_from, status, turn_count, max_turns,
               transcript_json, created_at, updated_at, output, error)
             VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, NULL, NULL)`,
          )
          .run(
            id,
            previous.draftId,
            previous.revision,
            previous.attempt + 1,
            previous.id,
            next.maxTurns,
            JSON.stringify(next.transcript),
            now,
            now,
          );
        return get(id)!;
      })();
    },
    nextQueued(): ExecutionRecord | undefined {
      const row = database
        .prepare(
          "SELECT * FROM work_executions WHERE status = 'queued' ORDER BY updated_at, created_at LIMIT 1",
        )
        .get() as ExecutionRow | undefined;
      return row ? toExecution(row) : undefined;
    },
    claim(id: string, now: string): boolean {
      return (
        database
          .prepare(
            "UPDATE work_executions SET status = 'working', updated_at = ? WHERE id = ? AND status = 'queued'",
          )
          .run(now, id).changes === 1
      );
    },
    setFundedBy(id: string, fundedBy: FundedBy): void {
      database.prepare("UPDATE work_executions SET funded_by = ? WHERE id = ?").run(fundedBy, id);
    },
    /**
     * One turn's state, written atomically: transcript, counters, status, and any new proposal.
     * Only a run that is still working is written; false means the owner closed it mid-turn, and
     * nothing (not even the proposal) is recorded.
     */
    commitTurn(id: string, commit: TurnCommit, now: string): boolean {
      return database.transaction(() => {
        const updated = database
          .prepare(
            `UPDATE work_executions SET transcript_json = ?, turn_count = ?, status = ?,
               output = COALESCE(?, output), error = ?, updated_at = ?
             WHERE id = ? AND status = 'working'`,
          )
          .run(
            JSON.stringify(commit.transcript),
            commit.turnCount,
            commit.status,
            commit.output ?? null,
            commit.error ?? null,
            now,
            id,
          ).changes;
        if (updated !== 1) return false;
        if (commit.proposal) {
          database
            .prepare(
              "INSERT INTO tool_proposals (id, execution_id, tool, args_json, status, created_at, decided_at) VALUES (?, ?, ?, ?, 'pending', ?, NULL)",
            )
            .run(
              commit.proposal.id,
              id,
              commit.proposal.tool,
              JSON.stringify(commit.proposal.args),
              now,
            );
        }
        return true;
      })();
    },
    /** The loop's stop/park writes. Never `done`, and never over a run the owner already closed. */
    setStatus(
      id: string,
      status: Exclude<ExecutionStatus, "done">,
      error: string | null,
      now: string,
      output?: string,
    ): void {
      database
        .prepare(
          `UPDATE work_executions SET status = ?, error = ?, output = COALESCE(?, output),
             updated_at = ? WHERE id = ? AND status != 'done'`,
        )
        .run(status, error, output ?? null, now, id);
    },
    /**
     * Reply-and-resume (R4): the owner's message joins the transcript and the run re-queues, within
     * the turns it has left. Only for a run waiting on the owner with no pending proposal (a
     * proposal is answered with approve/deny instead).
     */
    reply(
      id: string,
      message: string,
      now: string,
    ): "OK" | "NOT_FOUND" | "NOT_WAITING" | "PROPOSAL_PENDING" | "NO_TURNS_LEFT" {
      return database.transaction(() => {
        const execution = get(id);
        if (!execution) return "NOT_FOUND" as const;
        if (execution.status !== "waiting-on-you") return "NOT_WAITING" as const;
        const pending = database
          .prepare(
            "SELECT COUNT(*) AS n FROM tool_proposals WHERE execution_id = ? AND status IN ('pending', 'approved')",
          )
          .get(id) as { n: number };
        if (pending.n > 0) return "PROPOSAL_PENDING" as const;
        if (execution.turnCount >= execution.maxTurns) return "NO_TURNS_LEFT" as const;
        const transcript: TranscriptEntry[] = [
          ...execution.transcript,
          { role: "user", content: message },
        ];
        database
          .prepare(
            "UPDATE work_executions SET status = 'queued', transcript_json = ?, error = NULL, updated_at = ? WHERE id = ? AND status = 'waiting-on-you'",
          )
          .run(JSON.stringify(transcript), now, id);
        return "OK" as const;
      })();
    },
    /**
     * Close-as-done (R4): the only writer of `done`. A pending proposal is not sent: it is marked
     * denied in the same transaction. A working run is stopped at its next turn boundary, because
     * commitTurn refuses to write over a closed run.
     */
    closeRun(
      id: string,
      now: string,
    ): { result: "OK"; withdrawn: ProposalRecord[] } | { result: "NOT_FOUND" | "NOT_CLOSABLE" } {
      return database.transaction(() => {
        const execution = get(id);
        if (!execution) return { result: "NOT_FOUND" as const };
        if (!CLOSABLE.includes(execution.status)) return { result: "NOT_CLOSABLE" as const };
        const withdrawn = (
          database
            .prepare(
              "SELECT * FROM tool_proposals WHERE execution_id = ? AND status IN ('pending', 'approved') ORDER BY created_at, id",
            )
            .all(id) as ProposalRow[]
        ).map(toProposal);
        database
          .prepare(
            "UPDATE tool_proposals SET status = 'denied', decided_at = ? WHERE execution_id = ? AND status IN ('pending', 'approved')",
          )
          .run(now, id);
        database
          .prepare(
            "UPDATE work_executions SET status = 'done', error = NULL, updated_at = ? WHERE id = ?",
          )
          .run(now, id);
        return { result: "OK" as const, withdrawn };
      })();
    },
    /** Projection write: one verdict per utterance id (a duplicate observation is ignored). */
    insertVerdict(executionId: string, row: VerdictRow, latencyMs: number): boolean {
      const parsed = sharedUtteranceVerdictSchema.parse(row);
      return (
        database
          .prepare(
            `INSERT OR IGNORE INTO lamp_verdicts
              (id, execution_id, turn_index, verdict, verdict_ts, row_json, latency_ms, owner_choice, choice_ts)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
          )
          .run(
            parsed.id,
            executionId,
            parsed.turnIndex,
            parsed.verdict,
            parsed.verdictTs,
            JSON.stringify(parsed),
            latencyMs,
          ).changes === 1
      );
    },
    listVerdicts(executionId?: string): LampVerdictRecord[] {
      const rows = (
        executionId
          ? database
              .prepare("SELECT * FROM lamp_verdicts WHERE execution_id = ? ORDER BY turn_index, id")
              .all(executionId)
          : database.prepare("SELECT * FROM lamp_verdicts ORDER BY verdict_ts, id").all()
      ) as {
        execution_id: string;
        row_json: string;
        latency_ms: number;
        owner_choice: "dismissed" | "engaged" | null;
        choice_ts: string | null;
      }[];
      return rows.map((row) => ({
        executionId: row.execution_id,
        row: sharedUtteranceVerdictSchema.parse(JSON.parse(row.row_json)),
        latencyMs: row.latency_ms,
        ownerChoice: row.owner_choice,
        choiceTs: row.choice_ts,
      }));
    },
    /** The owner's signal on a lamp cue ("Draw the curtain" = dismissed). Logged, never enforced. */
    recordVerdictChoice(
      verdictId: string,
      choice: "dismissed" | "engaged",
      now: string,
    ): string | undefined {
      const row = database
        .prepare("SELECT execution_id FROM lamp_verdicts WHERE id = ?")
        .get(verdictId) as { execution_id: string } | undefined;
      if (!row) return undefined;
      database
        .prepare("UPDATE lamp_verdicts SET owner_choice = ?, choice_ts = ? WHERE id = ?")
        .run(choice, now, verdictId);
      return row.execution_id;
    },
    /** Boot recovery: nothing is mid-turn after a restart, and nothing resumes on its own. */
    interruptUnfinished(error: string, now: string): number {
      return database
        .prepare(
          "UPDATE work_executions SET status = 'interrupted', error = ?, updated_at = ? WHERE status IN ('queued', 'working')",
        )
        .run(error, now).changes;
    },
    getProposal(id: string): ProposalRecord | undefined {
      const row = database.prepare("SELECT * FROM tool_proposals WHERE id = ?").get(id) as
        ProposalRow | undefined;
      return row ? toProposal(row) : undefined;
    },
    listProposals(executionId: string): ProposalRecord[] {
      return (
        database
          .prepare("SELECT * FROM tool_proposals WHERE execution_id = ? ORDER BY created_at, id")
          .all(executionId) as ProposalRow[]
      ).map(toProposal);
    },
    /**
     * The owner's decision on a pending proposal of a waiting execution. Atomically marks the
     * proposal, applies `updateTranscript`, and re-queues the execution so the loop resumes.
     */
    decideProposal(
      executionId: string,
      proposalId: string,
      decision: "approved" | "denied",
      updateTranscript: (transcript: TranscriptEntry[]) => TranscriptEntry[],
      now: string,
    ): "OK" | "NOT_FOUND" | "NOT_PENDING" {
      return database.transaction(() => {
        const execution = get(executionId);
        const proposalRow = database
          .prepare("SELECT * FROM tool_proposals WHERE id = ? AND execution_id = ?")
          .get(proposalId, executionId) as ProposalRow | undefined;
        if (!execution || !proposalRow) return "NOT_FOUND" as const;
        if (proposalRow.status !== "pending" || execution.status !== "waiting-on-you") {
          return "NOT_PENDING" as const;
        }
        database
          .prepare("UPDATE tool_proposals SET status = ?, decided_at = ? WHERE id = ?")
          .run(decision, now, proposalId);
        database
          .prepare(
            "UPDATE work_executions SET status = 'queued', transcript_json = ?, error = NULL, updated_at = ? WHERE id = ?",
          )
          .run(JSON.stringify(updateTranscript(execution.transcript)), now, executionId);
        return "OK" as const;
      })();
    },
    setProposalStatus(id: string, status: ProposalStatus, now: string): void {
      database
        .prepare("UPDATE tool_proposals SET status = ?, decided_at = ? WHERE id = ?")
        .run(status, now, id);
    },
    audit(entry: AuditRecord): void {
      database
        .prepare(
          "INSERT INTO tool_audit (execution_id, ts, tool, args_redacted, result_summary, proposal_id) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          entry.executionId,
          entry.ts,
          entry.tool,
          entry.argsRedacted,
          entry.resultSummary,
          entry.proposalId,
        );
    },
    listAudit(executionId: string): AuditRecord[] {
      return (
        database
          .prepare(
            "SELECT execution_id, ts, tool, args_redacted, result_summary, proposal_id FROM tool_audit WHERE execution_id = ? ORDER BY id",
          )
          .all(executionId) as {
          execution_id: string;
          ts: string;
          tool: string;
          args_redacted: string;
          result_summary: string;
          proposal_id: string | null;
        }[]
      ).map((row) => ({
        executionId: row.execution_id,
        ts: row.ts,
        tool: row.tool,
        argsRedacted: row.args_redacted,
        resultSummary: row.result_summary,
        proposalId: row.proposal_id,
      }));
    },
    close(): void {
      database.close();
    },
  };
}

export type ExecutionStore = ReturnType<typeof openExecutionStore>;
