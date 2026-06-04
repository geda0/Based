import type { PerceptionEvent, RankedFeed } from '../contracts';

// Weights are a tunable M4 choice — novelty/legibility/confidence carry enough
// mass to let a high-quality, top-tier event overcome a modest heat-delta edge.
const W_HEAT        = 0.40;
const W_NOVELTY     = 0.25;
const W_LEGIBILITY  = 0.20;
const W_CONFIDENCE  = 0.15;

function confidenceFactor(tier: 1 | 2 | 3 | 4): number {
  // tier 1 = best → 1.0; tier 4 = weakest → 0.25
  return (5 - tier) / 4;
}

export function computeEventScore(event: PerceptionEvent): number {
  return (
    W_HEAT       * event.heatDelta +
    W_NOVELTY    * event.novelty +
    W_LEGIBILITY * event.legibility +
    W_CONFIDENCE * confidenceFactor(event.confidenceTier)
  );
}

export function rankFeed(events: PerceptionEvent[]): RankedFeed {
  const scored = events.map((ev) => ({
    ...ev,
    eventScore: computeEventScore(ev),
  }));

  scored.sort((a, b) => b.eventScore - a.eventScore);

  return { events: scored };
}
