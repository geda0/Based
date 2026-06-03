import type { PerceptionEvent } from '../contracts';
import type { EventBus } from './event-bus';

export interface SourceGraphFeed {
  start(): void;
  stop(): void;
}

export function createSourceGraphFeed(
  events: PerceptionEvent[],
  bus: EventBus<PerceptionEvent>,
): SourceGraphFeed {
  const timers: ReturnType<typeof setTimeout>[] = [];

  return {
    start(): void {
      for (const event of events) {
        timers.push(
          setTimeout(() => {
            bus.publish(event);
          }, event.ts),
        );
      }
    },
    stop(): void {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.length = 0;
    },
  };
}
