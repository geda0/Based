import type { PerceptionEvent } from '../contracts';
import { events } from '../mocks/event-graph';

export interface Source {
  readonly id: string;
  fetch(): Promise<PerceptionEvent[]>;
}

export function createMockSource(): Source {
  return { id: 'mock', fetch: async () => events };
}

export interface SourceRegistry {
  fetchAll(): Promise<PerceptionEvent[]>;
}

export function createSourceRegistry(sources: Source[]): SourceRegistry {
  return {
    async fetchAll() {
      const batches = await Promise.all(sources.map((s) => s.fetch()));
      return batches.flat();
    },
  };
}

export function createRemoteSource(opts: { url: string; fetchImpl?: typeof fetch }): Source {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    id: 'remote',
    async fetch() {
      try {
        const res = await doFetch(opts.url);
        if (!res.ok) return [];
        return (await res.json()) as PerceptionEvent[];
      } catch {
        return [];
      }
    },
  };
}

export function resolveRegistry(opts: { useRemote: boolean; baseUrl?: string; fetchImpl?: typeof fetch }): SourceRegistry | undefined {
  if (!opts.useRemote) return undefined;
  const base = opts.baseUrl ?? '';
  return createSourceRegistry([
    createRemoteSource({ url: `${base}/sources/events`, fetchImpl: opts.fetchImpl }),
  ]);
}
