import { createYouTubeSource, type Source } from './youtube-source.js';

export const NEWS_CHANNEL_IDS = [
  'UC16niRr50-MSBwiO3YDb3RA', // BBC News
  'UChqUTb7kYRX8-EiaN3XFrSQ', // Reuters
  'UCwSNeFq42XE7DuN7_p3ySsQ', // Associated Press
  'UCoMdktPbSTixAyNGwb-UYkQ', // Sky News
  'UCeY0bbntWzzVIaj2z3QigXg', // NBC News
] as const;

export function createNewsSources(opts?: { apiKey?: string; fetchImpl?: typeof fetch }): Source[] {
  return [
    createYouTubeSource({
      channelIds: [...NEWS_CHANNEL_IDS],
      apiKey: opts?.apiKey,
      fetchImpl: opts?.fetchImpl,
    }),
  ];
}
