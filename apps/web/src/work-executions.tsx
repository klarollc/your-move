import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import "./work-creation.css";
import "./work-executions.css";
import "./your-move-revision.css";
import {
  buildQueuePage,
  buildStreetPage,
  filterOwnerActionItems,
  getOwnerAction,
  QUEUE_PAGE_SIZE,
  sortOwnerActionItems,
  type OwnerAction,
  type OwnerActionCandidate,
  type OwnerActionFilter,
} from "./owner-action-queue.js";

// The townhouse is a redundant view of recorded owner actions. The paper queue remains the source
// of truth; a classifier verdict or execution state alone never lights a window.

export type ExecutionStatus =
  "queued" | "working" | "waiting-on-you" | "done" | "failed" | "interrupted";

export type ExecutionProposalView = {
  id: string;
  tool: string;
  status: "pending" | "approved" | "applied" | "denied" | "stale";
  createdAt?: string;
  change: { repo: string; path: string; message: string; content: string };
};

export type LampVerdictView = {
  utteranceId: string;
  turnIndex: number;
  verdict: "lamp" | "no-lamp";
  verdictTs: string;
  ownerChoice: "dismissed" | "engaged" | null;
};

export type ExecutionConversationView = {
  role: "agent" | "owner";
  text: string;
  turnIndex?: number;
};

export type ExecutionView = {
  id: string;
  status: ExecutionStatus;
  attempt: number;
  turnCount: number;
  maxTurns: number;
  createdAt?: string;
  updatedAt?: string;
  output: string | null;
  error: string | null;
  proposals: ExecutionProposalView[];
  /** R4: what the run is running on. */
  fundedBy?: "chatgpt_plan" | "openai" | "anthropic" | null;
  /** R4: the run's non-empty agent messages, by turn index (the lamp join). */
  utterances?: { turnIndex: number; text: string }[];
  /** Owner-facing transcript projection; owner replies are tagged before provider serialization. */
  conversation?: ExecutionConversationView[];
  /** R4: lamp verdicts for this run, textless. */
  lampVerdicts?: LampVerdictView[];
};

type ApprovedDraft = {
  id: string;
  status: "draft" | "approved";
  updatedAt?: string;
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

/** A window is lit only when the record contains an unresolved owner action. */
export function windowLight(execution: ExecutionView | null | undefined): "lit" | "dark" {
  return getOwnerAction({ id: "window", title: "", execution: execution ?? null }) ? "lit" : "dark";
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

type WaitingWork = OwnerActionCandidate & {
  draft: ApprovedDraft;
  action: OwnerAction;
};

function ownerActionCandidate(draft: ApprovedDraft): OwnerActionCandidate {
  return { id: draft.id, title: draft.prose.achieve, execution: draft.execution ?? null };
}

function waitingWork(drafts: readonly ApprovedDraft[]): WaitingWork[] {
  return sortOwnerActionItems(
    drafts.flatMap((draft) => {
      const candidate = ownerActionCandidate(draft);
      const action = getOwnerAction(candidate);
      return action ? [{ ...candidate, draft, action }] : [];
    }),
  );
}

function requestTimeLabel(value: string | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function streetRange(page: number, total: number, start: number, end: number, pageCount: number) {
  return total === 0
    ? ""
    : `Windows ${start}–${end} of ${total} · Street page ${page + 1} of ${pageCount}`;
}

function queueRange(start: number, end: number, total: number, filtered: boolean) {
  if (total === 0) return filtered ? "0 matching work items" : "";
  const range = `Rows ${start}–${end} of ${total}`;
  return filtered
    ? `${range} · ${total} matching ${total === 1 ? "work item" : "work items"}`
    : range;
}

function TownshipHouse({
  index,
  items,
  selected,
  statusUnavailable,
  open,
}: Readonly<{
  index: number;
  items: WaitingWork[];
  selected: string | undefined;
  statusUnavailable: boolean;
  open: (item: WaitingWork, origin: SVGElement) => void;
}>) {
  const positions = [
    { x: 36, y: 78 },
    { x: 132, y: 78 },
    { x: 36, y: 148 },
    { x: 132, y: 148 },
    { x: 36, y: 218 },
  ];
  return (
    <article className="ym3__house" aria-label={`House ${index + 1}`}>
      <svg
        className="ym3__facade"
        viewBox="0 0 216 300"
        role="group"
        aria-label={`House ${index + 1}`}
      >
        <path className="ym3__chimney" d="M164 12h18v42h-18z M160 10h26v7h-26z" />
        <path className="ym3__roof" d="M8 64 108 10l100 54-5 8-95-51L13 72z" />
        <rect className="ym3__cornice" x="12" y="68" width="192" height="8" />
        <rect className="ym3__wall" x="20" y="76" width="176" height="206" />
        <path
          className="ym3__masonry"
          d="M20 126h176M20 196h176M20 266h176M55 76v8m70-8v8M100 126v8m70-8v8M45 196v8m84-8v8M82 266v8m88-8v8"
        />
        {positions.map((position, slot) => {
          const item = items[slot];
          const title = item?.title ?? "Unused capacity";
          const className = [
            "ym3__window",
            item
              ? statusUnavailable
                ? "ym3__window--unknown"
                : "ym3__window--lit"
              : "ym3__window--unused",
            item && selected === item.id ? "ym3__window--selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const requestLabel = item
            ? statusUnavailable
              ? `${title} — status unavailable; last confirmed action: ${item.action.label}`
              : `${title} — ${item.action.label}`
            : undefined;
          const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
            if (!item || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            open(item, event.currentTarget);
          };
          return (
            <g
              key={item?.id ?? `unused-${slot}`}
              className={className}
              data-testid="street-window"
              data-work-id={item?.id}
              role={item ? "button" : undefined}
              tabIndex={item ? 0 : undefined}
              aria-label={requestLabel}
              aria-hidden={item ? undefined : true}
              aria-expanded={item ? selected === item.id : undefined}
              aria-controls={item ? "work-detail" : undefined}
              onClick={item ? (event) => open(item, event.currentTarget) : undefined}
              onKeyDown={onKeyDown}
            >
              <rect
                className="ym3__window-frame"
                x={position.x}
                y={position.y}
                width="44"
                height="48"
                rx="1"
              />
              <rect
                className="ym3__window-pane"
                x={position.x + 5}
                y={position.y + 5}
                width="34"
                height="38"
              />
              <path
                className="ym3__mullion"
                d={`M${position.x + 22} ${position.y + 5}v38 M${position.x + 5} ${position.y + 24}h34`}
              />
              <path className="ym3__sill" d={`M${position.x - 4} ${position.y + 50}h52`} />
            </g>
          );
        })}
        <path className="ym3__door-frame" d="M112 282v-48q0-10 10-10h32q10 0 10 10v48z" />
        <path className="ym3__door" d="M118 282v-45q0-7 7-7h26q7 0 7 7v45z" />
        <circle className="ym3__door-knob" cx="147" cy="260" r="2" />
        <path className="ym3__step" d="M106 282h64v7h-64z M99 289h78v7h-78z M8 298h200" />
        <path
          className="ym3__railing"
          d="M18 281h80m-75 0v-16m16 16v-16m16 16v-16m16 16v-16m16 16v-16m-67 0h72"
        />
      </svg>
      <div className="ym3__house-label">
        <h3>House {index + 1}</h3>
        <p>
          {items.length} {items.length === 1 ? "owner action" : "owner actions"}
        </p>
      </div>
    </article>
  );
}

export function WorkExecutions({
  signedIn,
  surfaceActive = true,
  refreshKey = 0,
  fetcher = globalThis.fetch,
  openFeed = openLampFeed,
}: Readonly<{
  signedIn: boolean;
  surfaceActive?: boolean;
  refreshKey?: number;
  fetcher?: typeof fetch;
  openFeed?: OpenFeed;
}>) {
  const [items, setItems] = useState<ApprovedDraft[] | undefined>();
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | undefined>();
  const [allWorkView, setAllWorkView] = useState(false);
  const [asList, setAsList] = useState(false);
  const [streetPage, setStreetPage] = useState(0);
  const [queuePage, setQueuePage] = useState(0);
  const [allWorkPage, setAllWorkPage] = useState(0);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<OwnerActionFilter>("all");
  const [entryMotionDone, setEntryMotionDone] = useState(false);
  const entryMotionStarted = useRef(false);
  const origin = useRef<SVGElement | HTMLButtonElement | null>(null);
  const queueHeading = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    try {
      const { ok, body } = await call<{ drafts?: ApprovedDraft[] }>(fetcher, "/api/work-drafts");
      if (!ok || !Array.isArray(body?.drafts)) {
        setStatusUnavailable(true);
        return;
      }
      setItems(body.drafts.filter((draft) => draft.status === "approved"));
      setStatusUnavailable(false);
    } catch {
      setStatusUnavailable(true);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!signedIn) {
      setItems(undefined);
      setStatusUnavailable(false);
      setSelected(undefined);
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

  useEffect(() => {
    if (!signedIn || entryMotionStarted.current) return;
    entryMotionStarted.current = true;
    const timer = window.setTimeout(() => setEntryMotionDone(true), 260);
    return () => window.clearTimeout(timer);
  }, [signedIn]);

  useEffect(() => {
    if (signedIn && !surfaceActive) setEntryMotionDone(true);
  }, [signedIn, surfaceActive]);

  const current = items?.find((item) => item.id === selected);

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

  const approved = items ?? [];
  const waiting = waitingWork(approved);
  const street = buildStreetPage(waiting, streetPage);
  const filtered = filterOwnerActionItems(waiting, { query, kind: actionFilter });
  const queue = buildQueuePage(filtered, queuePage);
  const allWorkPageCount = Math.ceil(approved.length / QUEUE_PAGE_SIZE);
  const visibleAllWorkPage = Math.max(0, Math.min(allWorkPage, Math.max(0, allWorkPageCount - 1)));
  const allWorkItems = approved.slice(
    visibleAllWorkPage * QUEUE_PAGE_SIZE,
    (visibleAllWorkPage + 1) * QUEUE_PAGE_SIZE,
  );
  const allWorkStart = approved.length === 0 ? 0 : visibleAllWorkPage * QUEUE_PAGE_SIZE + 1;
  const allWorkEnd = Math.min((visibleAllWorkPage + 1) * QUEUE_PAGE_SIZE, approved.length);
  const currentAction = current ? getOwnerAction(ownerActionCandidate(current)) : undefined;

  useEffect(() => {
    if (streetPage !== street.page) setStreetPage(street.page);
  }, [street.page, streetPage]);
  useEffect(() => {
    if (queuePage !== queue.page) setQueuePage(queue.page);
  }, [queue.page, queuePage]);
  useEffect(() => {
    if (allWorkPage !== visibleAllWorkPage) setAllWorkPage(visibleAllWorkPage);
  }, [allWorkPage, visibleAllWorkPage]);

  if (!signedIn || (!items && !statusUnavailable)) return null;

  const open = (item: { id: string }, target: SVGElement | HTMLButtonElement) => {
    origin.current = target;
    setSelected(item.id);
  };
  const foldBack = () => {
    setSelected(undefined);
    const selectedIndex = filtered.findIndex((item) => item.id === selected);
    if (selectedIndex >= 0 && asList) setQueuePage(Math.floor(selectedIndex / 10));
    const target = origin.current;
    if (target?.isConnected) target.focus();
    else queueHeading.current?.focus();
  };

  return (
    <section
      className={`your-move ym3${entryMotionDone ? " ym3--entered" : ""}`}
      aria-labelledby="ym3-title"
    >
      <header className="ym3__header">
        <div>
          <p className="ym3__eyebrow">Work</p>
          <h1 id="ym3-title">Your Move</h1>
          <p className="ym3__global-count">
            {statusUnavailable
              ? items
                ? `Status unavailable; last confirmed: ${waiting.length} ${waiting.length === 1 ? "needed" : "needed"} you.`
                : "Status unavailable"
              : `${waiting.length} ${waiting.length === 1 ? "needs" : "need"} you`}
          </p>
        </div>
        <div className="ym3__header-navigation">
          <nav className="ym3__collection-switch" aria-label="Work collection">
            <button
              type="button"
              aria-pressed={!allWorkView}
              onClick={() => {
                setEntryMotionDone(true);
                setAllWorkView(false);
                setSelected(undefined);
              }}
            >
              Waiting work
            </button>
            <button
              type="button"
              aria-pressed={allWorkView}
              onClick={() => {
                setEntryMotionDone(true);
                setAllWorkView(true);
                setSelected(undefined);
                setAllWorkPage(0);
              }}
            >
              All work &amp; history
            </button>
          </nav>
          {!allWorkView ? (
            <div className="ym3__view-switch" aria-label="Waiting work view">
              <button
                type="button"
                aria-pressed={!asList}
                onClick={() => {
                  setEntryMotionDone(true);
                  setAsList(false);
                }}
              >
                Street
              </button>
              <button
                type="button"
                aria-pressed={asList}
                onClick={() => {
                  setEntryMotionDone(true);
                  setAsList(true);
                }}
              >
                List
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {statusUnavailable ? (
        <p className="ym3__visually-hidden" role="status">
          Status unavailable. {items ? `Last confirmed: ${waiting.length} needed you.` : ""}
        </p>
      ) : null}

      <div className={`ym3__workspace${current ? " ym3__workspace--open" : ""}`}>
        <div className="ym3__primary-column">
          <section
            className="ym3__street-section"
            aria-labelledby="street-title"
            hidden={asList || allWorkView}
          >
            <div className="ym3__section-heading">
              <div>
                <h2 id="street-title">Street</h2>
                <p>
                  {statusUnavailable
                    ? "Status unavailable"
                    : waiting.length === 0
                      ? "Nothing needs you"
                      : `${waiting.length} waiting items`}
                </p>
              </div>
              {street.total > 15 ? (
                <div className="ym3__pager">
                  <span>
                    {streetRange(
                      street.page,
                      street.total,
                      street.start,
                      street.end,
                      street.pageCount,
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={street.page === 0}
                    onClick={() => setStreetPage(street.page - 1)}
                  >
                    Previous houses
                  </button>
                  <button
                    type="button"
                    disabled={street.page + 1 >= street.pageCount}
                    onClick={() => setStreetPage(street.page + 1)}
                  >
                    Next houses
                  </button>
                </div>
              ) : null}
            </div>
            <div className="ym3__street" role="list" aria-label="The street">
              {street.houses.map((house, index) => (
                <div className="ym3__street-item" role="listitem" key={`${street.page}-${index}`}>
                  <TownshipHouse
                    index={street.page * 3 + index}
                    items={house}
                    selected={selected}
                    statusUnavailable={statusUnavailable}
                    open={open}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="ym3__queue" aria-labelledby="queue-title" hidden={allWorkView}>
            <header className="ym3__queue-header">
              <div>
                <h2 ref={queueHeading} id="queue-title" tabIndex={-1}>
                  Waiting work
                </h2>
                <p className="ym3__range">
                  {queueRange(
                    queue.start,
                    queue.end,
                    queue.total,
                    Boolean(query.trim()) || actionFilter !== "all",
                  )}
                </p>
              </div>
              <div className="ym3__filters">
                <label>
                  <span>Search waiting work</span>
                  <input
                    type="search"
                    aria-label="Search waiting work"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.currentTarget.value);
                      setQueuePage(0);
                    }}
                  />
                </label>
                <label>
                  <span>Filter by action</span>
                  <select
                    aria-label="Filter by action"
                    value={actionFilter}
                    onChange={(event) => {
                      setActionFilter(event.currentTarget.value as OwnerActionFilter);
                      setQueuePage(0);
                    }}
                  >
                    <option value="all">All actions</option>
                    <option value="proposal">Review a proposed change</option>
                    <option value="reply">Reply to the agent</option>
                    <option value="close">Close finished work</option>
                    <option value="restart">Restart or close work</option>
                  </select>
                </label>
              </div>
            </header>

            {waiting.length === 0 ? (
              <p className="ym3__empty">
                {statusUnavailable
                  ? "Status unavailable"
                  : items
                    ? "Nothing needs you"
                    : "Waiting work has not loaded."}
              </p>
            ) : queue.total === 0 ? (
              <div className="ym3__empty">
                <p>No matching work</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActionFilter("all");
                    setQueuePage(0);
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="ym3__table-wrap">
                <table className="ym3__table">
                  <thead>
                    <tr>
                      <th scope="col">Work</th>
                      <th scope="col">Action needed</th>
                      <th scope="col">Waiting since</th>
                      <th scope="col">
                        <span className="ym3__visually-hidden">Open work</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.items.map((item) => (
                      <tr
                        key={item.id}
                        className={selected === item.id ? "ym3__row--selected" : undefined}
                      >
                        <th scope="row">{item.title}</th>
                        <td>{item.action.label}</td>
                        <td>
                          {item.action.requestedAt &&
                          Number.isFinite(Date.parse(item.action.requestedAt)) ? (
                            <time dateTime={item.action.requestedAt}>
                              Waiting since {requestTimeLabel(item.action.requestedAt)}
                            </time>
                          ) : (
                            "Time unavailable"
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            aria-label={`Open ${item.title}`}
                            aria-expanded={selected === item.id}
                            aria-controls="work-detail"
                            onClick={(event) => open(item, event.currentTarget)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {queue.pageCount > 1 ? (
              <footer className="ym3__queue-pager">
                <span>
                  {queueRange(
                    queue.start,
                    queue.end,
                    queue.total,
                    Boolean(query.trim()) || actionFilter !== "all",
                  )}
                </span>
                <button
                  type="button"
                  disabled={queue.page === 0}
                  onClick={() => setQueuePage(queue.page - 1)}
                >
                  Previous queue page
                </button>
                <button
                  type="button"
                  disabled={queue.page + 1 >= queue.pageCount}
                  onClick={() => setQueuePage(queue.page + 1)}
                >
                  Next queue page
                </button>
              </footer>
            ) : null}
          </section>

          <section
            className="ym3__queue ym3__history"
            aria-labelledby="all-work-title"
            hidden={!allWorkView}
          >
            <header className="ym3__queue-header">
              <div>
                <h2 id="all-work-title">All work &amp; history</h2>
                <p className="ym3__range">
                  {queueRange(allWorkStart, allWorkEnd, approved.length, false)}
                </p>
              </div>
            </header>
            {approved.length === 0 ? (
              <p className="ym3__empty">No approved work yet.</p>
            ) : (
              <div className="ym3__table-wrap">
                <table className="ym3__table">
                  <thead>
                    <tr>
                      <th scope="col">Work</th>
                      <th scope="col">Status</th>
                      <th scope="col">Updated</th>
                      <th scope="col">
                        <span className="ym3__visually-hidden">Open work</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allWorkItems.map((draft) => {
                      const updatedAt = draft.execution?.updatedAt ?? draft.updatedAt;
                      return (
                        <tr
                          key={draft.id}
                          className={selected === draft.id ? "ym3__row--selected" : undefined}
                        >
                          <th scope="row">{draft.prose.achieve}</th>
                          <td>{executionStatusLine(draft.execution ?? null)}</td>
                          <td>
                            {updatedAt && Number.isFinite(Date.parse(updatedAt)) ? (
                              <time dateTime={updatedAt}>{requestTimeLabel(updatedAt)}</time>
                            ) : (
                              "Time unavailable"
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              aria-label={`Open ${draft.prose.achieve}`}
                              aria-expanded={selected === draft.id}
                              aria-controls="work-detail"
                              onClick={(event) => open(draft, event.currentTarget)}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {allWorkPageCount > 1 ? (
              <footer className="ym3__queue-pager">
                <span>{queueRange(allWorkStart, allWorkEnd, approved.length, false)}</span>
                <button
                  type="button"
                  disabled={visibleAllWorkPage === 0}
                  onClick={() => setAllWorkPage(visibleAllWorkPage - 1)}
                >
                  Previous history page
                </button>
                <button
                  type="button"
                  disabled={visibleAllWorkPage + 1 >= allWorkPageCount}
                  onClick={() => setAllWorkPage(visibleAllWorkPage + 1)}
                >
                  Next history page
                </button>
              </footer>
            ) : null}
          </section>
        </div>

        {current ? (
          <WorkPanel
            key={current.id}
            item={current}
            ownerAction={currentAction}
            backLabel={allWorkView ? "← Back to all work & history" : "← Back to waiting work"}
            busy={busy}
            act={act}
            onFold={foldBack}
            fetcher={fetcher}
            reload={load}
          />
        ) : null}
      </div>
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
  ownerAction,
  backLabel,
  busy,
  act,
  onFold,
  fetcher,
  reload,
}: Readonly<{
  item: ApprovedDraft;
  ownerAction: OwnerAction | undefined;
  backLabel: string;
  busy: boolean;
  act: (url: string, body?: object) => Promise<boolean>;
  onFold: () => void;
  fetcher: typeof fetch;
  reload: () => Promise<void>;
}>) {
  const execution = item.execution ?? null;
  const actions = availableActions(execution);
  const pending = execution?.proposals.filter(({ status }) => status === "pending") ?? [];
  const [reply, setReply] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const base = execution ? `/api/work-executions/${encodeURIComponent(execution.id)}` : "";
  const planLimit = execution?.error === "PLAN_USAGE_LIMIT_REACHED";
  const transcript = execution?.conversation?.length
    ? execution.conversation
    : (execution?.utterances?.map((utterance) => ({
        role: "agent" as const,
        turnIndex: utterance.turnIndex,
        text: utterance.text,
      })) ?? []);
  const conversation =
    !planLimit &&
    execution?.output &&
    !transcript.some((entry) => entry.role === "agent" && entry.text === execution.output)
      ? [
          ...transcript,
          { role: "agent" as const, turnIndex: execution.turnCount, text: execution.output },
        ]
      : transcript;
  const verdictByTurn = new Map(
    (execution?.lampVerdicts ?? []).map((verdict) => [verdict.turnIndex, verdict] as const),
  );
  const transcriptTurns = new Set(
    conversation.flatMap((entry) =>
      entry.role === "agent" && entry.turnIndex !== undefined ? [entry.turnIndex] : [],
    ),
  );
  const unmatchedVerdicts = (execution?.lampVerdicts ?? []).filter(
    (verdict) => !transcriptTurns.has(verdict.turnIndex),
  );
  const utteranceByTurn = new Map(
    (execution?.utterances ?? []).map(
      (utterance) => [utterance.turnIndex, utterance.text] as const,
    ),
  );
  const [cueError, setCueError] = useState("");
  const [cueBusy, setCueBusy] = useState(false);

  useLayoutEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await act(`${base}/reply`, { message: reply })) setReply("");
  }

  async function chooseCue(utteranceId: string, choice: "engaged" | "dismissed") {
    setCueError("");
    setCueBusy(true);
    try {
      const result = await call(
        fetcher,
        `/api/lamp-verdicts/${encodeURIComponent(utteranceId)}/choice`,
        {
          method: "POST",
          body: JSON.stringify({ choice }),
        },
      );
      if (!result.ok) setCueError("Couldn't update this lamp cue. Try again.");
    } catch {
      setCueError("Couldn't update this lamp cue. Try again.");
    } finally {
      await reload();
      setCueBusy(false);
    }
  }

  function cueChoices(verdict: LampVerdictView) {
    if (verdict.verdict !== "lamp") return null;
    return (
      <>
        {verdict.ownerChoice === "engaged" ? <p role="status">Marked as seen.</p> : null}
        {verdict.ownerChoice === "dismissed" ? <p role="status">Curtain drawn.</p> : null}
        {verdict.ownerChoice === null ? (
          <button
            type="button"
            className="your-move__link"
            disabled={cueBusy}
            onClick={() => void chooseCue(verdict.utteranceId, "engaged")}
          >
            Mark as seen
          </button>
        ) : null}
        {verdict.ownerChoice !== "dismissed" ? (
          <button
            type="button"
            className="your-move__link"
            disabled={cueBusy}
            onClick={() => void chooseCue(verdict.utteranceId, "dismissed")}
          >
            Draw the curtain
          </button>
        ) : null}
      </>
    );
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
    <section className="your-move__panel" id="work-detail" aria-labelledby={`panel-${item.id}`}>
      <button type="button" className="your-move__back" onClick={onFold}>
        {backLabel}
      </button>
      <div className="ym3__request" aria-label="Recorded owner action">
        <p>{ownerAction?.label ?? "No owner action is pending"}</p>
        <span>
          {ownerAction?.requestedAt && Number.isFinite(Date.parse(ownerAction.requestedAt))
            ? `Waiting since ${requestTimeLabel(ownerAction.requestedAt)}`
            : "Time unavailable"}
        </span>
      </div>
      <p className="your-move__panel-kicker" role="status">
        {executionStatusLine(execution)}
      </p>
      <h3 ref={titleRef} tabIndex={-1} id={`panel-${item.id}`} className="your-move__panel-title">
        {item.prose.achieve}
      </h3>

      {conversation.length > 0 ? (
        <div className="ym3__conversation" role="group" aria-label="Work conversation">
          {conversation.map((entry, index) => {
            if (entry.role === "owner") {
              return (
                <div
                  key={`owner-${index}`}
                  className="your-move__said ym3__owner-reply"
                  role="group"
                  aria-label="Your reply"
                >
                  <p className="your-move__said-label">You replied</p>
                  <blockquote className="your-move__words">{entry.text}</blockquote>
                </div>
              );
            }

            const verdict =
              entry.turnIndex === undefined ? undefined : verdictByTurn.get(entry.turnIndex);
            const verdictLabel = verdict?.verdict === "lamp" ? "Lamp verdict" : "No lamp signal";
            return (
              <div key={`agent-${entry.turnIndex ?? index}`} className="ym3__conversation-entry">
                <div className="your-move__said" role="group" aria-label="Agent message">
                  <p className="your-move__said-label">The agent says</p>
                  <blockquote className="your-move__words">{entry.text}</blockquote>
                </div>
                {verdict ? (
                  <div
                    className={`ym3__verdict ym3__verdict--${verdict.verdict}`}
                    role="group"
                    aria-label={verdictLabel}
                  >
                    <p className="ym3__verdict-label">{verdictLabel}</p>
                    <time dateTime={verdict.verdictTs}>{requestTimeLabel(verdict.verdictTs)}</time>
                    {cueChoices(verdict)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {unmatchedVerdicts.length > 0 ? (
        <div className="ym3__conversation" role="group" aria-label="Additional lamp verdicts">
          {unmatchedVerdicts.map((verdict) => {
            const label = verdict.verdict === "lamp" ? "Lamp verdict" : "No lamp signal";
            return (
              <div
                key={`unmatched-${verdict.utteranceId}`}
                className="ym3__conversation-entry"
                role="group"
                aria-label="Unmatched lamp verdict"
              >
                <div
                  className="your-move__said"
                  role="group"
                  aria-label="Agent message unavailable"
                >
                  <p className="your-move__said-label">Agent utterance</p>
                  <blockquote className="your-move__words">
                    {utteranceByTurn.get(verdict.turnIndex) ??
                      "The utterance is no longer available in the run."}
                  </blockquote>
                </div>
                <div
                  className={`ym3__verdict ym3__verdict--${verdict.verdict}`}
                  role="group"
                  aria-label={label}
                >
                  <p className="ym3__verdict-label">
                    {label} · Turn {verdict.turnIndex}
                  </p>
                  <time dateTime={verdict.verdictTs}>{requestTimeLabel(verdict.verdictTs)}</time>
                  {cueChoices(verdict)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {cueError ? <p role="alert">{cueError}</p> : null}

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
