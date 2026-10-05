import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { projectWorkList, type WorkListProjectionOptions } from "./work-list-model.js";
import {
  WorkList,
  type SurfaceBCommandApi,
  type WorkListJourney,
  type WorkListRunner,
} from "./work-list.js";

type WorkflowRunnerStatus = WorkListRunner;

type SurfaceBSession = Readonly<{
  sessionId: string;
  csrfToken: string;
  projectId: string;
  runner: WorkflowRunnerStatus;
}>;

type LogResponse = Readonly<{
  revision: number;
  events: readonly unknown[];
  truncated: boolean;
  problems: readonly unknown[];
}>;

type LogRead = WorkListProjectionOptions;

const isBusy = (state: WorkListRunner["state"]) => state === "starting" || state === "running";

function describeApiFailure(code: string): string {
  const messages: Record<string, string> = {
    WORK_ITEM_NOT_FOUND: "That work item is no longer in the event log. Refresh and try again.",
    WORK_ITEM_NOT_ASSIGNED: "Assign the work before starting it.",
    WORKFLOW_RUNNER_UNAVAILABLE: "The loopback server has no opted-in runner configuration.",
    LOG_DAMAGED: "The event log has unreadable records. No change was made.",
    RUNNER_ALREADY_ACTIVE: "A runner is already active for this project.",
    RUNNER_ACTIVE: "The runner is writing to the event log. Wait for it to finish.",
    WORKSPACE_COMMAND_STALE: "The event log changed. The list has been refreshed; try again.",
    DONE_CLAIM_MISSING: "The assigned role has not recorded a done claim yet.",
    DONE_NOT_SUPPORTED: "Review is unavailable until every evidence obligation passes.",
  };
  return messages[code] ?? `The loopback server refused that action (${code}).`;
}

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json().catch(() => ({}))) as T & { code?: unknown };
  if (!response.ok) {
    const code = typeof value.code === "string" ? value.code : `HTTP_${String(response.status)}`;
    throw new Error(describeApiFailure(code));
  }
  return value;
}

function newId(prefix: string): string {
  const suffix =
    globalThis.crypto?.randomUUID?.().replaceAll("-", "") ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${suffix}`;
}

export function WorkListPage() {
  const [session, setSession] = useState<SurfaceBSession | null>(null);
  const [events, setEvents] = useState<readonly unknown[]>([]);
  const [revision, setRevision] = useState(0);
  const [runner, setRunner] = useState<WorkListRunner>({ available: false, state: "unavailable" });
  const [logRead, setLogRead] = useState<LogRead>({
    revision: 0,
    truncated: false,
    problems: [],
    connected: false,
  });
  const [visitedRevision, setVisitedRevision] = useState<number | null>(null);
  const [journey, setJourney] = useState<WorkListJourney | null>(null);
  const priorEventsRef = useRef<readonly unknown[]>([]);
  const journeyIdRef = useRef(0);
  const [projectionNow, setProjectionNow] = useState(() => new Date().toISOString());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshLog = useCallback(async (activeSession: SurfaceBSession) => {
    try {
      const response = await fetch("/api/log", {
        headers: { "x-cuckcode-session": activeSession.sessionId },
      });
      const log = await responseJson<LogResponse>(response);
      const priorEvents = priorEventsRef.current;
      if (
        priorEvents.length > 0 &&
        log.events.length > priorEvents.length &&
        !log.truncated &&
        log.problems.length === 0 &&
        log.revision === log.events.length
      ) {
        const before = projectWorkList(priorEvents).items;
        const after = projectWorkList(log.events).items;
        const beforeById = new Map(before.map((item) => [item.workItemId, item]));
        const changed = after.find((item) => {
          const wasAttention = beforeById.get(item.workItemId)?.group === "your-move";
          return wasAttention !== (item.group === "your-move");
        });
        if (changed) {
          const direction =
            beforeById.get(changed.workItemId)?.group === "your-move" ? "departure" : "arrival";
          const source =
            direction === "arrival"
              ? document.getElementById(changed.workItemId)
              : document.querySelector<HTMLElement>(
                  `.workflow-rail-item[data-work-item-id="${changed.workItemId}"]`,
                );
          const bounds = source?.getBoundingClientRect();
          if (bounds) {
            journeyIdRef.current += 1;
            setJourney({
              id: journeyIdRef.current,
              workItemId: changed.workItemId,
              direction,
              tint: direction === "departure" && changed.doneVerified ? "moss" : "plain",
              title: changed.outcome,
              from: { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height },
            });
          }
        }
      }
      priorEventsRef.current = log.events;
      setEvents(log.events);
      setRevision(log.revision);
      setLogRead({
        revision: log.revision,
        truncated: log.truncated,
        problems: log.problems,
        connected: true,
        fetchedAt: new Date().toISOString(),
      });
    } catch (cause) {
      setLogRead((current) => ({ ...current, connected: false }));
      throw cause;
    }
  }, []);

  const refreshRunner = useCallback(async (activeSession: SurfaceBSession) => {
    const response = await fetch("/api/workflow/status", {
      headers: { "x-cuckcode-session": activeSession.sessionId },
    });
    const status = await responseJson<WorkflowRunnerStatus>(response);
    setRunner(status);
    return status;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const connect = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/session", { signal: controller.signal });
        const current = await responseJson<SurfaceBSession>(response);
        if (controller.signal.aborted) return;
        setSession(current);
        const status = await refreshRunner(current);
        if (!isBusy(status.state) && status.state !== "recovery_required") {
          await refreshLog(current);
        }
        setError(null);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "The local workflow server is unavailable.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void connect();
    return () => controller.abort();
  }, [refreshLog, refreshRunner]);

  useEffect(() => {
    const timer = setInterval(() => setProjectionNow(new Date().toISOString()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session || !isBusy(runner.state)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const status = await refreshRunner(session);
        if (cancelled) return;
        if (isBusy(status.state)) {
          timer = setTimeout(() => void poll(), 900);
        } else if (status.state === "recovery_required") {
          setError(
            "The runner could not restore the event-log lock. Stop and inspect the local runner before continuing.",
          );
        } else {
          await refreshLog(session);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not refresh runner status.");
        }
      }
    };
    timer = setTimeout(() => void poll(), 900);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refreshLog, refreshRunner, runner.state, session]);

  const sendCommand = useCallback(
    async (intent: string, targetEntityId: string, payload: Record<string, unknown>) => {
      if (!session) throw new Error("The local workflow server is not connected.");
      setError(null);
      const response = await fetch("/api/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cuckcode-session": session.sessionId,
          "x-cuckcode-csrf": session.csrfToken,
        },
        body: JSON.stringify({
          schemaVersion: 1,
          commandId: newId("surface-b"),
          projectId: session.projectId,
          expectedRevision: revision,
          actor: { actorType: "manager", actorId: "manager_surface_b" },
          intent,
          targetEntityId,
          payload,
        }),
      });
      if (response.status === 409) {
        const rejected = (await response.json().catch(() => ({}))) as { code?: unknown };
        if (rejected.code === "WORKSPACE_COMMAND_STALE") await refreshLog(session);
        throw new Error(
          describeApiFailure(typeof rejected.code === "string" ? rejected.code : "HTTP_409"),
        );
      }
      await responseJson<unknown>(response);
      await refreshLog(session);
    },
    [refreshLog, revision, session],
  );

  const onAssign: SurfaceBCommandApi["onAssign"] = async (workItemId, roleAssignmentId) => {
    try {
      await sendCommand("work.assign", workItemId, { roleAssignmentId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not assign work.");
      throw cause;
    }
  };

  const onEvidence: SurfaceBCommandApi["onEvidence"] = async (workItemId, evidence) => {
    try {
      await sendCommand("work.record_evidence", workItemId, evidence);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record evidence.");
      throw cause;
    }
  };

  const onReview: SurfaceBCommandApi["onReview"] = async (workItemId) => {
    try {
      await sendCommand("work.request_review", workItemId, {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request review.");
      throw cause;
    }
  };

  const onExecute: SurfaceBCommandApi["onExecute"] = async (workItemId) => {
    if (!session) {
      setError("The local workflow server is not connected.");
      return;
    }
    setError(null);
    try {
      const response = await fetch("/api/workflow/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cuckcode-session": session.sessionId,
          "x-cuckcode-csrf": session.csrfToken,
        },
        body: JSON.stringify({ workItemId }),
      });
      const result = await responseJson<{ runner: WorkflowRunnerStatus }>(response);
      setRunner(result.runner);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The runner could not start.");
      try {
        await refreshRunner(session);
      } catch {
        // The original start refusal is the useful surface message.
      }
      throw cause;
    }
  };

  const projection = useMemo(
    () =>
      projectWorkList(events, {
        ...logRead,
        now: projectionNow,
      }),
    [events, logRead, projectionNow],
  );
  const visibleProjection = useMemo(() => {
    if (visitedRevision === null) return projection;
    const prefixLength = Math.max(0, Math.min(visitedRevision, projection.log.length));
    return projectWorkList(events.slice(0, prefixLength), {
      ...logRead,
      revision: visitedRevision,
      now: projectionNow,
    });
  }, [events, logRead, projection, projectionNow, visitedRevision]);

  const refreshFromSurface = useCallback(async () => {
    try {
      let activeSession = session;
      if (!activeSession) {
        const response = await fetch("/api/session");
        activeSession = await responseJson<SurfaceBSession>(response);
        setSession(activeSession);
      }
      await refreshLog(activeSession);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh the work log.");
    }
  }, [refreshLog, session]);

  const cancelJourney = useCallback(() => setJourney(null), []);

  return (
    <>
      {loading ? (
        <p className="workflow-connection" role="status">
          Connecting to the local work log…
        </p>
      ) : null}
      <WorkList
        projectId={session?.projectId ?? "unknown"}
        projectName={projection.projectName}
        revision={visitedRevision ?? projection.revision}
        currentRevision={projection.revision}
        visitedRevision={visitedRevision}
        onVisitRevision={setVisitedRevision}
        items={visibleProjection.items}
        assignments={visibleProjection.assignments}
        log={projection.log}
        runner={runner}
        connected={logRead.connected === true}
        actionsDisabled={
          session === null ||
          logRead.connected !== true ||
          visibleProjection.health.status !== "current" ||
          visitedRevision !== null
        }
        health={visibleProjection.health}
        onRefresh={refreshFromSurface}
        error={error}
        journey={journey}
        onCancelJourney={cancelJourney}
        onAssign={onAssign}
        onEvidence={onEvidence}
        onReview={onReview}
        onExecute={onExecute}
      />
    </>
  );
}
