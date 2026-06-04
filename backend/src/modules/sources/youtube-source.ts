// M5-P2 c1 — pure YouTube → PerceptionEvent mapping (ADR 0010 §3).
//
// This module is PURE: no network, no Date.now(), no secrets.
// The live Data API fetch is a separate, deferred I/O edge.
//
// `narrative` holds the UNTRUSTED video title as DATA-ONLY — it is never rendered
// by this module (ADR 0009). The rendered-path spoiler-safety guard is a later cycle.
//
// Heat/novelty/legibility curves are TUNING decisions, not seam decisions (ADR 0010 §3).
// They must stay in [0,1] and heatDelta must be monotonic in viewCount.
// Backend-local mirrors of the §6 frontend/src/contracts/index.ts types — do NOT
// cross-workspace import (ADR 0010 §2).

// --- Backend-local §6 type mirrors ---

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
  novelty: number;   // 0..1
  legibility: number; // 0..1
  confidenceTier: 1 | 2 | 3 | 4;
  source: { kind: 'video' | 'broadcast' | 'realworld' | 'original'; ref?: string };
  vantages: Vantage[];
  ts: number; // ms offset from feed start; assigned by scheduler/feed
}

// --- YouTube normalized input type ---

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
}

// --- Heat proxy (tunable — ADR 0010 §3) ---
// log10-scale: 0 views → 0.0, ~1e7 views → 1.0. Monotonic in viewCount.
function heatFromViewCount(viewCount: number): number {
  return Math.min(Math.log10(viewCount + 1) / 7, 1);
}

// --- Source abstraction ---

export interface Source {
  readonly id: string;
  fetch(): Promise<PerceptionEvent[]>;
}

export function createYouTubeSource(opts: { channelIds: string[]; apiKey?: string; fetchImpl?: typeof fetch; ttlMs?: number; now?: () => number }): Source {
  let cache: { events: PerceptionEvent[]; at: number } | null = null;
  return {
    id: 'youtube',
    async fetch() {
      const apiKey = opts.apiKey ?? process.env.YOUTUBE_API_KEY;
      if (!apiKey) return []; // secrets-from-env / no-spend: no key → no API call
      const clock = opts.now ?? Date.now;
      const ttl = opts.ttlMs ?? 15 * 60 * 1000;
      if (cache !== null && clock() - cache.at < ttl) return cache.events;
      const doFetch = opts.fetchImpl ?? fetch;
      const allVideos: YouTubeVideo[] = [];
      for (const channelId of opts.channelIds) {
        try {
          const uploadsId = 'UU' + channelId.slice(2);
          const playlistRes = await doFetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=10&key=${apiKey}`
          );
          const playlistJson = await playlistRes.json() as { items?: Array<{ snippet: { title: string; channelTitle: string; publishedAt: string }; contentDetails: { videoId: string } }> };
          const playlistItems = playlistJson.items ?? [];
          const snippetMap = new Map<string, { title: string; channelTitle: string; publishedAt: string }>();
          const videoIds: string[] = [];
          for (const item of playlistItems) {
            const videoId = item.contentDetails.videoId;
            snippetMap.set(videoId, {
              title: item.snippet.title,
              channelTitle: item.snippet.channelTitle,
              publishedAt: item.snippet.publishedAt,
            });
            videoIds.push(videoId);
          }
          if (videoIds.length === 0) continue;
          const videosRes = await doFetch(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics,status,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
          );
          const videosJson = await videosRes.json() as { items?: Array<{ id: string; statistics: { viewCount: string }; status: { embeddable: boolean }; contentDetails: { duration: string; contentRating?: { ytRating?: string } } }> };
          const videoItems = videosJson.items ?? [];
          for (const item of videoItems) {
            const meta = snippetMap.get(item.id);
            if (!meta) continue;
            // official-embeds-only invariant: skip videos that won't play in an anon embed
            if (item.status?.embeddable === false) continue;
            if (item.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') continue;
            allVideos.push({
              videoId: item.id,
              title: meta.title,
              channelTitle: meta.channelTitle,
              publishedAt: meta.publishedAt,
              viewCount: Number(item.statistics.viewCount),
            });
          }
        } catch {
          // failure-silent: one bad channel degrades to []
        }
      }
      const result = mapYouTubeVideosToEvents(allVideos);
      cache = { events: result, at: clock() };
      return result;
    },
  };
}

// --- Pure mapper ---

export function mapYouTubeVideosToEvents(videos: YouTubeVideo[]): PerceptionEvent[] {
  return videos.map((video): PerceptionEvent => {
    // `narrative` carries the untrusted title as DATA-ONLY (ADR 0009).
    // `type` is always the safe neutral member — never derived from the untrusted title.
    const heatDelta = heatFromViewCount(video.viewCount);
    // legibility: non-empty title → readable; blank → unclear.
    const legibility = video.title.trim() ? 0.8 : 0.3;
    // novelty: deterministic constant (recency tuning is a later cycle).
    const novelty = 0.7;

    const vantage: Vantage = {
      streamId: `youtube:${video.videoId}`,
      platform: 'youtube',
      // Official YouTube embed verbatim (ADR 0003 #5 / 0010 — never rewrite).
      embedUrl: `https://www.youtube.com/embed/${video.videoId}`,
      offsetSec: 0,
      lensScore: 0.9,
      streamer: video.channelTitle,
    };

    return {
      eventId: `youtube:${video.videoId}`,
      type: 'other', // safe neutral member — not derived from untrusted input
      narrative: video.title, // data-only; never rendered by this layer
      heatDelta,
      novelty,
      legibility,
      confidenceTier: 1, // seeded channel's own upload = original, highest confidence
      source: { kind: 'video', ref: `youtube:${video.channelTitle}` },
      vantages: [vantage],
      ts: 0, // assigned by scheduler/feed later
    };
  });
}
