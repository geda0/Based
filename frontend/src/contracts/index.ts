export interface Vantage {
  streamId: string;
  platform: 'twitch' | 'youtube' | 'kick' | 'tiktok';
  embedUrl: string;
  offsetSec: number;
  lensScore: number; // 0..1
  streamer?: string;
}

export interface PerceptionEvent {
  eventId: string;
  type: 'clutch' | 'reveal' | 'drama' | 'launch' | 'irl' | 'other';
  narrative: string;
  heatDelta: number; // 0..1
  novelty: number; // 0..1
  legibility: number; // 0..1
  confidenceTier: 1 | 2 | 3 | 4;
  source: { kind: 'video' | 'broadcast' | 'realworld' | 'original'; ref?: string };
  vantages: Vantage[];
  ts: number; // ms offset from feed start
}

// Output of ranking
export interface RankedFeed {
  events: Array<PerceptionEvent & { eventScore: number }>; // sorted desc by eventScore
}

// Emitted by the host loop, consumed by the UI
export interface HostDirective {
  action: 'idle' | 'speak' | 'cutTo' | 'digest';
  utterance?: string; // text → TTS
  cutToVantage?: { streamId: string; embedUrl: string };
  staging?: { fireAtMs: number }; // predictive cut timing
  spoilerSafe: true; // invariant: literally `true` — compiler rejects any non-spoiler-safe directive
}
