import type { PerceptionEvent, HostDirective } from '../contracts';

export interface HostLoop {
  onEvent(event: PerceptionEvent & { eventScore: number }): HostDirective[];
}

export function createHostLoop(opts?: {
  surfaceThreshold?: number;
  silenceBudgetMs?: number;
  now?: () => number;
}): HostLoop {
  const surfaceThreshold = opts?.surfaceThreshold ?? 0.6;
  const now = opts?.now ?? (() => Date.now());
  const silenceBudgetMs = opts?.silenceBudgetMs ?? 30000;
  // -Infinity so the first surfaced event always clears the budget and speaks.
  let lastSpeakAt = -Infinity;
  return {
    onEvent(event) {
      if (event.eventScore < surfaceThreshold) {
        // Idle is the resting behavior below the surface threshold.
        return [{ action: 'idle', spoilerSafe: true }];
      }
      const t = now();
      if (t - lastSpeakAt < silenceBudgetMs) {
        // Within the silence budget — stay quiet rather than interrupt again.
        return [{ action: 'idle', spoilerSafe: true }];
      }
      lastSpeakAt = t;
      // Surface: pick the top vantage (max lensScore) and build a SPOILER-SAFE,
      // anticipation-only utterance from SAFE fields (type + streamer) — NEVER from
      // event.narrative, which can name the outcome.
      const top = event.vantages.reduce((best, v) =>
        v.lensScore > best.lensScore ? v : best,
      );
      const who = top.streamer ?? 'this one';
      const utterance = `listen — eyes on ${who}`; // canned/placeholder for M2; M3 swaps in the live LLM line
      return [
        { action: 'speak', utterance, spoilerSafe: true },
        {
          action: 'cutTo',
          cutToVantage: { streamId: top.streamId, embedUrl: top.embedUrl },
          spoilerSafe: true,
        },
      ];
    },
  };
}
