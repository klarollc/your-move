import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import "./work-creation.css";
import "./work-executions.css";

// The triage surface (R4 Track E): the first surface in the Lit Windows identity, with the Paper
// Boats unfold. Approved work is a street: each piece of work is a window. Windows that need the
// owner glow periwinkle on the ground floor by the door; working windows are a muted oat light;
// finished work is dark, up top. The your-move moment unfolds the work itself in a panel beside the
// street — never a modal. "See it as a list" is the escape hatch. Status still polls every 2 s;
// lamp verdicts arrive live over /api/events and trigger a refresh (the feed carries no text: the
// cue's words are joined from the run's own transcript).

export type ExecutionStatus =
  "queued" | "working" | "waiting-on-you" | "done" | "failed" | "interrupted";

export type ExecutionProposalView = {
  id: string;
  tool: string;
  status: "pending" | "approved" | "applied" | "denied" | "stale";
  change: { repo: string; path: string; message: string; content: string };
};

export type LampVerdictView = {
  utteranceId: string;
  turnIndex: number;
  verdict: "lamp" | "no-lamp";
  verdictTs: string;
  ownerChoice: "dismissed" | "engaged" | null;
};

export type ExecutionView = {
  id: string;
  status: ExecutionStatus;
  attempt: number;
  turnCount: number;
  maxTurns: number;
  output: string | null;
  error: string | null;
  proposals: ExecutionProposalView[];
  /** R4: what the run is running on. */
  fundedBy?: "chatgpt_plan" | "openai" | "anthropic" | null;
  /** R4: the run's non-empty agent messages, by turn index (the lamp join). */
  utterances?: { turnIndex: number; text: string }[];
  /** R4: lamp verdicts for this run, textless. */
  lampVerdicts?: LampVerdictView[];
};

type ApprovedDraft = {
  id: string;
  status: "draft" | "approved";
  prose: { achieve: string };
  execution?: ExecutionView | null;
};

/** What approval arms. Shown before the owner confirms, and on the start button for older work. */
export const APPROVAL_CONSENT =
  "Approving gives the agent web research + repo read access. File changes always need your go-ahead.";
/** Stated on every approval screen (locked rule). */
export const NOTHING_GOES_OUT = "Nothing goes out until you say so.";
/** OpenAI's "Manage usage" destination and in-use label (SIWC UI guidelines). */
export const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";
export const PLAN_IN_USE_LABEL = "Using ChatGPT plan";

const stopReasons: Record<string, string> = {
  PROVIDER_DISCONNECTED: "the provider was disconnected",
  PROVIDER_REAUTH_REQUIRED: "the provider connection needs renewing",
  PROVIDER_UNAVAILABLE: "the provider could not be reached",
  PROVIDER_RESPONSE_INVALID: "the provider sent a reply that could not be used",
  SERVER_RESTARTED: "the service restarted",
  SERVER_SHUTDOWN: "the service was stopping",
  WORK_DRAFT_NOT_FOUND: "its approved work could not be found",
  EXECUTION_INTERNAL_ERROR: "something went wrong in the service",
};

/** One plain-language line for where a run stands. */
export function executionStatusLine(execution: ExecutionView | null | undefined): string {
  if (!execution) return "Not started.";
  const reason = (execution.error && stopReasons[execution.error]) || "it stopped unexpectedly";
  switch (execution.status) {
    case "queued":
      return "Queued — the agent starts shortly.";
    case "working":
      return `Working — turn ${Math.min(execution.turnCount + 1, execution.maxTurns)} of ${execution.maxTurns}.`;
    case "waiting-on-you":
      if (execution.error === "PLAN_USAGE_LIMIT_REACHED") {
        return "Waiting on you — the ChatGPT plan's limit for Your Move was reached.";
      }
      return execution.proposals.some(({ status }) => status === "pending")
        ? "Waiting on you — the agent proposes a file change."
        : "Waiting on you — the agent has replied.";
    case "done":
      return "Done.";
    case "failed":
      return execution.error === "TURN_BUDGET_EXHAUSTED"
        ? `Stopped — it used all ${execution.maxTurns} turns without finishing.`
        : `Stopped — ${reason}.`;
    case "interrupted":
      return `Paused — ${reason}. Restart it when you are ready.`;
  }
}

export type TriageAction = "start" | "approve" | "deny" | "reply" | "restart" | "close";

/**
 * Every action the owner has on a run. The R4 invariant: never empty, in any status. The server
 * enforces the same transitions (execution-store.ts reply/closeRun/restart, decideProposal).
 */
export function availableActions(execution: ExecutionView | null | undefined): TriageAction[] {
  if (!execution) return ["start"];
  switch (execution.status) {
    case "queued":
    case "working":
      return ["close"];
    case "waiting-on-you":
      if (execution.proposals.some(({ status }) => status === "pending")) {
        return ["approve", "deny", "close"];
      }
      return execution.turnCount < execution.maxTurns ? ["reply", "close"] : ["close"];
    case "interrupted":
    case "failed":
      return ["restart", "close"];
    case "done":
      return ["restart"];
  }
}

/** The verdict's turn index, parsed from its utteranceId (utterance_<executionId>_<turn>_1). */
export function turnFromUtteranceId(executionId: string, utteranceId: string): number | undefined {
  const prefix = `utterance_${executionId}_`;
  if (!utteranceId.startsWith(prefix) || !utteranceId.endsWith("_1")) return undefined;
  const turn = Number(utteranceId.slice(prefix.length, -2));
  return Number.isInteger(turn) && turn >= 1 ? turn : undefined;
}

/** Lamp cues still open on a run: lit verdicts the owner has not drawn the curtain on. */
export function openLampCues(execution: ExecutionView | null | undefined): LampVerdictView[] {
  return (execution?.lampVerdicts ?? []).filter(
    (verdict) => verdict.verdict === "lamp" && verdict.ownerChoice !== "dismissed",
  );
}

type Light = "lit" | "working" | "dark";

/** Periwinkle ("lit") belongs only to work that needs the owner. */
export function windowLight(execution: ExecutionView | null | undefined): Light {
  if (!execution) return "lit";
  if (
    execution.status === "waiting-on-you" ||
    execution.status === "interrupted" ||
    execution.status === "failed"
  ) {
    return "lit";
  }
  if (execution.status === "done") return "dark";
  return openLampCues(execution).length > 0 ? "lit" : "working";
}

async function call<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; body: T | undefined }> {
  const response = await fetcher(url, {
    ...init,
    credentials: "same-origin",
    // Only declare a JSON body when there is one. Fastify rejects an empty body that claims JSON.
    headers:
      init.body === undefined
        ? (init.headers ?? {})
        : { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await response.json().catch(() => undefined)) as T | undefined;
  return { ok: response.ok, body };
}

export type OpenFeed = (onVerdict: () => void) => () => void;

/** The hosted live verdict feed. Reconnects while mounted; any lamp.verdict triggers a refresh. */
export const openLampFeed: OpenFeed = (onVerdict) => {
  if (typeof window === "undefined" || typeof WebSocket === "undefined") return () => undefined;
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")) {
    return () => undefined;
  }
  const url = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/events`;
  let socket: WebSocket | undefined;
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const connect = () => {
    try {
      socket = new WebSocket(url);
    } catch {
      return;
    }
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type?: unknown };
        if (message.type === "lamp.verdict") onVerdict();
      } catch {
        // Not a verdict.
      }
    });
    socket.addEventListener("close", () => {
      if (!stopped) retry = setTimeout(connect, 5_000);
    });
  };
  connect();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    socket?.close();
  };
};

const ACTIVE: ReadonlySet<ExecutionStatus> = new Set(["queued", "working"]);
const POLL_MS = 2_000;
/** Crowd rule (locked): 30 works across 6 houses. */
const WINDOWS_PER_HOUSE = 6;
const MAX_HOUSES = 6;
const LIGHT_ORDER: Record<Light, number> = { lit: 0, working: 1, dark: 2 };
/** Among lit windows, the one waiting on a reply or a decision comes first, by the door. */
const litRank = (execution: ExecutionView | null | undefined): number =>
  !execution ? 1 : execution.status === "waiting-on-you" ? 0 : 2;

type House = { name: string; items: ApprovedDraft[] };

/** Ground floor first: lit windows by the door, then working light, finished work on top. */
export function buildStreet(items: readonly ApprovedDraft[]): {
  houses: House[];
  overflow: number;
} {
  const sorted = [...items].sort(
    (a, b) =>
      LIGHT_ORDER[windowLight(a.execution)] - LIGHT_ORDER[windowLight(b.execution)] ||
      (windowLight(a.execution) === "lit" ? litRank(a.execution) - litRank(b.execution) : 0),
  );
  const houses: House[] = [];
  for (
    let start = 0;
    start < sorted.length && houses.length < MAX_HOUSES;
    start += WINDOWS_PER_HOUSE
  ) {
    houses.push({
      // One kind of work for now: the brief has no grouping data yet (see the R4 done-report).
      name: houses.length === 0 ? "Your work" : "More of your work",
      items: sorted.slice(start, start + WINDOWS_PER_HOUSE),
    });
  }
  return { houses, overflow: Math.max(0, sorted.length - MAX_HOUSES * WINDOWS_PER_HOUSE) };
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
const NUMBERS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const spell = (count: number) => NUMBERS[count] ?? String(count);

export function WorkExecutions({
  signedIn,
  refreshKey = 0,
  fetcher = globalThis.fetch,
  openFeed = openLampFeed,
}: Readonly<{
  signedIn: boolean;
  refreshKey?: number;
  fetcher?: typeof fetch;
  openFeed?: OpenFeed;
}>) {
  const [items, setItems] = useState<ApprovedDraft[] | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | undefined>();
  const [folded, setFolded] = useState(false);
  const [asList, setAsList] = useState(false);
  const engaged = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const { ok, body } = await call<{ drafts?: ApprovedDraft[] }>(fetcher, "/api/work-drafts");
      if (!ok || !Array.isArray(body?.drafts)) return;
      setItems(body.drafts.filter((draft) => draft.status === "approved"));
    } catch {
      // Leave the list as it was; the next poll or action retries.
    }
  }, [fetcher]);

  useEffect(() => {
    if (!signedIn) {
      setItems(undefined);
      return;
    }
    void load();
  }, [signedIn, refreshKey, load]);

  const active = items?.some((item) => item.execution && ACTIVE.has(item.execution.status));
  useEffect(() => {
    if (!signedIn || !active) return;
    const timer = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(timer);
  }, [signedIn, active, items, load]);

  useEffect(() => {
    if (!signedIn) return;
    return openFeed(() => void load());
  }, [signedIn, openFeed, load]);

  // Curtains open on the work that needs the owner: the first lit window unfolds by itself, once.
  useEffect(() => {
    if (selected || folded || !items) return;
    const first = buildStreet(items).houses[0]?.items[0];
    if (first && windowLight(first.execution) === "lit") setSelected(first.id);
  }, [items, selected, folded]);

  const current = items?.find((item) => item.id === selected);

  // Opening a lamp cue is logged as "engaged" (signal only).
  useEffect(() => {
    const execution = current?.execution;
    if (!execution) return;
    for (const cue of openLampCues(execution)) {
      if (cue.ownerChoice || engaged.current.has(cue.utteranceId)) continue;
      engaged.current.add(cue.utteranceId);
      void call(fetcher, `/api/lamp-verdicts/${encodeURIComponent(cue.utteranceId)}/choice`, {
        method: "POST",
        body: JSON.stringify({ choice: "engaged" }),
      }).catch(() => undefined);
    }
  }, [current, fetcher]);

  async function act(url: string, body?: object): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const result = await call(fetcher, url, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!result.ok) setError("That did not go through. Refresh and try again.");
      return result.ok;
    } catch {
      setError("The service could not be reached. Try again.");
      return false;
    } finally {
      setBusy(false);
      await load();
    }
  }

  if (!signedIn || !items || items.length === 0) return null;

  const { houses, overflow } = buildStreet(items);
  const counts = { lit: 0, working: 0, dark: 0 };
  for (const item of items) counts[windowLight(item.execution)] += 1;
  const open = (id: string) => {
    setSelected(id);
    setFolded(false);
  };
  const foldBack = () => {
    setSelected(undefined);
    setFolded(true);
  };

  return (
    <section className="your-move" aria-labelledby="your-move-title">
      <div className="your-move__sky">
        <header className="your-move__top">
          <h2 id="your-move-title" className="your-move__brand">
            Your Move
          </h2>
          <p className="your-move__counts">
            {counts.lit} lit · {counts.working} working · {counts.dark} done
          </p>
          <button
            type="button"
            className="your-move__link"
            aria-pressed={asList}
            onClick={() => setAsList((value) => !value)}
          >
            {asList ? "See the street" : "See it as a list"}
          </button>
        </header>

        <div className={`your-move__scene${current ? " your-move__scene--open" : ""}`}>
          {asList ? (
            <ul className="your-move__list" aria-label="All approved work">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`your-move__row your-move__row--${windowLight(item.execution)}`}
                >
                  <button
                    type="button"
                    className="your-move__row-open"
                    aria-expanded={selected === item.id}
                    onClick={() => open(item.id)}
                  >
                    {item.prose.achieve}
                  </button>
                  <span className="your-move__row-status">
                    {executionStatusLine(item.execution)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="your-move__street" role="list" aria-label="The street">
              {houses.map((house, index) => {
                const lit = house.items.filter((item) => windowLight(item.execution) === "lit");
                const quiet = lit.length === 0;
                // Floors fill from the ground up: the first two windows sit by the door.
                const floors: ApprovedDraft[][] = [];
                for (let start = 0; start < house.items.length; start += 2) {
                  floors.push(house.items.slice(start, start + 2));
                }
                return (
                  <div
                    key={`${house.name}-${index}`}
                    role="listitem"
                    className={`your-move__house${quiet ? " your-move__house--quiet" : ""}`}
                  >
                    <div className="your-move__facade">
                      {floors.map((floor, floorIndex) => (
                        <div
                          key={floorIndex}
                          className={`your-move__floor${floorIndex === 0 ? " your-move__floor--ground" : ""}`}
                        >
                          {floor.map((item) => {
                            const light = windowLight(item.execution);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`your-move__window your-move__window--${light}${selected === item.id ? " your-move__window--open" : ""}`}
                                aria-label={`${item.prose.achieve} — ${light === "lit" ? "needs you" : light === "working" ? "working" : "done"}`}
                                aria-expanded={selected === item.id}
                                onClick={() => open(item.id)}
                              >
                                <span className="your-move__curtain your-move__curtain--left" />
                                <span className="your-move__curtain your-move__curtain--right" />
                              </button>
                            );
                          })}
                          {floorIndex === 0 ? (
                            <span className="your-move__door" aria-hidden="true" />
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="your-move__house-label">
                      <span className="your-move__house-name">{house.name}</span>
                      {lit.slice(0, 2).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="your-move__needs-you"
                          onClick={() => open(item.id)}
                        >
                          {item.prose.achieve} · needs you
                        </button>
                      ))}
                      <span className="your-move__house-counts">
                        {lit.length > 2
                          ? `${lit.length - 2} more ${lit.length - 2 === 1 ? "needs" : "need"} you · `
                          : ""}
                        {
                          house.items.filter((item) => windowLight(item.execution) === "working")
                            .length
                        }{" "}
                        working ·{" "}
                        {
                          house.items.filter((item) => windowLight(item.execution) === "dark")
                            .length
                        }{" "}
                        done
                      </span>
                    </div>
                  </div>
                );
              })}
              {overflow > 0 ? (
                <p className="your-move__overflow">{overflow} more are in the list.</p>
              ) : null}
            </div>
          )}

          {current ? (
            <WorkPanel
              key={current.id}
              item={current}
              busy={busy}
              act={act}
              onFold={foldBack}
              fetcher={fetcher}
              reload={load}
            />
          ) : null}
        </div>
      </div>

      <footer className="your-move__summary">
        <p className="your-move__headline">
          {counts.lit === 0
            ? "No window is lit."
            : `${spell(counts.lit)} ${plural(counts.lit, "window is", "windows are")} lit.`}
        </p>
        <p className="your-move__subline">
          {spell(counts.working)} {plural(counts.working, "is", "are")} working.{" "}
          {spell(counts.dark)} {plural(counts.dark, "is", "are")} done.
        </p>
      </footer>
      {error ? (
        <p role="alert" className="your-move__error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function WorkPanel({
  item,
  busy,
  act,
  onFold,
  fetcher,
  reload,
}: Readonly<{
  item: ApprovedDraft;
  busy: boolean;
  act: (url: string, body?: object) => Promise<boolean>;
  onFold: () => void;
  fetcher: typeof fetch;
  reload: () => Promise<void>;
}>) {
  const execution = item.execution ?? null;
  const actions = availableActions(execution);
  const pending = execution?.proposals.filter(({ status }) => status === "pending") ?? [];
  const cues = openLampCues(execution);
  const lit = windowLight(execution) === "lit";
  const [reply, setReply] = useState("");
  const base = execution ? `/api/work-executions/${encodeURIComponent(execution.id)}` : "";
  const planLimit = execution?.error === "PLAN_USAGE_LIMIT_REACHED";
  const showsOutput = Boolean(
    execution?.status === "waiting-on-you" && execution.output && !planLimit,
  );
  // The triage join: each textless verdict finds its words in the run's own transcript.
  const joined = cues.map((cue) => {
    const turn = execution ? turnFromUtteranceId(execution.id, cue.utteranceId) : undefined;
    return {
      cue,
      text: execution?.utterances?.find((utterance) => utterance.turnIndex === turn)?.text,
    };
  });

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await act(`${base}/reply`, { message: reply })) setReply("");
  }

  async function dismissCue(utteranceId: string) {
    try {
      await call(fetcher, `/api/lamp-verdicts/${encodeURIComponent(utteranceId)}/choice`, {
        method: "POST",
        body: JSON.stringify({ choice: "dismissed" }),
      });
    } finally {
      await reload();
    }
  }

  const curtain = (
    <button
      type="button"
      className="your-move__link"
      disabled={busy}
      onClick={() => void act(`${base}/close`)}
    >
      Draw the curtain
    </button>
  );

  return (
    <section
      className={`your-move__panel${lit ? " your-move__panel--lit" : ""}`}
      aria-labelledby={`panel-${item.id}`}
    >
      <button type="button" className="your-move__back" onClick={onFold}>
        ← The street
      </button>
      <p className="your-move__panel-kicker" role="status">
        {executionStatusLine(execution)}
      </p>
      <h3 id={`panel-${item.id}`} className="your-move__panel-title">
        {item.prose.achieve}
      </h3>

      {joined.map(({ cue, text }) => {
        if (showsOutput && text === execution?.output) return null;
        return (
          <div
            key={cue.utteranceId}
            className="your-move__cue"
            role="group"
            aria-label="The lamp lit"
          >
            <p className="your-move__cue-label">The lamp lit — this may need you</p>
            <blockquote className="your-move__words">
              {text ?? "The agent's words for this are no longer in the run."}
            </blockquote>
            <button
              type="button"
              className="your-move__link"
              onClick={() => void dismissCue(cue.utteranceId)}
            >
              Draw the curtain
            </button>
          </div>
        );
      })}

      {showsOutput ? (
        <div className="your-move__said">
          {/* When the lamp lit on this very message, say so here instead of repeating it. */}
          {joined.some(({ text }) => text === execution?.output) ? (
            <p className="your-move__cue-label">The agent says — the lamp lit</p>
          ) : (
            <p className="your-move__said-label">The agent says</p>
          )}
          <blockquote className="your-move__words">{execution?.output}</blockquote>
        </div>
      ) : null}

      {planLimit ? (
        <div
          className="your-move__plan-limit"
          role="group"
          aria-label="ChatGPT usage limit reached"
        >
          <p className="your-move__said-label">ChatGPT</p>
          <p>
            <strong>Usage limit reached.</strong> Review your plan or this app&apos;s limit in
            ChatGPT settings. Then send a reply to continue — or switch this work to your API key
            under Connections first.
          </p>
          <a
            className="your-move__primary"
            href={MANAGE_USAGE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Manage usage
          </a>
        </div>
      ) : null}

      {execution
        ? pending.map((proposal) => (
            <div
              key={proposal.id}
              className="your-move__proposal"
              role="group"
              aria-label={`Proposed change to ${proposal.change.path}`}
            >
              <p className="your-move__said-label">
                To {proposal.change.repo} · {proposal.change.path}
              </p>
              <p className="your-move__proposal-message">{proposal.change.message}</p>
              <pre className="your-move__content">{proposal.change.content}</pre>
              <div className="your-move__actions">
                <button
                  type="button"
                  className="your-move__primary"
                  disabled={busy}
                  onClick={() =>
                    void act(`${base}/proposals/${encodeURIComponent(proposal.id)}/approve`)
                  }
                >
                  Go ahead and send
                </button>
                <button
                  type="button"
                  className="your-move__secondary"
                  disabled={busy}
                  onClick={() =>
                    void act(`${base}/proposals/${encodeURIComponent(proposal.id)}/deny`)
                  }
                >
                  Don&apos;t send this
                </button>
                {curtain}
              </div>
              <p className="your-move__fineprint">
                {NOTHING_GOES_OUT} Drawing the curtain closes this work; the change is not sent.
              </p>
            </div>
          ))
        : null}

      {actions.includes("reply") ? (
        <form className="your-move__reply" onSubmit={(event) => void sendReply(event)}>
          <label htmlFor={`reply-${item.id}`}>Your reply</label>
          <textarea
            id={`reply-${item.id}`}
            rows={3}
            maxLength={4000}
            value={reply}
            disabled={busy}
            onChange={(event) => setReply(event.currentTarget.value)}
          />
          <div className="your-move__actions">
            <button
              type="submit"
              className="your-move__primary"
              disabled={busy || reply.trim().length === 0}
            >
              Send
            </button>
            {curtain}
          </div>
          <p className="your-move__fineprint">
            Your reply goes to the agent, which picks the work back up. Drawing the curtain closes
            it as done.
          </p>
        </form>
      ) : null}

      {actions.includes("start") ? (
        <div className="your-move__actions">
          <p className="your-move__fineprint">{APPROVAL_CONSENT}</p>
          <button
            type="button"
            className="your-move__primary"
            disabled={busy}
            onClick={() => void act("/api/work-executions", { draftId: item.id })}
          >
            Start this work
          </button>
        </div>
      ) : null}

      {actions.includes("restart") ? (
        <div className="your-move__actions">
          <button
            type="button"
            className="your-move__primary"
            disabled={busy}
            onClick={() => void act(`${base}/restart`)}
          >
            {execution?.status === "done" ? "Pick it up again" : "Restart"}
          </button>
          {actions.includes("close") ? curtain : null}
        </div>
      ) : null}

      {actions.length === 1 && actions[0] === "close" ? (
        <div className="your-move__actions">
          {curtain}
          <p className="your-move__fineprint">
            {execution?.status === "waiting-on-you"
              ? "It has used all its turns. Drawing the curtain closes it as done."
              : "Drawing the curtain stops it before its next step and closes it as done."}
          </p>
        </div>
      ) : null}

      {execution?.fundedBy ? (
        <p className="your-move__cost">
          {execution.fundedBy === "chatgpt_plan" ? (
            <>
              {PLAN_IN_USE_LABEL} ·{" "}
              <a href={MANAGE_USAGE_URL} target="_blank" rel="noreferrer">
                Manage usage
              </a>
            </>
          ) : (
            `On your ${execution.fundedBy === "openai" ? "OpenAI" : "Anthropic"} API key`
          )}
        </p>
      ) : null}
    </section>
  );
}
