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
  waitingMs: number | null;
  assignee: string | null;
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
    if (item.group === "your-move" || item.group === "done" || item.lastEvent === null)
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

  const perform = async (label: string, action: () => void | Promise<void>) => {
    setPendingAction(label);
    setActionMessage("Recording…");
    try {
      await action();
      setActionMessage(
        label.startsWith("execute:")
          ? "Runner start accepted. Progress will appear only after the event log records it."
          : "The command was accepted and the view was reread from the event log.",
      );
    } catch {
      setActionMessage(
        "The log has not confirmed this action. Check the read status before retrying.",
      );
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
    setSession({ queue: attention.map((item) => item.workItemId), cursor: 0, skipped: [] });
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
              revision={props.revision}
              onSkip={skipSessionMatter}
              onEnd={() => setSession(null)}
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
}: Readonly<{
  item: WorkListItem;
  log: readonly WorkListLogEntry[];
  revision: number;
  onBack: () => void;
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
      </section>

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
        <p className="workflow-attestation">If accepted: {attestation}</p>
        <div className="workflow-ruling-actions">
          <button
            type="button"
            disabled
            title="The shared workflow core does not yet expose this ruling command."
          >
            {item.hasEvidenceFailure ? "Accept anyway" : "Accept as done"}
          </button>
          <button
            type="button"
            disabled
            title="The shared workflow core does not yet expose this ruling command."
          >
            Send back with notes
          </button>
          <button
            type="button"
            disabled
            title="The shared workflow core does not yet expose defer and re-surface events."
          >
            Defer with reason
          </button>
        </div>
        <p className="workflow-help">
          Ruling controls are unavailable until the workflow-proof proposal adds an approved command
          and event path. Nothing is recorded from this panel.
        </p>
      </section>

      {log.some((entry) => entry.kind === "approval.recorded") ? (
        <section className="workflow-detail-section" aria-label="Ruling receipt">
          <h2>Ruling receipt</h2>
          {log
            .filter((entry) => entry.kind === "approval.recorded")
            .map((entry) => (
              <p key={entry.eventId}>
                {entry.summary} · {revisionLabel(entry.revision)}. The event records the artifact
                and evidence-version binding; it does not record who was notified or what resumed or
                stood.
              </p>
            ))}
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
  compact = false,
}: Readonly<{
  items: readonly WorkListItem[];
  revision: number;
  onOpen: (workItemId: string) => void;
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
        <article key={item.workItemId}>
          <button
            type="button"
            className="workflow-quiet-title"
            onClick={() => onOpen(item.workItemId)}
          >
            {item.outcome}
          </button>
          <p>
            No signal since {revisionLabel(item.lastSignalRevision)} ·{" "}
            {formatWait(item.lastEvent ? Date.now() - Date.parse(item.lastEvent) : null)} ·
            evaluated at current time against r{revision}
          </p>
          <div className="workflow-quiet-actions">
            <button
              type="button"
              disabled
              title="The workflow core has no approved nudge event yet."
            >
              Send nudge
            </button>
            <button
              type="button"
              disabled
              title="The workflow core has no approved snooze event yet."
            >
              Snooze 2d
            </button>
          </div>
        </article>
      ))}
    </section>
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
      <DigestGroup title="Yours" entries={yours} onOpen={onOpen} />
      <DigestGroup title="Evidence" entries={evidence} onOpen={onOpen} />
      <DigestGroup title="Motion" entries={motion} onOpen={onOpen} />
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
  revision,
  onSkip,
  onEnd,
  onOpenDetail,
}: Readonly<{
  session: Readonly<{ queue: readonly string[]; cursor: number; skipped: readonly string[] }>;
  items: readonly WorkListItem[];
  revision: number;
  onSkip: () => void;
  onEnd: () => void;
  onOpenDetail: (workItemId: string) => void;
}>) {
  const item = items.find((entry) => entry.workItemId === session.queue[session.cursor]);
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
          <button type="button" onClick={() => onOpenDetail(item.workItemId)}>
            Open full detail
          </button>
          <div className="workflow-ruling-actions">
            <button
              type="button"
              disabled
              title="The shared workflow core does not yet expose an accept command."
            >
              Accept
            </button>
            <button
              type="button"
              disabled
              title="The shared workflow core does not yet expose a send-back command."
            >
              Send back
            </button>
            <button
              type="button"
              disabled
              title="Defer needs a reason and a re-surface event in the core."
            >
              Defer
            </button>
            <button type="button" onClick={onSkip}>
              Skip
            </button>
          </div>
          <p className="workflow-help">
            Ruling choices are disabled until the workflow-proof proposal is approved and
            implemented. Skip only changes this session’s view order.
          </p>
        </article>
      ) : (
        <div className="workflow-session-tally">
          <h1>Session tally</h1>
          <p>
            0 rulings recorded · {session.skipped.length} skipped. The log contains no ruling from
            this session.
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
  actionsDisabled,
  onStart,
  onShowAll,
}: Readonly<{
  fresh: boolean;
  revision: number;
  underwayCount: number;
  actionsDisabled: boolean;
  onStart: () => void;
  onShowAll: () => void;
}>) {
  return (
    <section className="workflow-calm" aria-label={fresh ? "No work yet" : "All clear"}>
      <span className="workflow-calm-lamp" aria-hidden="true" />
      <h2>{fresh ? "No work yet." : "Nothing needs your move."}</h2>
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
  onOpen,
  onStartSession,
  onViewAll,
}: Readonly<{
  items: readonly WorkListItem[];
  revision: number;
  stale: boolean;
  viewedId: string | null;
  quietItems: readonly WorkListItem[];
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
                {formatWait(item.waitingMs)} · {revisionLabel(item.lastSignalRevision)}
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
        <QuietSuggestions items={quietItems} revision={revision} onOpen={onOpen} compact />
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
  onAction: (label: string, action: () => void | Promise<void>) => Promise<void>;
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
  onAction: (label: string, action: () => void | Promise<void>) => Promise<void>;
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
            )
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
                  {evidence.kind}: {evidence.result} · {evidenceStatusLabel(evidence.status)} ·{" "}
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

function evidenceStatusLabel(status: WorkListEvidence["status"]): string {
  if (status === "checked") return "Verified";
  if (status === "recorded") return "Recorded — not yet checked";
  return "Claimed";
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
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
