import type { PerceptionEvent } from '../contracts';

export interface NarrateInput {
  type: PerceptionEvent['type'];
  narrative: string;
  confidenceTier: 1 | 2 | 3 | 4;
  streamer?: string;
  eventScore: number;
}

export type NarrateClient = (input: NarrateInput) => Promise<string>;

export function createNarrateClient(opts?: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): NarrateClient {
  const baseUrl = opts?.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '';
  const fetchImpl = opts?.fetchImpl ?? fetch;
  return async (input) => {
    const res = await fetchImpl(`${baseUrl}/narrate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const { utterance } = (await res.json()) as { utterance: string };
    return utterance;
  };
}
