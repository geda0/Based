import type { PerceptionEvent, Vantage } from '../contracts';

export function topVantage(event: PerceptionEvent): Vantage {
  return event.vantages.reduce((best, v) => (v.lensScore > best.lensScore ? v : best));
}
