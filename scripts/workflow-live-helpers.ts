/**
 * Pure helpers for the live workflow runner (workflow-proof W5, live runner).
 *
 * Everything here is testable without a Codex process: parsing `git status`, making the stream's
 * file paths comparable with the worktree's, checking the inlined context files against the digests
 * in the work contract, building the role's prompt from the contract, and enforcing the attempt
 * allowance and the adopted stop rule.
 */
import { createHash } from "node:crypto";

import type { WorkContract } from "@cuckcode/contracts";

import type { FileChangeRecord, PathApi } from "./tracer-guards.js";

const unquote = (path: string): string =>
  path.length >= 2 && path.startsWith('"') && path.endsWith('"')
    ? path.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\")
    : path;

/**
 * Paths named by `git status --porcelain --untracked-files=all`, sorted and unique, both sides of a
 * rename. Git also octal-escapes non-ASCII names inside quotes; those are returned as git wrote
 * them, so a path with such characters will not match the stream's and will show as a mismatch,
 * which fails safe.
 */
export function parsePorcelain(output: string): string[] {
  const paths = new Set<string>();
  for (const line of output.split("\n")) {
    if (line.trim().length === 0) continue;
    const rest = line.slice(3);
    const arrow = rest.indexOf(" -> ");
    if (arrow >= 0) {
      paths.add(unquote(rest.slice(0, arrow)));
      paths.add(unquote(rest.slice(arrow + 4)));
    } else {
      paths.add(unquote(rest));
    }
  }
  return [...paths].sort();
}

/** Worktree-relative, forward-slash paths for the file changes the stream reported. */
export function relativizeChanges(
  worktree: string,
  changes: readonly FileChangeRecord[],
  pathApi: PathApi,
): string[] {
  const root = pathApi.resolve(worktree);
  const rel = (path: string): string =>
    pathApi.relative(root, pathApi.resolve(root, path)).split(pathApi.sep).join("/");
  const paths = new Set<string>();
  for (const change of changes) {
    paths.add(rel(change.path));
    if (change.movePath) paths.add(rel(change.movePath));
  }
  return [...paths].sort();
}

export type ContextFile = Readonly<{ path: string; content: string }>;

const sha256 = (data: Buffer): string => createHash("sha256").update(data).digest("hex");

/** Reads each inlined file and refuses on any that is missing or whose digest has drifted. */
export function verifyContextFiles(
  refs: WorkContract["contextRefs"],
  read: (path: string) => Buffer | null,
):
  | Readonly<{ ok: true; files: readonly ContextFile[] }>
  | Readonly<{ ok: false; issues: string[] }> {
  const files: ContextFile[] = [];
  const issues: string[] = [];
  for (const ref of refs) {
    const bytes = read(ref.path);
    if (bytes === null) {
      issues.push(`${ref.path}: the file is missing`);
      continue;
    }
    const found = sha256(bytes);
    if (found !== ref.sha256) {
      issues.push(
        `${ref.path}: its digest differs from the contract (contract ${ref.sha256.slice(0, 12)}, found ${found.slice(0, 12)})`,
      );
      continue;
    }
    files.push({ path: ref.path, content: bytes.toString("utf8") });
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, files };
}

const bulletList = (items: readonly string[]): string =>
  items.length === 0 ? "(none)" : items.map((item) => `- ${item}`).join("\n");

/**
 * The role's instructions, built from the contract. It states the capability limits the feature
 * policy declares (edit only; no reading, no commands) and inlines every file the contract
 * references, because the role cannot open them (R-1).
 */
export function buildWorkflowPrompt(
  input: Readonly<{ contract: WorkContract; contextFiles: readonly ContextFile[]; marker: string }>,
): string {
  const { contract, contextFiles, marker } = input;
  return [
    "You are working on one bounded task in the current directory, a linked git worktree.",
    "",
    "What you can do: edit files inside this worktree. You cannot read files, you cannot run commands, and you have no network. Every file you need is included below; work only from what is shown.",
    "",
    `If anything in the task is ambiguous, or you lack information you need, do not guess. End your turn with a line starting exactly with "${marker} blocked" followed by one line stating your question.`,
    `When the task is finished, end your turn with a line starting exactly with "${marker} done" followed by a one-line summary. Your claim is checked against evidence the owner records; it does not by itself complete the work.`,
    "",
    "--- BOUNDED WORK CONTRACT ---",
    `Outcome: ${contract.outcome}`,
    "",
    "Exclusions (do not do these):",
    bulletList(contract.exclusions),
    "",
    "Acceptance criteria:",
    bulletList(contract.acceptanceCriteria),
    "",
    "Dependencies:",
    bulletList(contract.dependencies),
    "",
    "Evidence the owner will record:",
    bulletList(contract.evidenceObligations.map((o) => `${o.kind}: ${o.description}`)),
    "",
    "Stop conditions (stop and say so if any occurs):",
    bulletList(contract.stopConditions),
    "",
    `Definition of done: ${contract.definitionOfDone}`,
    "",
    "--- FILES (inlined; you cannot open them) ---",
    ...contextFiles.flatMap((file) => [`### ${file.path}`, "```", file.content, "```", ""]),
  ].join("\n");
}

export type AttemptLedgerEntry = Readonly<{
  runId: string;
  surface: string;
  workItemId: string;
  observedAt: string;
  turnsUsed: number;
  outcome: string;
  transcriptSha256: string | null;
}>;

export type AllowanceDecision =
  | Readonly<{ ok: true; turnsAvailable: number }>
  | Readonly<{ ok: false; code: "ALLOWANCE_EXHAUSTED" | "STOP_RULE"; detail: string }>;

const SUCCESS_OUTCOMES: readonly string[] = ["review_requested"];

/**
 * The attempt allowance for one surface, and the adopted stop rule: stop a surface's series after
 * two consecutive attempts that ended for the same recorded reason. Surfaces are counted apart.
 */
export function checkAllowance(
  entries: readonly AttemptLedgerEntry[],
  surface: string,
  limits: Readonly<{ maxAttempts: number; maxTurnsPerAttempt: number; turnCeiling: number }>,
): AllowanceDecision {
  const mine = entries.filter((entry) => entry.surface === surface);
  const last = mine[mine.length - 1];
  const before = mine[mine.length - 2];
  if (
    last !== undefined &&
    before !== undefined &&
    last.outcome === before.outcome &&
    !SUCCESS_OUTCOMES.includes(last.outcome)
  ) {
    return {
      ok: false,
      code: "STOP_RULE",
      detail: `the last two attempts on surface ${surface} both ended as ${last.outcome}; owner review is required before another`,
    };
  }
  const turnsUsed = mine.reduce((sum, entry) => sum + entry.turnsUsed, 0);
  if (mine.length >= limits.maxAttempts || turnsUsed >= limits.turnCeiling) {
    return {
      ok: false,
      code: "ALLOWANCE_EXHAUSTED",
      detail: `surface ${surface}: ${String(mine.length)}/${String(limits.maxAttempts)} attempts, ${String(turnsUsed)}/${String(limits.turnCeiling)} turns`,
    };
  }
  return {
    ok: true,
    turnsAvailable: Math.min(limits.maxTurnsPerAttempt, limits.turnCeiling - turnsUsed),
  };
}
