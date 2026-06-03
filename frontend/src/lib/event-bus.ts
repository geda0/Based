export interface EventBus<T> {
  publish(event: T): void;
  subscribe(handler: (event: T) => void): () => void;
}

export function createEventBus<T>(): EventBus<T> {
  const handlers = new Set<(event: T) => void>();

  return {
    publish(event: T): void {
      for (const handler of handlers) {
        handler(event);
      }
    },
    subscribe(handler: (event: T) => void): () => void {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}
