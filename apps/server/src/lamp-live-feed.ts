import { sharedLampVerdictMessageSchema, type LampVerdictMessage } from "@cuckcode/contracts";

export type LampLiveFeed = Readonly<{
  publish: (message: unknown) => boolean;
  subscribe: (listener: (message: LampVerdictMessage) => void) => () => void;
  readonly subscriberCount: number;
  clear: () => void;
}>;

export function createLampLiveFeed(): LampLiveFeed {
  const subscribers = new Set<(message: LampVerdictMessage) => void>();
  const feed: LampLiveFeed = {
    publish(message: unknown): boolean {
      const parsed = sharedLampVerdictMessageSchema.safeParse(message);
      if (!parsed.success) return false;
      for (const subscriber of subscribers) {
        try {
          subscriber(parsed.data);
        } catch {
          // A disconnected socket cannot interfere with other listeners or the runner.
        }
      }
      return true;
    },
    subscribe(listener): () => void {
      subscribers.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        subscribers.delete(listener);
      };
    },
    get subscriberCount() {
      return subscribers.size;
    },
    clear() {
      subscribers.clear();
    },
  };
  return feed;
}
