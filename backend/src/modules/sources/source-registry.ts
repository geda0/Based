import type { Source, PerceptionEvent } from "./youtube-source.js";

export interface SourceRegistry {
  fetchAll(): Promise<PerceptionEvent[]>;
}

export function createSourceRegistry(sources: Source[]): SourceRegistry {
  return {
    async fetchAll(): Promise<PerceptionEvent[]> {
      const results = await Promise.allSettled(sources.map((s) => s.fetch()));
      return results
        .filter(
          (r): r is PromiseFulfilledResult<PerceptionEvent[]> =>
            r.status === "fulfilled"
        )
        .flatMap((r) => r.value);
    },
  };
}
