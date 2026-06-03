import type { PerceptionEvent } from '../contracts';

export const digest =
  "Quiet night so far — a Valorant major semifinal just went live, a speedrunner is one trick from a world record, and there's slow-building drama in a Just Chatting stream.";

export const events: PerceptionEvent[] = [
  {
    eventId: 'evt_major_semi',
    type: 'clutch',
    narrative: '1v3 retake clutch to win the round in the Valorant major semifinal',
    heatDelta: 0.91,
    novelty: 0.8,
    legibility: 0.95,
    confidenceTier: 1,
    source: { kind: 'broadcast', ref: 'valorant_official_feed' },
    vantages: [
      {
        streamId: 'vmajor_co_a',
        platform: 'twitch',
        embedUrl: 'https://player.twitch.tv/?channel=rifftrax',
        offsetSec: 6,
        lensScore: 0.92,
        streamer: 'rifftrax',
      },
      {
        streamId: 'vmajor_off',
        platform: 'twitch',
        embedUrl: 'https://player.twitch.tv/?channel=247jynxzi',
        offsetSec: 0,
        lensScore: 0.7,
        streamer: '247jynxzi',
      },
    ],
    ts: 1,
  },
  {
    eventId: 'evt_speedrun_wr',
    type: 'reveal',
    narrative: 'Speedrunner attempting the final trick for a world record, chat going wild',
    heatDelta: 0.78,
    novelty: 0.9,
    legibility: 0.9,
    confidenceTier: 2,
    source: { kind: 'original' },
    vantages: [
      {
        streamId: 'vrun_main',
        platform: 'twitch',
        embedUrl: 'https://player.twitch.tv/?channel=caedrel247',
        offsetSec: 0,
        lensScore: 0.88,
        streamer: 'caedrel247',
      },
    ],
    ts: 45000,
  },
  {
    eventId: 'evt_jc_drama',
    type: 'drama',
    narrative: 'Slow-building disagreement on a Just Chatting stream; chat is split',
    heatDelta: 0.55,
    novelty: 0.4,
    legibility: 0.7,
    confidenceTier: 3,
    source: { kind: 'original' },
    vantages: [
      {
        streamId: 'vjc_main',
        platform: 'twitch',
        embedUrl: 'https://player.twitch.tv/?channel=lirik_247',
        offsetSec: 0,
        lensScore: 0.6,
        streamer: 'lirik_247',
      },
    ],
    ts: 90000,
  },
];
