import type { PerceptionEvent, HostDirective } from '../contracts';
import type { HostLoop } from './host-loop';
import type { NarrateClient, NarrateInput } from './narrate-client';

export function createNarratingHostLoop(
  loop: HostLoop,
  narrate: NarrateClient,
): {
  onEvent(event: PerceptionEvent & { eventScore: number }): Promise<HostDirective[]>;
} {
  return {
    async onEvent(event) {
      const directives = loop.onEvent(event);
      // Cost-gate: only spend an LLM call when the loop actually surfaced (spoke),
      // never on the idle firehose.
      if (directives.some((d) => d.action === 'speak')) {
        try {
          const utterance = await narrate(buildInput(event));
          if (!utterance.trim()) {
            // Empty/blank narration = no-speak: a blank "speaking" host is worse
            // than silence (silence-budget spirit). Drop the speak; keep the cutTo
            // so the player can still cut to the vantage.
            return directives.filter((d) => d.action !== 'speak');
          }
          return directives.map((d) =>
            d.action === 'speak' ? { ...d, utterance } : d,
          );
        } catch {
          // Narration failed — a broken/empty line is worse than silence
          // (silence-budget spirit). Drop the speak; keep the cutTo so the
          // player can still cut to the vantage.
          return directives.filter((d) => d.action !== 'speak');
        }
      }
      return directives;
    },
  };
}

function buildInput(event: PerceptionEvent & { eventScore: number }): NarrateInput {
  const top = event.vantages.reduce((best, v) =>
    v.lensScore > best.lensScore ? v : best,
  );
  return {
    type: event.type,
    narrative: event.narrative,
    confidenceTier: event.confidenceTier,
    streamer: top.streamer,
    eventScore: event.eventScore,
  };
}
