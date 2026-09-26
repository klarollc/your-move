import type { Clock } from "../turn-runner.js";

/**
 * A clock that moves only when a test says so. Timers fire in due order during `advance`, so a
 * 180-second idle limit or a 30-second backoff costs a test nothing.
 */
export function createManualClock(): Clock & {
  advance: (ms: number) => void;
  pending: () => number;
} {
  let now = 0;
  let sequence = 0;
  const timers = new Map<number, { due: number; fire: () => void }>();
  const setTimer = (ms: number, fire: () => void): (() => void) => {
    const id = ++sequence;
    timers.set(id, { due: now + ms, fire });
    return () => {
      timers.delete(id);
    };
  };
  return {
    now: () => now,
    setTimer,
    sleep: (ms) => new Promise<void>((resolve) => void setTimer(ms, resolve)),
    advance: (ms) => {
      const target = now + ms;
      for (;;) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.due <= target)
          .sort(([, left], [, right]) => left.due - right.due)[0];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].due;
        next[1].fire();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}
