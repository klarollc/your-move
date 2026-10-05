export type WorkflowRunnerState =
  "unavailable" | "idle" | "starting" | "running" | "completed" | "failed" | "recovery_required";

export type WorkflowRunnerStatus = Readonly<{
  available: boolean;
  state: WorkflowRunnerState;
  workItemId?: string;
}>;

export type WorkflowRunnerControl = Readonly<{
  status: () => WorkflowRunnerStatus;
  start: (
    workItemId: string,
  ) => Promise<Readonly<{ ok: true }> | Readonly<{ ok: false; code: string }>>;
  waitUntilIdle: () => Promise<void>;
}>;

export type WorkflowRunnerControlOptions = Readonly<{
  available: boolean;
  releaseLock: () => Promise<void>;
  reacquireLock: () => Promise<boolean>;
  launch: (workItemId: string) => Promise<Readonly<{ completion: Promise<number | null> }>>;
}>;

export function createWorkflowRunnerControl(
  options: WorkflowRunnerControlOptions,
): WorkflowRunnerControl {
  let state: WorkflowRunnerState = options.available ? "idle" : "unavailable";
  let workItemId: string | undefined;
  let running: Promise<void> = Promise.resolve();
  const current = (): WorkflowRunnerStatus => ({
    available: options.available && state !== "recovery_required",
    state,
    ...(workItemId ? { workItemId } : {}),
  });

  return {
    status: current,
    start: async (requestedWorkItemId) => {
      if (!options.available) return { ok: false, code: "WORKFLOW_RUNNER_UNAVAILABLE" };
      if (state === "starting" || state === "running" || state === "recovery_required") {
        return { ok: false, code: "RUNNER_ALREADY_ACTIVE" };
      }

      state = "starting";
      workItemId = requestedWorkItemId;
      try {
        await options.releaseLock();
      } catch {
        state = "failed";
        return { ok: false, code: "RUNNER_LOCK_RELEASE_FAILED" };
      }

      let child: Readonly<{ completion: Promise<number | null> }>;
      try {
        child = await options.launch(requestedWorkItemId);
      } catch {
        const reacquired = await options.reacquireLock().catch(() => false);
        state = reacquired ? "failed" : "recovery_required";
        return { ok: false, code: "RUNNER_START_FAILED" };
      }

      state = "running";
      running = child.completion
        .then(async (exitCode) => {
          const reacquired = await options.reacquireLock().catch(() => false);
          state = reacquired ? (exitCode === 0 ? "completed" : "failed") : "recovery_required";
        })
        .catch(async () => {
          const reacquired = await options.reacquireLock().catch(() => false);
          state = reacquired ? "failed" : "recovery_required";
        });
      return { ok: true };
    },
    waitUntilIdle: async () => running,
  };
}
