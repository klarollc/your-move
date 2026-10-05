import { useEffect, useRef, useState, type FormEvent } from "react";
import type { WorkContract } from "@cuckcode/contracts";

import "./work-list.css";

export type WorkListEvidence = Readonly<{
  kind: string;
  result: string;
  eventId: string;
  status: "checked" | "recorded" | "claimed";
  source: string | null;
  trust: string | null;
  sourceRevision: number | null;
  occurredAt: string | null;
  providerRunId: string | null;
  worktreeSha256: string | null;
  outputSha256: string | null;
}>;

export type WorkListAssignment = Readonly<{
  roleAssignmentId: string;
  label: string;
  sourceRevision: number | null;
  source: string | null;
  trust: string | null;
}>;

export type WorkListGroupKey = "your-move" | "in-progress" | "queued" | "done" | "other";

export type WorkListItem = Readonly<{
  workItemId: string;
  outcome: string;
  state: string;
  group: WorkListGroupKey;
  attentionReason: string | null;
  doneVerified: boolean;
  hasEvidenceFailure: boolean;
  condition: Readonly<{
    reasonCode: string;
    summary: string;
    waitingOn: Readonly<{ kind: string; id?: string }>;
    requestedAction: Readonly<{ kind: string; summary: string }> | null;
    source: string;
    trust: string;
    sourceRevision: number | null;
  }> | null;
  contract: WorkContract | null;
  contractRevision: number | null;
  contractHistory: readonly Readonly<{
    revision: number;
    eventId: string;
    contract: WorkContract;
  }>[];
  turnBudget: Readonly<{
    budgetRecorded: boolean;
    budgetRevision: number;
    baseMaxTurns: number | null;
    grantedTurns: number;
    effectiveMaxTurns: number | null;
    usedTurns: number | null;
    remainingTurns: number | null;
    exhausted: boolean | null;
    countComplete: boolean;
  }> | null;
  resurface: Readonly<{
    at: string;
    due: boolean | null;
    projectedAt: string | null;
    eventId: string;
    sourceRevision: number | null;
  }> | null;
  nudgeSuppression: Readonly<{
    disposition: "snooze" | "dismiss";
    until: string;
    eventId: string;
    sourceRevision: number | null;
  }> | null;
  nudgeSuppressed: boolean;
  nudges: readonly Readonly<{
    eventId: string;
    roleAssignmentId: string;
    note: string;
    recordedAt: string;
    sourceRevision: number | null;
  }>[];
  currentRulingId: string | null;
  rulings: readonly Readonly<{
    rulingId: string;
    decision: "accept" | "accept_with_exception" | "send_back" | "defer";
    recordedAt: string;
    withdrawn: boolean;
    eventId: string;
    sourceRevision: number | null;
    reason?: string;
    note?: string;
    resurfaceAt?: string;
  }>[];
  waitingMs: number | null;
  assignee: string | null;
  roleAssignmentId: string | null;
  assignmentSourceRevision: number | null;
  assignmentSource: string | null;
  assignmentTrust: string | null;
  partial: boolean;
  contractAcceptsEvidence: boolean;
  evidenceObligations: readonly Readonly<{ kind: string; description: string }>[];
  evidence: readonly WorkListEvidence[];
  postures: readonly Readonly<{
    runId: string;
    requested: string;
    granted: string;
    declared: string;
    match: boolean;
    eventId: string;
    source: string | null;
    trust: string | null;
    sourceRevision: number | null;
    providerRunId: string | null;
    worktreeSha256: string | null;
  }>[];
  sourceRevision: number | null;
  lastSignalRevision: number | null;
  lastEvent: string | null;
}>;

export type WorkListHealth = Readonly<{
  status: "current" | "stale" | "incomplete" | "damaged" | "disagreement";
  revision: number;
  projectedRevision: number;
  fetchedAt: string | null;
  ageMs: number | null;
  issueCount: number;
  issues: readonly string[];
}>;

export type WorkListLogEntry = Readonly<{
  eventId: string;
  kind: string;
  summary: string;
  source: string;
  trust: string;
  occurredAt: string;
  workItemId: string | null;
  revision: number;
}>;

export type WorkListJourney = Readonly<{
  id: number;
  workItemId: string;
  direction: "arrival" | "departure";
  tint: "plain" | "moss";
  title: string;
  from: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

export type WorkListRuling = Readonly<{
  decision: "accept" | "accept_with_exception" | "send_back" | "defer";
  reason?: string;
  note?: string;
  resurfaceAt?: string;
}>;

export type WorkListRunner = Readonly<{
  available: boolean;
  state:
    "unavailable" | "idle" | "starting" | "running" | "completed" | "failed" | "recovery_required";
  workItemId?: string;
}>;

export type SurfaceBCommandApi = Readonly<{
  onAssign: (workItemId: string, roleAssignmentId: string) => void | Promise<void>;
  onEvidence: (
    workItemId: string,
    input: {
      kind: string;
      result: "passed" | "failed";
      note?: string;
      outputSha256?: string;
    },
  ) => void | Promise<void>;
  onReview: (workItemId: string) => void | Promise<void>;
  onExecute: (workItemId: string) => void | Promise<void>;
  onRuling?: (workItemId: string, ruling: WorkListRuling) => void | Promise<void>;
  onGrantTurns?: (
    workItemId: string,
    turnsGranted: number,
    budgetRevision: number,
  ) => void | Promise<void>;
  onRescope?: (
    workItemId: string,
    expectedContractRevision: number,
    contract: WorkContract,
  ) => void | Promise<void>;
  onCloseIncomplete?: (workItemId: string, reason: string) => void | Promise<void>;
  onNudge?: (workItemId: string, roleAssignmentId: string, note: string) => void | Promise<void>;
  onSuppressNudge?: (workItemId: string, disposition: "snooze" | "dismiss") => void | Promise<void>;
  onWithdrawRuling?: (workItemId: string, rulingId: string) => void | Promise<void>;
}>;

type WorkListView = "today" | "new-work" | "log";
type GroupDefinition = Readonly<{
  key: WorkListGroupKey;
  title: string;
  rule: string;
}>;

const GROUPS: readonly GroupDefinition[] = [
  { key: "your-move", title: "Your move", rule: "longest waiting first" },
  { key: "in-progress", title: "In progress", rule: "most recent signal first" },
  { key: "queued", title: "Queued", rule: "oldest first" },
  { key: "done", title: "Done", rule: "most recently verified first" },
  { key: "other", title: "Other recorded states", rule: "event order" },
];

export function WorkList(
  props: Readonly<{
    projectId: string;
    projectName: string;
    revision: number;
    currentRevision: number;
    visitedRevision: number | null;
    onVisitRevision: (revision: number | null) => void;
    items: readonly WorkListItem[];
    assignments: readonly WorkListAssignment[];
    log: readonly WorkListLogEntry[];
    runner: WorkListRunner;
    connected?: boolean;
    actionsDisabled?: boolean;
    health?: WorkListHealth;
    onRefresh?: () => void | Promise<void>;
    error?: string | null;
    journey?: WorkListJourney | null;
    onCancelJourney?: () => void;
  }> &
    SurfaceBCommandApi,
) {
  const [view, setView] = useState<WorkListView>("today");
  const [showAllWork, setShowAllWork] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lens, setLens] = useState<"status" | "assignee">("status");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsedGroups);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [session, setSession] = useState<Readonly<{
    queue: readonly string[];
    cursor: number;
    skipped: readonly string[];
    startRevision: number;
  }> | null>(null);
  const [awayState, setAwayState] = useState<Readonly<{ baseline: number | null; open: boolean }>>({
    baseline: null,
    open: false,
  });
  const awayInitialized = useRef(false);
  const [ghostFlight, setGhostFlight] = useState<Readonly<{
    journeyId: number;
    transform: string;
    opacity: number;
  }> | null>(null);
  const flightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (awayInitialized.current || props.health?.status !== "current") return;
    awayInitialized.current = true;
    const storageKey = `your-move:last-seen-revision:${props.projectId}`;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === null) {
        window.localStorage.setItem(storageKey, String(props.currentRevision));
        setAwayState({ baseline: props.currentRevision, open: false });
      } else {
        const parsed = Number(stored);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > props.currentRevision) {
          window.localStorage.setItem(storageKey, String(props.currentRevision));
          setAwayState({ baseline: props.currentRevision, open: false });
          return;
        }
        setAwayState({
          baseline: parsed,
          open: props.currentRevision > parsed,
        });
      }
    } catch {
      // The digest is a convenience derived from the log; storage failure does not alter the read model.
    }
  }, [props.currentRevision, props.health?.status]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("your-move:collapsed-groups", JSON.stringify(collapsed));
    } catch {
      // Session storage is a presentation preference; the work projection does not depend on it.
    }
  }, [collapsed]);

  const attention = props.items.filter((item) => item.group === "your-move");
  const selectedItem = props.items.find((item) => item.workItemId === detailId) ?? null;
  const activeFilters = [
    search.trim() ? `search “${search.trim()}”` : "",
    assigneeFilter !== "all" ? `assignee ${assigneeFilter}` : "",
    statusFilter !== "all" ? `status ${humanState(statusFilter)}` : "",
  ].filter(Boolean);
  const hasFilters = activeFilters.length > 0;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = props.items.filter((item) => {
    const matchesSearch =
      !normalizedSearch ||
      `${item.outcome} ${item.workItemId} ${item.assignee ?? "Unassigned"} ${item.state}`
        .toLocaleLowerCase()
        .includes(normalizedSearch);
    const matchesAssignee =
      assigneeFilter === "all" || (item.assignee ?? "Unassigned") === assigneeFilter;
    const matchesStatus = statusFilter === "all" || item.state === statusFilter;
    return matchesSearch && matchesAssignee && matchesStatus;
  });
  const hasWork = props.items.length > 0;
  const currentRead = props.health?.status === "current";
  const freshEmpty =
    view === "today" && detailId === null && !hasWork && currentRead && !awayState.open;
  const allClear =
    view === "today" &&
    detailId === null &&
    lens === "status" &&
    hasWork &&
    attention.length === 0 &&
    !hasFilters &&
    !showAllWork &&
    currentRead &&
    !awayState.open;
  const calm = freshEmpty || allClear;
  const underwayCount = props.items.filter((item) => item.group === "in-progress").length;
  const assignees = [...new Set(props.items.map((item) => item.assignee ?? "Unassigned"))].sort(
    (left, right) => left.localeCompare(right),
  );
  const statuses = [...new Set(props.items.map((item) => item.state))].sort((a, b) =>
    a.localeCompare(b),
  );
  const actionsDisabled = props.actionsDisabled === true || pendingAction !== null;
  const stale = props.health?.status !== "current";
  const quietSuggestions = props.items.filter((item) => {
    if (
      item.group === "your-move" ||
      item.group === "done" ||
      item.nudgeSuppressed ||
      item.lastEvent === null
    )
      return false;
    const timestamp = Date.parse(item.lastEvent);
    return Number.isFinite(timestamp) && Date.now() - timestamp >= 3 * 24 * 60 * 60 * 1000;
  });
  const digestLog = props.log.filter((entry) => entry.revision <= props.revision);
  const awayBaseline = awayState.baseline;
  const awayEvents =
    awayBaseline === null ? [] : digestLog.filter((entry) => entry.revision > awayBaseline);

  useEffect(() => {
    setSession((current) => {
      if (!current) return current;
      const activeIds = new Set(attention.map((item) => item.workItemId));
      const queue = current.queue.filter((workItemId) => activeIds.has(workItemId));
      const known = new Set(queue);
      const arrivals = attention
        .map((item) => item.workItemId)
        .filter((workItemId) => !known.has(workItemId));
      const nextQueue = [...queue, ...arrivals];
      return nextQueue.length === current.queue.length &&
        nextQueue.every((id, index) => id === current.queue[index])
        ? current
        : { ...current, queue: nextQueue, cursor: 0 };
    });
  }, [attention]);

  const perform = async (label: string, action: () => void | Promise<void>): Promise<boolean> => {
    setPendingAction(label);
    setActionMessage("Recording…");
    try {
      await action();
      setActionMessage(
        label.startsWith("execute:")
          ? "Runner start accepted. Progress will appear only after the event log records it."
          : "The command receipt was read back from the event log.",
      );
      return true;
    } catch {
      setActionMessage(
        "The log has not confirmed this action. Check the read status before retrying.",
      );
      return false;
    } finally {
      setPendingAction(null);
    }
  };

  const navigate = (next: WorkListView) => {
    props.onCancelJourney?.();
    setView(next);
    setDetailId(null);
    if (next === "today") setShowAllWork(false);
    setActionMessage(null);
  };

  const openDetail = (workItemId: string) => {
    props.onCancelJourney?.();
    setDetailId(workItemId);
    setView("today");
    setShowAllWork(true);
    setActionMessage(null);
  };

  const startSession = () => {
    props.onCancelJourney?.();
    setSession({
      queue: attention.map((item) => item.workItemId),
      cursor: 0,
      skipped: [],
      startRevision: props.revision,
    });
    setDetailId(null);
    setActionMessage(null);
  };

  const dismissDigest = () => {
    try {
      window.localStorage.setItem(
        `your-move:last-seen-revision:${props.projectId}`,
        String(props.currentRevision),
      );
    } catch {
      // Dismissing a derived digest has no workflow effect.
    }
    setAwayState({ baseline: null, open: false });
  };

  const skipSessionMatter = () => {
    setSession((current) => {
      if (!current) return null;
      const workItemId = current.queue[current.cursor];
      if (!workItemId) return current;
      const queue = [
        ...current.queue.slice(0, current.cursor),
        ...current.queue.slice(current.cursor + 1),
        workItemId,
      ];
      return { ...current, queue, cursor: 0, skipped: [...current.skipped, workItemId] };
    });
  };

  useEffect(() => {
    const journey = props.journey;
    if (!journey) return;
    if (flightTimer.current) clearTimeout(flightTimer.current);
    if (prefersReducedMotion()) {
      props.onCancelJourney?.();
      return;
    }
    const target =
      journey.direction === "arrival"
        ? document.querySelector<HTMLElement>(`[data-work-item-id="${journey.workItemId}"]`)
        : document.querySelector<HTMLElement>(".workflow-master-lamp");
    if (!target) {
      props.onCancelJourney?.();
      return;
    }
    const rect = target.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - (journey.from.x + journey.from.width / 2);
    const dy = rect.top + rect.height / 2 - (journey.from.y + journey.from.height / 2);
    setGhostFlight({ journeyId: journey.id, transform: "translate(0, 0) scale(1)", opacity: 1 });
    requestAnimationFrame(() => {
      setGhostFlight({
        journeyId: journey.id,
        transform: `translate(${dx}px, ${dy}px) scale(.92)`,
        opacity: 0,
      });
    });
    flightTimer.current = setTimeout(() => {
      setGhostFlight(null);
      props.onCancelJourney?.();
    }, 550);
    return () => {
      if (flightTimer.current) clearTimeout(flightTimer.current);
    };
  }, [props.journey, props.onCancelJourney]);

  return (
    <main className="workflow-surface">
      <header className="workflow-header">
        <div className="workflow-brand">
          <span>Your Move</span>
          <span className="workflow-brand-project">{props.projectName}</span>
        </div>
        <div className="workflow-header-actions">
          <button
            className={`workflow-master-lamp${attention.length > 0 && !stale ? " is-lit" : ""}${stale ? " is-stale" : ""}${props.journey?.direction === "arrival" ? " is-pulsing" : ""}`}
            type="button"
            aria-label={
              stale
                ? `Your move: N? matters, log status ${props.health?.status ?? "unknown"}`
                : `Your move: ${attention.length} matters`
            }
            title="Your move"
            onClick={() => {
              setDetailId(null);
              setView("today");
              setShowAllWork(true);
            }}
          >
            <span className="workflow-lamp" aria-hidden="true" />
            {stale ? "N?" : attention.length}
          </button>
          <span className="workflow-asof">as of r{props.revision}</span>
          <button className="workflow-primary" onClick={() => navigate("new-work")} type="button">
            + New work
          </button>
        </div>
      </header>

      <PrimaryNavigation view={view} onNavigate={navigate} />

      {props.visitedRevision !== null ? (
        <section className="workflow-past-banner" role="status">
          <p>Viewing the past · r{props.visitedRevision}. You cannot rule on the past.</p>
          <button type="button" onClick={() => props.onVisitRevision(null)}>
            Return to present · r{props.currentRevision}
          </button>
        </section>
      ) : null}

      {props.health && props.health.status !== "current" ? (
        <ReadHealth
          health={props.health}
          {...(props.onRefresh ? { onRefresh: props.onRefresh } : {})}
        />
      ) : null}
      {props.error ? (
        <p className="workflow-error" role="alert">
          {props.error}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="workflow-notice" role="status">
          {actionMessage}
        </p>
      ) : null}

      {ghostFlight && props.journey?.id === ghostFlight.journeyId ? (
        <span
          className={`workflow-journey-ghost${props.journey.tint === "moss" ? " is-moss" : ""}`}
          aria-hidden="true"
          style={{
            left: props.journey.from.x,
            top: props.journey.from.y,
            width: props.journey.from.width,
            height: props.journey.from.height,
            transform: ghostFlight.transform,
            opacity: ghostFlight.opacity,
          }}
        >
          {props.journey.title}
        </span>
      ) : null}

      {calm ? (
        <CalmScreen
          fresh={freshEmpty}
          revision={props.revision}
          underwayCount={underwayCount}
          resurfaceDueCount={props.items.filter((item) => item.resurface?.due === true).length}
          actionsDisabled={actionsDisabled}
          onStart={() => navigate("new-work")}
          onShowAll={() => setShowAllWork(true)}
        />
      ) : (
        <div className="workflow-content">
          {session ? (
            <RulingSession
              session={session}
              items={props.items}
              log={props.log}
              revision={props.revision}
              onSkip={skipSessionMatter}
              onEnd={() => setSession(null)}
              commands={props}
              disabled={actionsDisabled}
              onAction={perform}
              onOpenDetail={(workItemId) => {
                setSession(null);
                openDetail(workItemId);
              }}
            />
          ) : (
            <section
              className="workflow-list-column"
              aria-label={
                detailId
                  ? "Work detail"
                  : view === "log"
                    ? "Event log"
                    : view === "new-work"
                      ? "New work"
                      : "Today’s work"
              }
            >
              {view === "new-work" ? <NewWorkUnavailable /> : null}
              {view === "log" ? (
                <LogView
                  entries={props.log}
                  currentRevision={props.currentRevision}
                  visitedRevision={props.visitedRevision}
                  onVisitRevision={(revision) => {
                    props.onCancelJourney?.();
                    props.onVisitRevision(revision);
                  }}
                  {...(props.health ? { health: props.health } : {})}
                />
              ) : null}
              {view === "today" && selectedItem ? (
                <WorkDetail
                  item={selectedItem}
                  log={props.log.filter(
                    (entry) =>
                      entry.workItemId === selectedItem.workItemId &&
                      entry.revision <= props.revision,
                  )}
                  revision={props.revision}
                  onBack={() => setDetailId(null)}
                  commands={props}
                  disabled={actionsDisabled}
                  onAction={perform}
                />
              ) : null}
              {view === "today" && !selectedItem ? (
                <>
                  {awayState.open && currentRead ? (
                    <AwayDigest
                      baseline={awayState.baseline ?? 0}
                      revision={props.revision}
                      events={awayEvents}
                      quietItems={quietSuggestions}
                      onOpen={openDetail}
                      onDismiss={dismissDigest}
                    />
                  ) : null}
                  <div className="workflow-title-row">
                    <h1>Today</h1>
                  </div>
                  <div className="workflow-view-toggles" role="group" aria-label="Group work by">
                    <button
                      type="button"
                      aria-pressed={lens === "status"}
                      onClick={() => setLens("status")}
                    >
                      By status
                    </button>
                    <button
                      type="button"
                      aria-pressed={lens === "assignee"}
                      onClick={() => setLens("assignee")}
                    >
                      By assignee
                    </button>
                  </div>
                  {lens === "status" ? (
                    <>
                      <div className="workflow-toolbar" aria-label="Filter work">
                        <label className="workflow-visually-hidden" htmlFor="work-search">
                          Search work
                        </label>
                        <input
                          id="work-search"
                          type="search"
                          placeholder="Search work…"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                        <label className="workflow-visually-hidden" htmlFor="work-assignee-filter">
                          Filter by assignee
                        </label>
                        <select
                          id="work-assignee-filter"
                          value={assigneeFilter}
                          onChange={(event) => setAssigneeFilter(event.target.value)}
                        >
                          <option value="all">Assignee: anyone</option>
                          {assignees.map((assignee) => (
                            <option key={assignee} value={assignee}>
                              Assignee: {assignee}
                            </option>
                          ))}
                        </select>
                        <label className="workflow-visually-hidden" htmlFor="work-status-filter">
                          Filter by status
                        </label>
                        <select
                          id="work-status-filter"
                          value={statusFilter}
                          onChange={(event) => setStatusFilter(event.target.value)}
                        >
                          <option value="all">Status: all</option>
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              Status: {humanState(status)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <p className="workflow-showing">
                        {filtered.length === props.items.length
                          ? `${props.items.length} items`
                          : `${filtered.length} of ${props.items.length} items`}
                        {activeFilters.length > 0 ? ` · ${activeFilters.join(" · ")}` : ""} · as of
                        r{props.revision}
                      </p>

                      {filtered.length === 0 ? (
                        <div className="workflow-empty" role="status">
                          <h2>
                            {hasWork ? "Nothing matches those filters." : "No work is recorded."}
                          </h2>
                          {hasWork ? (
                            <p>
                              {props.items.length} items exist, none match
                              {activeFilters.length > 0 ? ` · ${activeFilters.join(" · ")}` : ""}.
                            </p>
                          ) : (
                            <p>The event log contains no work items.</p>
                          )}
                        </div>
                      ) : (
                        <div className="workflow-groups">
                          {GROUPS.map((group) => {
                            const groupItems = filtered.filter((item) => item.group === group.key);
                            if (groupItems.length === 0) return null;
                            const total = props.items.filter(
                              (item) => item.group === group.key,
                            ).length;
                            const isCollapsed = collapsed[group.key] ?? groupItems.length > 8;
                            return (
                              <WorkGroup
                                key={group.key}
                                group={group}
                                items={groupItems}
                                total={total}
                                filtered={hasFilters}
                                collapsed={isCollapsed}
                                assignments={props.assignments}
                                runner={props.runner}
                                commands={props}
                                actionsDisabled={actionsDisabled}
                                pendingAction={pendingAction}
                                onToggle={() =>
                                  setCollapsed((current) => ({
                                    ...current,
                                    [group.key]: !isCollapsed,
                                  }))
                                }
                                onAction={perform}
                                onOpen={openDetail}
                              />
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <AssigneeLens items={filtered} revision={props.revision} onOpen={openDetail} />
                  )}
                </>
              ) : null}
            </section>
          )}
          {!session ? (
            <AttentionRail
              items={attention}
              revision={props.revision}
              stale={stale}
              viewedId={selectedItem?.workItemId ?? null}
              quietItems={quietSuggestions}
              commands={props}
              actionsDisabled={actionsDisabled}
              onAction={perform}
              onOpen={openDetail}
              onStartSession={startSession}
              onViewAll={() => {
                setDetailId(null);
                setView("today");
                setLens("status");
                setSearch("");
                setAssigneeFilter("all");
                setStatusFilter("all");
                setShowAllWork(true);
              }}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}

function WorkDetail({
  item,
  log,
  revision,
  onBack,
  commands,
  disabled,
  onAction,
}: Readonly<{
  item: WorkListItem;
  log: readonly WorkListLogEntry[];
  revision: number;
  onBack: () => void;
  commands: SurfaceBCommandApi;
  disabled: boolean;
  onAction: (label: string, action: () => void | Promise<void>) => Promise<boolean>;
}>) {
  const isReview = item.state === "review_requested";
  const blocker =
    item.hasEvidenceFailure || item.attentionReason === "failed" || item.state === "blocked";
  const evidenceFor = (kind: string) =>
    [...item.evidence].reverse().find((evidence) => evidence.kind === kind);
  const obligations = item.evidenceObligations;
  const counts = obligations.reduce(
    (totals, obligation) => {
      const evidence = evidenceFor(obligation.kind);
      if (!evidence) totals.missing += 1;
      else if (evidence.status === "checked" && evidence.result === "passed") totals.checked += 1;
      else if (evidence.status === "checked") totals.failed += 1;
      else if (evidence.status === "recorded") totals.recorded += 1;
      else totals.claimed += 1;
      return totals;
    },
    { checked: 0, failed: 0, recorded: 0, claimed: 0, missing: 0 },
  );
  const attestation = `${counts.checked} of ${obligations.length} obligations checked and passed; ${counts.failed} checked but failed; ${counts.recorded} recorded, not yet checked; ${counts.claimed} claimed; ${counts.missing} not recorded yet. As of r${revision}.`;
  const statusLabel = (evidence: WorkListEvidence | undefined) => {
    if (!evidence) return "Not recorded yet";
    if (evidence.status === "checked")
      return evidence.result === "passed" ? "Checked · passed" : "Checked · failed";
    if (evidence.status === "recorded") return "Recorded · not yet checked";
    return "Claimed · says it is done";
  };
  const latestRuling = item.currentRulingId
    ? item.rulings.find((ruling) => ruling.rulingId === item.currentRulingId)
    : undefined;
  const receiptEvents = log.filter((entry) =>
    [
      "approval.recorded",
      "work.ruling_recorded",
      "ruling.withdrawn",
      "work.turns_granted",
      "work.rescoped",
      "work.closed_incomplete",
      "work.nudged",
      "work.nudge_suppressed",
    ].includes(entry.kind),
  );

  return (
    <article className={`workflow-work-detail${blocker ? " is-blocker" : ""}`}>
      <button type="button" className="workflow-back" onClick={onBack}>
        ← Back to Today
      </button>
      <p
        className={`workflow-detail-flag${item.hasEvidenceFailure || item.attentionReason === "failed" || item.state === "blocked" ? " is-blocker" : ""}`}
      >
        {item.hasEvidenceFailure
          ? "Verification failed · blocker"
          : isReview
            ? "Needs your review"
            : item.state === "blocked" || item.state === "failed"
              ? "Blocked · your move"
              : "Your move"}{" "}
        · state {revisionLabel(item.sourceRevision)}
      </p>
      <h1>
        {item.hasEvidenceFailure
          ? "Verification failed"
          : isReview
            ? "Review"
            : item.state === "blocked" || item.state === "failed"
              ? "Decide"
              : "Work"}
        : {item.outcome}
      </h1>

      <section className="workflow-detail-section">
        <h2>What needs deciding</h2>
        <p>
          {item.condition?.summary ??
            (item.hasEvidenceFailure
              ? "Recorded evidence failed. Review the result and provenance before deciding what happens next."
              : (item.attentionReason ?? `The recorded state is ${humanState(item.state)}.`))}
        </p>
        <p className="workflow-log-meta">
          Condition{" "}
          {item.condition
            ? `from ${item.condition.source} · ${item.condition.trust} · ${revisionLabel(item.condition.sourceRevision)}`
            : "not recorded"}
        </p>
      </section>

      <section className="workflow-detail-section">
        <h2>The agreement</h2>
        {item.contract ? (
          <div className="workflow-agreement">
            <p>
              <strong>Outcome:</strong> {item.contract.outcome}
            </p>
            <p>
              <strong>Done means:</strong> {item.contract.definitionOfDone}
            </p>
            <p>
              <strong>Acceptance:</strong> {item.contract.acceptanceCriteria.join(" · ")}
            </p>
            <p>
              <strong>Boundaries:</strong>{" "}
              {item.contract.exclusions.length
                ? item.contract.exclusions.join(" · ")
                : "None recorded"}
            </p>
            <p>
              <strong>Dependencies:</strong>{" "}
              {item.contract.dependencies.length
                ? item.contract.dependencies.join(" · ")
                : "None recorded"}
            </p>
            <p>
              <strong>Stop conditions:</strong> {item.contract.stopConditions.join(" · ")}
            </p>
          </div>
        ) : (
          <p>No work contract is recorded for this item.</p>
        )}
        {item.contractHistory.length > 1 ? (
          <div className="workflow-agreement-history">
            <h3>Recorded changes</h3>
            <AgreementDiff history={item.contractHistory} />
          </div>
        ) : null}
      </section>

      {item.resurface ? (
        <p className="workflow-resurface-status" role="status">
          {item.resurface.due === true
            ? `Resurface due · derived from ${revisionLabel(item.resurface.sourceRevision)}.`
            : item.resurface.due === false
              ? `Resurface set for ${item.resurface.at} · ${revisionLabel(item.resurface.sourceRevision)}.`
              : "Resurface time is recorded; due status is unavailable in this view."}
        </p>
      ) : null}

      <section className="workflow-detail-section">
        <h2>Evidence</h2>
        {obligations.length > 0 ? (
          <ul className="workflow-detail-evidence">
            {obligations.map((obligation) => {
              const evidence = evidenceFor(obligation.kind);
              return (
                <li key={obligation.kind}>
                  <span
                    className={`workflow-evidence-state${evidence?.result === "failed" ? " is-failed" : ` is-${evidence?.status ?? "missing"}`}`}
                  >
                    {statusLabel(evidence)}
                  </span>
                  <span>
                    <strong>{obligation.description}</strong> · {obligation.kind}
                  </span>
                  <small>
                    {evidence
                      ? `${revisionLabel(evidence.sourceRevision)} · source ${evidence.source ?? "missing"} · trust ${evidence.trust ?? "missing"} · run ${evidence.providerRunId ?? "missing"} · worktree SHA-256 ${evidence.worktreeSha256 ?? "missing"} · output SHA-256 ${evidence.outputSha256 ?? "missing"}`
                      : `Not recorded at r${revision}`}
                  </small>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No evidence obligations are recorded.</p>
        )}
        {item.evidence.some((evidence) => evidence.kind === "done-claim") ? (
          <p className="workflow-claim-note">
            The role says it is done. A claim is not checked evidence.
          </p>
        ) : null}
      </section>

      <section className="workflow-detail-section">
        <h2>Risk</h2>
        <p>Risk is not recorded in the workflow core for this matter.</p>
        {item.state === "blocked" ? (
          <p>
            Downstream work links are not recorded; this view cannot name what the blocker holds.
          </p>
        ) : null}
      </section>

      <section className="workflow-detail-section">
        <h2>Your ruling</h2>
        <p className="workflow-attestation">
          Evidence at r{revision}: {attestation}
        </p>
        <RulingActions item={item} disabled={disabled} commands={commands} onAction={onAction} />
      </section>

      {item.turnBudget ? (
        <TurnBudgetActions
          item={item}
          disabled={disabled}
          commands={commands}
          onAction={onAction}
        />
      ) : null}

      {item.contract && item.contractRevision !== null ? (
        <RescopeAction item={item} disabled={disabled} commands={commands} onAction={onAction} />
      ) : null}

      {receiptEvents.length > 0 ? (
        <section
          className="workflow-detail-section"
          aria-label={
            receiptEvents.some((entry) => entry.kind === "work.ruling_recorded")
              ? "Ruling receipt"
              : "Recorded effects"
          }
        >
          <h2>
            {receiptEvents.some((entry) => entry.kind === "work.ruling_recorded")
              ? "Ruling receipt"
              : "Recorded effects"}
          </h2>
          {receiptEvents.map((entry) => (
            <p key={entry.eventId}>
              Recorded at {revisionLabel(entry.revision)} · {entry.summary} · visible on next
              check-in.
            </p>
          ))}
          {latestRuling &&
          !latestRuling.withdrawn &&
          commands.onWithdrawRuling &&
          item.sourceRevision === latestRuling.sourceRevision &&
          Date.now() - Date.parse(latestRuling.recordedAt) <= 60_000 ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                void onAction(`withdraw:${item.workItemId}`, () =>
                  commands.onWithdrawRuling!(item.workItemId, latestRuling.rulingId),
                )
              }
            >
              Undo ruling
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="workflow-detail-section">
        <h2>Trail — this matter</h2>
        {log.length > 0 ? (
          <ol className="workflow-matter-trail">
            {log.map((entry) => (
              <li key={entry.eventId}>
                <span className="workflow-revision">r{entry.revision}</span>
                <span>{entry.summary}</span>
                <small>
                  {entry.source} · {entry.trust} · {entry.occurredAt}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p>No matter-scoped events are recorded.</p>
        )}
      </section>
    </article>
  );
}

type ActionRunner = (label: string, action: () => void | Promise<void>) => Promise<boolean>;

function RulingActions({
  item,
  disabled,
  commands,
  onAction,
}: Readonly<{
  item: WorkListItem;
  disabled: boolean;
  commands: SurfaceBCommandApi;
  onAction: ActionRunner;
}>) {
  const [mode, setMode] = useState<"exception" | "send-back" | "defer" | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [resurfaceLocal, setResurfaceLocal] = useState("");
  const inReview = item.state === "review_requested";
  const latestByKind = new Map<string, WorkListEvidence>();
  for (const evidence of item.evidence) latestByKind.set(evidence.kind, evidence);
  const canAcceptNormally =
    item.evidenceObligations.length > 0 &&
    item.evidenceObligations.every((obligation) => {
      const evidence = latestByKind.get(obligation.kind);
      return (
        evidence?.status === "checked" &&
        evidence.result === "passed" &&
        evidence.worktreeSha256 !== null
      );
    });
  const callback = commands.onRuling;
  const submit = async (decision: WorkListRuling["decision"]) => {
    if (!callback) return;
    const payload: WorkListRuling = {
      decision,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(decision === "defer" && resurfaceLocal
        ? { resurfaceAt: new Date(resurfaceLocal).toISOString() }
        : {}),
    };
    const accepted = await onAction(`ruling:${item.workItemId}`, () =>
      callback(item.workItemId, payload),
    );
    if (accepted) {
      setMode(null);
      setReason("");
      setNote("");
      setResurfaceLocal("");
    }
  };
  const resurfaceIsFuture =
    resurfaceLocal.length > 0 &&
    Number.isFinite(Date.parse(resurfaceLocal)) &&
    Date.parse(resurfaceLocal) > Date.now();

  return (
    <div className="workflow-ruling-actions">
      <button
        type="button"
        disabled={disabled || !callback || !inReview || !canAcceptNormally}
        title={
          !canAcceptNormally
            ? "Every obligation needs checked, passing evidence bound to a recorded worktree digest before ordinary acceptance."
            : undefined
        }
        onClick={() => void submit("accept")}
      >
        Accept as done
      </button>
      <button
        type="button"
        disabled={disabled || !callback || !inReview}
        onClick={() => {
          setMode("exception");
          setReason("");
        }}
      >
        Accept with exception
      </button>
      <button
        type="button"
        disabled={disabled || !callback || !inReview}
        onClick={() => {
          setMode("send-back");
          setReason("");
        }}
      >
        Send back
      </button>
      <button
        type="button"
        disabled={disabled || !callback}
        onClick={() => {
          setMode("defer");
          setReason("");
          setResurfaceLocal("");
        }}
      >
        Defer
      </button>
      {mode ? (
        <form
          className="workflow-ruling-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "exception") void submit("accept_with_exception");
            else if (mode === "send-back") void submit("send_back");
            else void submit("defer");
          }}
        >
          <label>
            {mode === "exception"
              ? "Override reason"
              : mode === "send-back"
                ? "Send-back reason"
                : "Defer reason"}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={2000}
              disabled={disabled}
            />
          </label>
          {mode === "defer" ? (
            <label>
              Resurface at
              <input
                type="datetime-local"
                value={resurfaceLocal}
                onChange={(event) => setResurfaceLocal(event.target.value)}
                required
                disabled={disabled}
              />
              <small>The saved time is converted to UTC and must be in the future.</small>
            </label>
          ) : null}
          <label>
            Note (optional)
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              disabled={disabled}
            />
          </label>
          <div className="workflow-form-actions">
            <button
              type="submit"
              disabled={
                disabled || reason.trim().length === 0 || (mode === "defer" && !resurfaceIsFuture)
              }
            >
              {mode === "exception"
                ? "Record exception ruling"
                : mode === "send-back"
                  ? "Record send-back"
                  : "Record defer"}
            </button>
            <button type="button" disabled={disabled} onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {!callback ? (
        <p className="workflow-help">Rulings need the connected workflow command path.</p>
      ) : null}
    </div>
  );
}

function AgreementDiff({ history }: Readonly<{ history: WorkListItem["contractHistory"] }>) {
  const pairs = history.slice(1).map((next, index) => ({ previous: history[index]!, next }));
  return (
    <ol className="workflow-agreement-diff">
      {pairs.flatMap(({ previous, next }) => {
        const fields: [string, string, string][] = [
          ["Outcome", previous.contract.outcome, next.contract.outcome],
          ["Done means", previous.contract.definitionOfDone, next.contract.definitionOfDone],
          [
            "Acceptance criteria",
            previous.contract.acceptanceCriteria.join(" · "),
            next.contract.acceptanceCriteria.join(" · "),
          ],
          [
            "Boundaries",
            previous.contract.exclusions.join(" · ") || "None",
            next.contract.exclusions.join(" · ") || "None",
          ],
          [
            "Dependencies",
            previous.contract.dependencies.join(" · ") || "None",
            next.contract.dependencies.join(" · ") || "None",
          ],
          [
            "Stop conditions",
            previous.contract.stopConditions.join(" · "),
            next.contract.stopConditions.join(" · "),
          ],
          [
            "Turn cap",
            String(previous.contract.maxTurns ?? "not recorded"),
            String(next.contract.maxTurns ?? "not recorded"),
          ],
        ];
        const changed = fields.filter(([, before, after]) => before !== after);
        return changed.map(([label, before, after]) => (
          <li key={`${next.revision}-${label}`}>
            <strong>{label}:</strong> {before || "(empty)"} → {after || "(empty)"} · r
            {previous.revision} to r{next.revision}
          </li>
        ));
      })}
    </ol>
  );
}

function TurnBudgetActions({
  item,
  disabled,
  commands,
  onAction,
}: Readonly<{
  item: WorkListItem;
  disabled: boolean;
  commands: SurfaceBCommandApi;
  onAction: ActionRunner;
}>) {
  const budget = item.turnBudget;
  const [amount, setAmount] = useState("");
  const [closeReason, setCloseReason] = useState("");
  if (!budget) return null;
  const turns = Number(amount);
  const grantDisabled =
    disabled || !commands.onGrantTurns || !Number.isInteger(turns) || turns <= 0;
  return (
    <section className="workflow-detail-section" aria-label="Turn budget">
      <h2>Turn budget</h2>
      {budget.budgetRecorded && budget.effectiveMaxTurns !== null ? (
        <>
          <p>
            {budget.usedTurns === null ? "Turn count incomplete" : `${budget.usedTurns} turns used`}{" "}
            · {budget.effectiveMaxTurns} allowed ·{" "}
            {budget.countComplete
              ? `${budget.remainingTurns ?? "remaining count unavailable"} remaining`
              : "remaining count unavailable"}
          </p>
          {budget.exhausted ? <p>This recorded turn budget is exhausted.</p> : null}
          <div className="workflow-budget-action">
            <label>
              Grant more turns
              <input
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={disabled}
              />
            </label>
            <button
              type="button"
              disabled={grantDisabled}
              onClick={() =>
                commands.onGrantTurns &&
                void onAction(`grant-turns:${item.workItemId}`, () =>
                  commands.onGrantTurns!(item.workItemId, turns, budget.budgetRevision),
                )
              }
            >
              Grant turns
            </button>
          </div>
          <div className="workflow-budget-action">
            <label>
              Close-incomplete reason
              <textarea
                value={closeReason}
                onChange={(event) => setCloseReason(event.target.value)}
                disabled={disabled}
              />
            </label>
            <button
              type="button"
              disabled={disabled || !commands.onCloseIncomplete || !closeReason.trim()}
              onClick={() =>
                commands.onCloseIncomplete &&
                void onAction(`close-incomplete:${item.workItemId}`, () =>
                  commands.onCloseIncomplete!(item.workItemId, closeReason.trim()),
                )
              }
            >
              Close as incomplete
            </button>
          </div>
        </>
      ) : (
        <p>No turn budget is recorded. Turn use is unavailable.</p>
      )}
    </section>
  );
}

function RescopeAction({
  item,
  disabled,
  commands,
  onAction,
}: Readonly<{
  item: WorkListItem;
  disabled: boolean;
  commands: SurfaceBCommandApi;
  onAction: ActionRunner;
}>) {
  const contract = item.contract;
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState(contract?.outcome ?? "");
  const [definitionOfDone, setDefinitionOfDone] = useState(contract?.definitionOfDone ?? "");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(
    contract?.acceptanceCriteria.join("\n") ?? "",
  );
  const [exclusions, setExclusions] = useState(contract?.exclusions.join("\n") ?? "");
  const [dependencies, setDependencies] = useState(contract?.dependencies.join("\n") ?? "");
  const [evidenceObligations, setEvidenceObligations] = useState(
    contract?.evidenceObligations
      .map((entry) => `${entry.kind}: ${entry.description}`)
      .join("\n") ?? "",
  );
  const [stopConditions, setStopConditions] = useState(contract?.stopConditions.join("\n") ?? "");
  const [maxTurns, setMaxTurns] = useState(
    contract?.maxTurns === undefined ? "" : String(contract.maxTurns),
  );
  if (!contract || item.contractRevision === null) return null;
  const lines = (value: string) =>
    value
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
  const obligations = lines(evidenceObligations).map((line) => {
    const split = line.indexOf(":");
    return split < 0
      ? { kind: "", description: "" }
      : {
          kind: line.slice(0, split).trim(),
          description: line.slice(split + 1).trim(),
        };
  });
  const cap = Number(maxTurns);
  const candidate: WorkContract = {
    ...contract,
    outcome: outcome.trim(),
    definitionOfDone: definitionOfDone.trim(),
    acceptanceCriteria: lines(acceptanceCriteria),
    exclusions: lines(exclusions),
    dependencies: lines(dependencies),
    evidenceObligations: obligations,
    stopConditions: lines(stopConditions),
    ...(Number.isInteger(cap) && cap > 0 ? { maxTurns: cap } : { maxTurns: undefined }),
  };
  const valid =
    Boolean(commands.onRescope) &&
    candidate.outcome.length > 0 &&
    candidate.definitionOfDone.length > 0 &&
    candidate.acceptanceCriteria.length > 0 &&
    candidate.stopConditions.length > 0 &&
    Number.isInteger(cap) &&
    cap > 0 &&
    obligations.length > 0 &&
    obligations.every((entry) => entry.kind.length > 0 && entry.description.length > 0) &&
    new Set(obligations.map((entry) => entry.kind)).size === obligations.length;
  return (
    <section className="workflow-detail-section" aria-label="Re-scope agreement">
      <h2>Agreement revisions</h2>
      <p>
        Current agreement revision {item.contractRevision} · re-scope records a full replacement.
      </p>
      {!editing ? (
        <button
          type="button"
          disabled={disabled || !commands.onRescope}
          onClick={() => setEditing(true)}
        >
          Re-scope agreement
        </button>
      ) : (
        <form
          className="workflow-rescope-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid || !commands.onRescope) return;
            void onAction(`rescope:${item.workItemId}`, async () => {
              await commands.onRescope!(item.workItemId, item.contractRevision!, candidate);
            }).then((accepted) => {
              if (accepted) setEditing(false);
            });
          }}
        >
          <label>
            Outcome
            <input
              required
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              disabled={disabled}
            />
          </label>
          <label>
            Definition of done
            <textarea
              required
              value={definitionOfDone}
              onChange={(event) => setDefinitionOfDone(event.target.value)}
              disabled={disabled}
            />
          </label>
          <label>
            Acceptance criteria (one per line)
            <textarea
              required
              value={acceptanceCriteria}
              onChange={(event) => setAcceptanceCriteria(event.target.value)}
              disabled={disabled}
            />
          </label>
          <label>
            Exclusions (one per line)
            <textarea
              value={exclusions}
              onChange={(event) => setExclusions(event.target.value)}
              disabled={disabled}
            />
          </label>
          <label>
            Dependencies (one per line)
            <textarea
              value={dependencies}
              onChange={(event) => setDependencies(event.target.value)}
              disabled={disabled}
            />
          </label>
          <label>
            Evidence obligations, kind: description (one per line)
            <textarea
              required
              value={evidenceObligations}
              onChange={(event) => setEvidenceObligations(event.target.value)}
              disabled={disabled}
            />
          </label>
          <label>
            Stop conditions (one per line)
            <textarea
              required
              value={stopConditions}
              onChange={(event) => setStopConditions(event.target.value)}
              disabled={disabled}
            />
          </label>
          <label>
            Turn cap
            <input
              type="number"
              min={1}
              step={1}
              required
              value={maxTurns}
              onChange={(event) => setMaxTurns(event.target.value)}
              disabled={disabled}
            />
          </label>
          <p>
            Permission ceiling and context references carry forward from the recorded agreement.
          </p>
          <div className="workflow-form-actions">
            <button type="submit" disabled={disabled || !valid}>
              Record replacement agreement
            </button>
            <button type="button" disabled={disabled} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function AssigneeLens({
  items,
  revision,
  onOpen,
}: Readonly<{
  items: readonly WorkListItem[];
  revision: number;
  onOpen: (workItemId: string) => void;
}>) {
  const buckets = new Map<string, WorkListItem[]>();
  for (const item of items) {
    const label = item.assignee ?? "Unassigned";
    buckets.set(label, [...(buckets.get(label) ?? []), item]);
  }
  const ordered = [...buckets.entries()].sort(([left], [right]) =>
    left === "Unassigned" ? 1 : right === "Unassigned" ? -1 : left.localeCompare(right),
  );
  return (
    <section className="workflow-assignee-lens" aria-label="Work by assignee">
      <div className="workflow-lens-heading">
        <h2>By assignee</h2>
        <p className="workflow-showing">Counts from the event log · as of r{revision}</p>
      </div>
      {ordered.map(([label, assigned]) => {
        const underway = assigned.filter((item) => item.group === "in-progress").length;
        const needsYou = assigned.filter((item) => item.group === "your-move").length;
        const oldest = [...assigned]
          .filter((item) => item.lastEvent !== null)
          .sort((a, b) => Date.parse(a.lastEvent ?? "") - Date.parse(b.lastEvent ?? ""))[0];
        const quiet = oldest?.lastEvent
          ? formatWait(Date.now() - Date.parse(oldest.lastEvent))
          : "duration missing";
        return (
          <section className="workflow-assignee-group" key={label}>
            <h3>{label}</h3>
            <p>
              {underway} underway · {needsYou} need you · quiet {quiet}
              {oldest ? ` on ${oldest.outcome}` : ""} · r{revision}
            </p>
            <ul>
              {assigned.map((item) => (
                <li key={item.workItemId}>
                  <button type="button" onClick={() => onOpen(item.workItemId)}>
                    {item.outcome}
                  </button>
                  <span>
                    {humanState(item.state)} · {revisionLabel(item.sourceRevision)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {ordered.length === 0 ? <p>No assignments are recorded.</p> : null}
    </section>
  );
}

function QuietSuggestions({
  items,
  revision,
  onOpen,
  commands,
  actionsDisabled,
  onAction,
  compact = false,
}: Readonly<{
  items: readonly WorkListItem[];
  revision: number;
  onOpen: (workItemId: string) => void;
  commands: SurfaceBCommandApi;
  actionsDisabled: boolean;
  onAction: ActionRunner;
  compact?: boolean;
}>) {
  if (items.length === 0) return null;
  return (
    <section
      className={`workflow-quiet-suggestions${compact ? " is-compact" : ""}`}
      aria-label="Quiet suggestions"
    >
      <h2>Quiet · suggested</h2>
      <p>
        More than 3 days without a recorded signal. These are suggestions derived from the log, not
        recorded nudges.
      </p>
      {items.map((item) => (
        <QuietSuggestion
          key={item.workItemId}
          item={item}
          revision={revision}
          onOpen={onOpen}
          commands={commands}
          actionsDisabled={actionsDisabled}
          onAction={onAction}
        />
      ))}
    </section>
  );
}

function QuietSuggestion({
  item,
  revision,
  onOpen,
  commands,
  actionsDisabled,
  onAction,
}: Readonly<{
  item: WorkListItem;
  revision: number;
  onOpen: (workItemId: string) => void;
  commands: SurfaceBCommandApi;
  actionsDisabled: boolean;
  onAction: ActionRunner;
}>) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const canNudge = Boolean(commands.onNudge && item.roleAssignmentId);
  return (
    <article>
      <button
        type="button"
        className="workflow-quiet-title"
        onClick={() => onOpen(item.workItemId)}
      >
        {item.outcome}
      </button>
      <p>
        No signal since {revisionLabel(item.lastSignalRevision)} ·{" "}
        {formatWait(item.lastEvent ? Date.now() - Date.parse(item.lastEvent) : null)} · evaluated at
        current time against r{revision}
      </p>
      <div className="workflow-quiet-actions">
        <button
          type="button"
          disabled={actionsDisabled || !canNudge}
          title={!item.roleAssignmentId ? "There is no current assignee to nudge." : undefined}
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? "Cancel nudge" : "Send nudge"}
        </button>
        <button
          type="button"
          disabled={actionsDisabled || !commands.onSuppressNudge}
          onClick={() =>
            commands.onSuppressNudge &&
            void onAction(`snooze:${item.workItemId}`, () =>
              commands.onSuppressNudge!(item.workItemId, "snooze"),
            )
          }
        >
          Snooze 2 days
        </button>
        <button
          type="button"
          disabled={actionsDisabled || !commands.onSuppressNudge}
          onClick={() =>
            commands.onSuppressNudge &&
            void onAction(`dismiss:${item.workItemId}`, () =>
              commands.onSuppressNudge!(item.workItemId, "dismiss"),
            )
          }
        >
          Dismiss for 3 days
        </button>
      </div>
      {!canNudge ? (
        <p className="workflow-help">Assign the work before asking for a check-in.</p>
      ) : null}
      {editing && commands.onNudge && item.roleAssignmentId ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onAction(`nudge:${item.workItemId}`, () =>
              commands.onNudge!(item.workItemId, item.roleAssignmentId!, note.trim()),
            ).then((accepted) => {
              if (accepted) {
                setEditing(false);
                setNote("");
              }
            });
          }}
        >
          <label>
            Check-in request
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              required
              maxLength={280}
              disabled={actionsDisabled}
            />
          </label>
          <button type="submit" disabled={actionsDisabled || !note.trim()}>
            Record nudge
          </button>
        </form>
      ) : null}
    </article>
  );
}

function AwayDigest({
  baseline,
  revision,
  events,
  quietItems,
  onOpen,
  onDismiss,
}: Readonly<{
  baseline: number;
  revision: number;
  events: readonly WorkListLogEntry[];
  quietItems: readonly WorkListItem[];
  onOpen: (workItemId: string) => void;
  onDismiss: () => void;
}>) {
  const yours = events.filter(
    (entry) =>
      entry.kind === "approval.recorded" ||
      /^(blocked|failed|waiting_input|review_requested|completed)/u.test(entry.summary),
  );
  const evidence = events.filter((entry) => entry.kind === "evidence.recorded");
  const motion = events.filter((entry) => !yours.includes(entry) && !evidence.includes(entry));
  const visibleEvents = events.slice(-8);
  const visibleIds = new Set(visibleEvents.map((entry) => entry.eventId));
  const visibleYours = yours.filter((entry) => visibleIds.has(entry.eventId));
  const visibleEvidence = evidence.filter((entry) => visibleIds.has(entry.eventId));
  const visibleMotion = motion.filter((entry) => visibleIds.has(entry.eventId));
  const omittedCount = events.length - visibleEvents.length;
  return (
    <section className="workflow-away-digest" aria-label="While you were away">
      <div className="workflow-title-row">
        <h2>While you were away</h2>
        <button type="button" onClick={onDismiss}>
          Close digest
        </button>
      </div>
      <p className="workflow-showing">
        Changes in the log from r{baseline + 1} through r{revision}.
      </p>
      <DigestGroup title="Yours" entries={visibleYours} onOpen={onOpen} />
      <DigestGroup title="Evidence" entries={visibleEvidence} onOpen={onOpen} />
      <DigestGroup title="Motion" entries={visibleMotion} onOpen={onOpen} />
      {omittedCount > 0 ? (
        <p className="workflow-help">{omittedCount} events not shown in this digest.</p>
      ) : null}
      <section>
        <h3>Quiet</h3>
        {quietItems.length > 0 ? (
          quietItems.map((item) => (
            <p key={item.workItemId}>
              <button type="button" onClick={() => onOpen(item.workItemId)}>
                {item.outcome}
              </button>{" "}
              · no signal for{" "}
              {formatWait(item.lastEvent ? Date.now() - Date.parse(item.lastEvent) : null)} ·{" "}
              {revisionLabel(item.lastSignalRevision)}
            </p>
          ))
        ) : (
          <p>
            {events.length === 0
              ? `Nothing happened in the log since r${baseline}.`
              : "No work is recorded as quiet for more than 3 days."}
          </p>
        )}
      </section>
    </section>
  );
}

function DigestGroup({
  title,
  entries,
  onOpen,
}: Readonly<{
  title: string;
  entries: readonly WorkListLogEntry[];
  onOpen: (workItemId: string) => void;
}>) {
  return (
    <section className="workflow-digest-group">
      <h3>{title}</h3>
      {entries.length === 0 ? (
        <p>Nothing recorded.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.eventId}>
              {entry.workItemId ? (
                <button type="button" onClick={() => onOpen(entry.workItemId!)}>
                  {entry.summary}
                </button>
              ) : (
                <span>{entry.summary}</span>
              )}{" "}
              <small>
                {revisionLabel(entry.revision)} · {entry.source} · {entry.trust}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RulingSession({
  session,
  items,
  log,
  revision,
  onSkip,
  onEnd,
  commands,
  disabled,
  onAction,
  onOpenDetail,
}: Readonly<{
  session: Readonly<{
    queue: readonly string[];
    cursor: number;
    skipped: readonly string[];
    startRevision: number;
  }>;
  items: readonly WorkListItem[];
  log: readonly WorkListLogEntry[];
  revision: number;
  onSkip: () => void;
  onEnd: () => void;
  commands: SurfaceBCommandApi;
  disabled: boolean;
  onAction: ActionRunner;
  onOpenDetail: (workItemId: string) => void;
}>) {
  const item = items.find((entry) => entry.workItemId === session.queue[session.cursor]);
  const rulingsRecorded = log.filter(
    (entry) => entry.revision > session.startRevision && entry.kind === "work.ruling_recorded",
  ).length;
  return (
    <section className="workflow-ruling-session" aria-label="Ruling session">
      <header className="workflow-title-row">
        <div>
          <p className="workflow-session-kicker">Ruling session</p>
          <p className="workflow-showing">
            {item ? `Matter ${session.cursor + 1} of ${session.queue.length}` : "Session tally"} ·{" "}
            {session.skipped.length} skipped
          </p>
        </div>
        <button type="button" onClick={onEnd}>
          End session
        </button>
      </header>
      {item ? (
        <article className="workflow-session-card">
          <p className="workflow-detail-flag">
            {item.attentionReason ?? "Your move"} · {revisionLabel(item.sourceRevision)}
          </p>
          <h1>{item.outcome}</h1>
          <p>{item.condition?.summary ?? `The recorded state is ${humanState(item.state)}.`}</p>
          <p className="workflow-attestation">Evidence: {attestationSummary(item, revision)}</p>
          <ul className="workflow-session-evidence" aria-label="Evidence lines">
            {item.evidenceObligations.map((obligation) => {
              const evidence = [...item.evidence]
                .reverse()
                .find((entry) => entry.kind === obligation.kind);
              return (
                <li key={obligation.kind}>
                  <span className={`workflow-evidence-state is-${evidence?.status ?? "missing"}`}>
                    {evidenceStatusLabel(evidence)}
                  </span>
                  <span>
                    <strong>{obligation.description}</strong> · {obligation.kind}
                  </span>
                  <small>
                    {evidence
                      ? `${revisionLabel(evidence.sourceRevision)} · ${evidence.source ?? "source missing"} · ${evidence.trust ?? "trust missing"} · worktree SHA-256 ${evidence.worktreeSha256 ?? "missing"}`
                      : `Not recorded at r${revision}`}
                  </small>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => onOpenDetail(item.workItemId)}>
            Open full detail
          </button>
          <RulingActions item={item} disabled={disabled} commands={commands} onAction={onAction} />
          <div className="workflow-ruling-actions">
            <button type="button" onClick={onSkip}>
              Skip
            </button>
          </div>
          <p className="workflow-help">Skip only changes this session’s view order.</p>
        </article>
      ) : (
        <div className="workflow-session-tally">
          <h1>Session tally</h1>
          <p>
            {rulingsRecorded} rulings recorded · {session.skipped.length} skipped · from r
            {session.startRevision} through r{revision}.
          </p>
          <button type="button" onClick={onEnd}>
            Return to Your Move
          </button>
        </div>
      )}
    </section>
  );
}

function attestationSummary(item: WorkListItem, revision: number): string {
  const latestByKind = new Map<string, WorkListEvidence>();
  for (const evidence of item.evidence) latestByKind.set(evidence.kind, evidence);
  const counts = item.evidenceObligations.reduce(
    (totals, obligation) => {
      const evidence = latestByKind.get(obligation.kind);
      if (!evidence) totals.missing += 1;
      else if (evidence.status === "checked" && evidence.result === "passed") totals.checked += 1;
      else if (evidence.status === "checked") totals.failed += 1;
      else if (evidence.status === "recorded") totals.recorded += 1;
      else totals.claimed += 1;
      return totals;
    },
    { checked: 0, failed: 0, recorded: 0, claimed: 0, missing: 0 },
  );
  return `${counts.checked} checked and passed; ${counts.failed} checked but failed; ${counts.recorded} recorded, not checked; ${counts.claimed} claimed; ${counts.missing} not recorded yet. As of r${revision}.`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function PrimaryNavigation({
  view,
  onNavigate,
}: Readonly<{ view: WorkListView; onNavigate: (view: WorkListView) => void }>) {
  return (
    <nav className="workflow-navigation" aria-label="Primary">
      {(["today", "new-work", "log"] as const).map((entry) => (
        <button
          key={entry}
          type="button"
          aria-current={view === entry ? "page" : undefined}
          onClick={() => onNavigate(entry)}
        >
          {entry === "today" ? "Today" : entry === "new-work" ? "New work" : "Log"}
        </button>
      ))}
    </nav>
  );
}

function ReadHealth({
  health,
  onRefresh,
}: Readonly<{ health: WorkListHealth; onRefresh?: () => void | Promise<void> }>) {
  let message: string;
  if (health.status === "stale") {
    const age =
      health.ageMs === null ? "age missing" : `${Math.floor(health.ageMs / 60_000)} minutes old`;
    message = health.fetchedAt
      ? `Projection of r${health.revision} — ${age}; the log is unreachable. Actions are disabled.`
      : "The log is unreachable. No current work state is confirmed; actions are disabled.";
  } else if (health.status === "incomplete") {
    message = `Projection of r${health.projectedRevision}; the log response is incomplete. Actions are disabled.`;
  } else if (health.status === "damaged") {
    message = `Projection of r${health.projectedRevision}; ${health.issueCount} log or replay issue(s). Actions are disabled.`;
  } else {
    message = `Projection r${health.projectedRevision} disagrees with server revision r${health.revision}. The log wins; refresh before acting.`;
  }
  return (
    <section className="workflow-read-health" aria-label="Event log status" role="status">
      <div>
        <p>{message}</p>
        {health.issues.map((issue, index) => (
          <p className="workflow-health-issue" key={`${index}-${issue}`}>
            {issue}
          </p>
        ))}
      </div>
      {onRefresh ? (
        <button type="button" onClick={() => void onRefresh()}>
          Refresh log
        </button>
      ) : null}
    </section>
  );
}

function CalmScreen({
  fresh,
  revision,
  underwayCount,
  resurfaceDueCount,
  actionsDisabled,
  onStart,
  onShowAll,
}: Readonly<{
  fresh: boolean;
  revision: number;
  underwayCount: number;
  resurfaceDueCount: number;
  actionsDisabled: boolean;
  onStart: () => void;
  onShowAll: () => void;
}>) {
  return (
    <section className="workflow-calm" aria-label={fresh ? "No work yet" : "All clear"}>
      <span className="workflow-calm-lamp" aria-hidden="true" />
      <h1>{fresh ? "No work yet." : "Nothing needs your move."}</h1>
      <p>
        {fresh
          ? "The event log has no work items. Describe the first outcome when the contract-drafting path is available."
          : `${underwayCount} pieces of work are in progress and none are waiting for your action, as of r${revision}.`}
      </p>
      {fresh ? (
        <button
          className="workflow-primary"
          type="button"
          onClick={onStart}
          disabled={actionsDisabled}
        >
          Describe the first piece of work
        </button>
      ) : (
        <button type="button" onClick={onShowAll}>
          Show all work
        </button>
      )}
      <p className="workflow-calm-meta">
        {fresh
          ? `projection of r${String(revision).padStart(3, "0")} · log empty`
          : `projection of r${revision} · checked from the log`}
      </p>
      {!fresh ? (
        <p className="workflow-calm-resurface">
          {resurfaceDueCount === 0
            ? "No resurface is due from the recorded defer events."
            : `${resurfaceDueCount} recorded resurface point${resurfaceDueCount === 1 ? " is" : "s are"} due.`}
        </p>
      ) : null}
    </section>
  );
}

function NewWorkUnavailable() {
  return (
    <section className="workflow-create-panel" aria-labelledby="new-work-title">
      <div className="workflow-unavailable-mark" aria-hidden="true">
        Drafting path not connected
      </div>
      <h1 id="new-work-title">Describe the outcome</h1>
      <p>
        Your Move requires an agent-authored contract draft for manager review before anything is
        saved. The current workflow core has no draft service, so this view will not create work.
      </p>
    </section>
  );
}

function AttentionRail({
  items,
  revision,
  stale,
  viewedId,
  quietItems,
  commands,
  actionsDisabled,
  onAction,
  onOpen,
  onStartSession,
  onViewAll,
}: Readonly<{
  items: readonly WorkListItem[];
  revision: number;
  stale: boolean;
  viewedId: string | null;
  quietItems: readonly WorkListItem[];
  commands: SurfaceBCommandApi;
  actionsDisabled: boolean;
  onAction: ActionRunner;
  onOpen: (workItemId: string) => void;
  onStartSession: () => void;
  onViewAll: () => void;
}>) {
  return (
    <aside className="workflow-rail" aria-label="Your move, unfiltered">
      <h2 className="workflow-rail-title">
        <span
          className={`workflow-lamp${items.length > 0 && !stale ? " workflow-lamp-lit" : ""}`}
          aria-hidden="true"
        />
        Your move
      </h2>
      <p className="workflow-rail-count">
        {stale
          ? `N? projected matters · source r${revision}`
          : `${items.length} matters · as of r${revision}`}
        {items.length > 0 ? " · unfiltered" : ""}
      </p>
      {items.length === 0 ? (
        <p className="workflow-rail-empty">Nothing needs your move, as of r{revision}.</p>
      ) : (
        <div className="workflow-rail-list" aria-label="All matters needing your move">
          {items.map((item) => (
            <button
              className={`workflow-rail-item${viewedId === item.workItemId ? " is-viewed" : ""}`}
              key={item.workItemId}
              type="button"
              data-work-item-id={item.workItemId}
              onClick={() => onOpen(item.workItemId)}
            >
              <span className="workflow-rail-item-title">{item.outcome}</span>
              <span className="workflow-rail-item-meta">
                {viewedId === item.workItemId ? "viewing · " : ""}
                {item.attentionReason ? `${item.attentionReason.replaceAll("_", " ")} · ` : ""}
                your move for {formatWait(item.waitingMs)} ·{" "}
                {revisionLabel(item.lastSignalRevision)}
              </span>
            </button>
          ))}
        </div>
      )}
      {items.length > 0 ? (
        <div className="workflow-rail-footer">
          <p>
            {items.length} of {items.length} matters · oldest first.
          </p>
          {items.length > 5 ? (
            <p>
              + {items.length - 5} more in the scroll ·{" "}
              <button type="button" onClick={onViewAll}>
                View all in list
              </button>
            </p>
          ) : null}
          <button type="button" onClick={onStartSession} disabled={stale}>
            Start ruling session
          </button>
        </div>
      ) : null}
      {quietItems.length > 0 ? (
        <QuietSuggestions
          items={quietItems}
          revision={revision}
          onOpen={onOpen}
          commands={commands}
          actionsDisabled={actionsDisabled}
          onAction={onAction}
          compact
        />
      ) : null}
    </aside>
  );
}

function WorkGroup({
  group,
  items,
  total,
  filtered,
  collapsed,
  assignments,
  runner,
  commands,
  actionsDisabled,
  pendingAction,
  onToggle,
  onAction,
  onOpen,
}: Readonly<{
  group: GroupDefinition;
  items: readonly WorkListItem[];
  total: number;
  filtered: boolean;
  collapsed: boolean;
  assignments: readonly WorkListAssignment[];
  runner: WorkListRunner;
  commands: SurfaceBCommandApi;
  actionsDisabled: boolean;
  pendingAction: string | null;
  onToggle: () => void;
  onAction: (label: string, action: () => void | Promise<void>) => Promise<boolean>;
  onOpen: (workItemId: string) => void;
}>) {
  const head = items[0];
  return (
    <section className="workflow-group" aria-label={group.title}>
      <button
        className="workflow-group-heading"
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span className="workflow-group-heading-title">
          <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
          {group.title}
          <span className="workflow-group-count">
            ({filtered ? `${items.length} of ${total}` : total})
          </span>
        </span>
        <span className="workflow-group-rule">{group.rule}</span>
      </button>
      {collapsed ? (
        <p className="workflow-collapsed-head">
          {items.length} items — {head ? headDescription(group.key, head) : "head not recorded"}
        </p>
      ) : (
        items.map((item) => (
          <WorkRow
            key={item.workItemId}
            item={item}
            assignments={assignments}
            runner={runner}
            commands={commands}
            actionsDisabled={actionsDisabled}
            pending={pendingAction !== null}
            onAction={onAction}
            onOpen={() => onOpen(item.workItemId)}
          />
        ))
      )}
    </section>
  );
}

function WorkRow({
  item,
  assignments,
  runner,
  commands,
  actionsDisabled,
  pending,
  onAction,
  onOpen,
}: Readonly<{
  item: WorkListItem;
  assignments: readonly WorkListAssignment[];
  runner: WorkListRunner;
  commands: SurfaceBCommandApi;
  actionsDisabled: boolean;
  pending: boolean;
  onAction: (label: string, action: () => void | Promise<void>) => Promise<boolean>;
  onOpen: () => void;
}>) {
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.roleAssignmentId ?? "");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const busy = runner.state === "starting" || runner.state === "running";
  const disabled = actionsDisabled || pending || busy;
  return (
    <article
      className={`workflow-row${item.group === "your-move" ? " workflow-row-your-move" : ""}${item.hasEvidenceFailure ? " workflow-row-blocker" : ""}`}
      id={item.workItemId}
      aria-label={item.outcome}
    >
      <div className="workflow-row-main">
        <div className="workflow-row-copy">
          <h2>{item.outcome}</h2>
          <p className="workflow-row-state">
            <span>
              {item.doneVerified || (item.state !== "verified" && item.state !== "completed")
                ? humanState(item.state)
                : `${humanState(item.state)} · evidence not checked`}
            </span>
            <span aria-hidden="true">·</span>
            <span>{item.assignee ?? "Unassigned"}</span>
            <span className="workflow-revision">state {revisionLabel(item.sourceRevision)}</span>
            {item.group === "your-move" ? (
              <span className="workflow-row-wait">waiting {formatWait(item.waitingMs)}</span>
            ) : null}
            {item.partial ? <span className="workflow-warning">Partial record</span> : null}
            {(item.state === "verified" || item.state === "completed") && !item.doneVerified ? (
              <span className="workflow-warning">Not shown as done</span>
            ) : null}
            {item.hasEvidenceFailure ? (
              <span className="workflow-warning">Evidence failed</span>
            ) : null}
          </p>
        </div>
        <div className="workflow-actions">
          <button type="button" onClick={onOpen} aria-label={`Details for ${item.outcome}`}>
            Details
          </button>
          {(item.state === "draft" || item.state === "ready") && (
            <div className="workflow-assign">
              <label className="workflow-visually-hidden" htmlFor={`assign-${item.workItemId}`}>
                Assign {item.outcome}
              </label>
              <select
                id={`assign-${item.workItemId}`}
                value={assignmentId}
                onChange={(event) => setAssignmentId(event.target.value)}
                disabled={disabled || assignments.length === 0}
              >
                {assignments.map((assignment) => (
                  <option key={assignment.roleAssignmentId} value={assignment.roleAssignmentId}>
                    {assignment.label}
                  </option>
                ))}
                {assignments.length === 0 ? <option value="">No available role</option> : null}
              </select>
              <button
                type="button"
                onClick={() =>
                  void onAction(`assign:${item.workItemId}`, () =>
                    commands.onAssign(item.workItemId, assignmentId),
                  )
                }
                disabled={disabled || assignments.length === 0}
              >
                Assign
              </button>
            </div>
          )}
          {item.state === "assigned" && (
            <button
              type="button"
              onClick={() =>
                void onAction(`execute:${item.workItemId}`, () =>
                  commands.onExecute(item.workItemId),
                )
              }
              disabled={disabled || !runner.available}
              title={
                !runner.available ? "Configure the loopback runner to enable execution" : undefined
              }
            >
              {busy && runner.workItemId === item.workItemId ? "Starting…" : `Run ${item.outcome}`}
            </button>
          )}
          {item.contractAcceptsEvidence && (
            <button
              type="button"
              onClick={() => setEvidenceOpen((open) => !open)}
              disabled={disabled}
            >
              {evidenceOpen ? "Close evidence" : "Record evidence"}
            </button>
          )}
          {item.state === "active" && (
            <button
              type="button"
              onClick={() =>
                void onAction(`review:${item.workItemId}`, () => commands.onReview(item.workItemId))
              }
              disabled={disabled}
            >
              Request review
            </button>
          )}
        </div>
      </div>

      {evidenceOpen ? (
        <EvidenceForm
          item={item}
          disabled={disabled}
          onSave={(payload) =>
            onAction(`evidence:${item.workItemId}`, () =>
              commands.onEvidence(item.workItemId, payload),
            ).then(() => undefined)
          }
          onCancel={() => setEvidenceOpen(false)}
        />
      ) : null}
      <EvidenceDetails item={item} />
    </article>
  );
}

type EvidencePayload = Readonly<{
  kind: string;
  result: "passed" | "failed";
  note?: string;
  outputSha256?: string;
}>;

function EvidenceForm({
  item,
  disabled,
  onSave,
  onCancel,
}: Readonly<{
  item: WorkListItem;
  disabled: boolean;
  onSave: (payload: EvidencePayload) => Promise<void>;
  onCancel: () => void;
}>) {
  const [kind, setKind] = useState(item.evidenceObligations[0]?.kind ?? "");
  const [result, setResult] = useState<"passed" | "failed">("passed");
  const [note, setNote] = useState("");
  const [digest, setDigest] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("Recording…");
    try {
      await onSave({
        kind,
        result,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(digest.trim() ? { outputSha256: digest.trim().toLowerCase() } : {}),
      });
      setMessage("Evidence was reread from the event log.");
    } catch {
      setMessage("The log has not confirmed this evidence.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="workflow-evidence-form" onSubmit={(event) => void submit(event)}>
      <label>
        Evidence type
        <select value={kind} onChange={(event) => setKind(event.target.value)} disabled={disabled}>
          {item.evidenceObligations.map((entry) => (
            <option key={entry.kind}>{entry.kind}</option>
          ))}
        </select>
      </label>
      <label>
        Result
        <select
          value={result}
          onChange={(event) => setResult(event.target.value as "passed" | "failed")}
          disabled={disabled}
        >
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>
      </label>
      <label className="workflow-evidence-note">
        Note
        <input
          value={note}
          maxLength={280}
          onChange={(event) => setNote(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="workflow-evidence-digest">
        Saved output SHA-256 (optional)
        <input
          value={digest}
          inputMode="text"
          autoCapitalize="none"
          autoComplete="off"
          maxLength={64}
          pattern="[a-fA-F0-9]{64}"
          onChange={(event) => setDigest(event.target.value)}
          disabled={disabled}
        />
        <span className="workflow-help">
          The digest identifies saved output; it does not verify that output.
        </span>
      </label>
      {message ? <span role="status">{message}</span> : null}
      <button className="workflow-primary" type="submit" disabled={disabled || saving || !kind}>
        {saving ? "Recording…" : "Save evidence"}
      </button>
      <button type="button" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </form>
  );
}

function EvidenceDetails({ item }: Readonly<{ item: WorkListItem }>) {
  return (
    <details className="workflow-details">
      <summary>Evidence and activity · state {revisionLabel(item.sourceRevision)}</summary>
      <div className="workflow-detail-content">
        <div>
          <h3>Evidence</h3>
          {item.evidence.length > 0 ? (
            <ul>
              {item.evidence.map((evidence) => (
                <li key={evidence.eventId}>
                  {evidence.kind}: {evidence.result} · {evidenceStatusLabel(evidence)} ·{" "}
                  {revisionLabel(evidence.sourceRevision)}
                  <span className="workflow-evidence-provenance">
                    {` · source ${evidence.source ?? "missing"}; trust ${evidence.trust ?? "missing"}; run ${evidence.providerRunId ?? "missing"}; worktree SHA-256 ${evidence.worktreeSha256 ?? "missing"}; output SHA-256 ${evidence.outputSha256 ?? "missing"}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No evidence recorded yet.</p>
          )}
        </div>
        <div>
          <h3>Runtime posture</h3>
          {item.postures.length > 0 ? (
            item.postures.map((posture) => (
              <p className="workflow-posture" key={posture.eventId}>
                {`Run ${posture.runId}; requested ${posture.requested}; granted ${posture.granted}; declared ${posture.declared}; ${posture.match ? "match" : "mismatch"}; ${revisionLabel(posture.sourceRevision)}; worktree SHA-256 ${posture.worktreeSha256 ?? "missing"}`}
              </p>
            ))
          ) : (
            <p>No runtime posture recorded yet.</p>
          )}
        </div>
        <p className="workflow-last-event">
          Last signal {revisionLabel(item.lastSignalRevision)} · {item.lastEvent ?? "time missing"}
        </p>
      </div>
    </details>
  );
}

function LogView({
  entries,
  health,
  currentRevision,
  visitedRevision,
  onVisitRevision,
}: Readonly<{
  entries: readonly WorkListLogEntry[];
  health?: WorkListHealth;
  currentRevision: number;
  visitedRevision: number | null;
  onVisitRevision: (revision: number | null) => void;
}>) {
  const newestFirst = [...entries].reverse();
  return (
    <section className="workflow-log" aria-label="Event log">
      <div className="workflow-log-heading">
        <h1>Log</h1>
        <p className="workflow-showing">
          {entries.length} recorded events · current log r{currentRevision}
        </p>
      </div>
      <label className="workflow-time-travel">
        <span>Visit a log revision</span>
        <input
          aria-label="Visit a log revision"
          type="range"
          min={0}
          max={currentRevision}
          value={visitedRevision ?? currentRevision}
          onChange={(event) => {
            const revision = Number(event.target.value);
            onVisitRevision(revision === currentRevision ? null : revision);
          }}
        />
        <span className="workflow-revision">r{visitedRevision ?? currentRevision}</span>
      </label>
      {health?.issues.map((issue, index) => (
        <div className="workflow-gap" key={`${index}-${issue}`}>
          <strong>
            {health.revision > health.projectedRevision
              ? `r${health.projectedRevision + 1}–r${health.revision} · unreadable or inconsistent`
              : "Unreadable or inconsistent record"}
          </strong>
          <p>{issue} · no state is inferred across this issue.</p>
        </div>
      ))}
      {newestFirst.length === 0 ? (
        <p className="workflow-empty">No events are recorded in this log.</p>
      ) : (
        <ol className="workflow-log-list">
          {newestFirst.map((entry) => (
            <li
              className={`workflow-log-entry${visitedRevision !== null && entry.revision > visitedRevision ? " is-later" : ""}`}
              key={entry.eventId}
            >
              <span className="workflow-revision">r{entry.revision}</span>
              {visitedRevision === entry.revision ? (
                <strong className="workflow-here">◀ you are here</strong>
              ) : null}
              <span>{entry.summary}</span>
              <small>
                {entry.kind} · {entry.source} · {entry.trust} ·{" "}
                {entry.workItemId ?? "project event"}
              </small>
              <time dateTime={entry.occurredAt}>{entry.occurredAt}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const value = window.sessionStorage.getItem("your-move:collapsed-groups");
    const parsed: unknown = value ? JSON.parse(value) : {};
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
        ),
      );
    }
  } catch {
    // Session storage may be unavailable; collapse remains an in-memory display preference.
  }
  return {};
}

function headDescription(group: WorkListGroupKey, item: WorkListItem): string {
  const lead =
    group === "your-move"
      ? "longest waiting"
      : group === "in-progress"
        ? "most recent signal"
        : group === "queued"
          ? "oldest"
          : group === "done"
            ? "latest verified"
            : "most recent";
  return `${lead}: “${item.outcome},” ${revisionLabel(item.lastSignalRevision)}`;
}

function evidenceStatusLabel(evidence: WorkListEvidence | undefined): string {
  if (!evidence) return "Not recorded yet";
  if (evidence.status === "checked")
    return evidence.result === "passed" ? "Checked · passed" : "Checked · failed";
  if (evidence.status === "recorded") return "Recorded · not yet checked";
  return "Claimed · says it is done";
}

function humanState(state: string): string {
  return state.replaceAll("_", " ");
}

function revisionLabel(revision: number | null): string {
  return revision === null ? "revision missing" : `r${revision}`;
}

function formatWait(milliseconds: number | null): string {
  if (milliseconds === null) return "duration missing";
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}
