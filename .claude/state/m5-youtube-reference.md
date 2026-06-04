# M5 YouTube source — build reference (from research, 2026-06)

## Fetch path (server-side, cheap — NOT search.list which is 100u)
Per seeded channel (UC id), 2 units total:
1. **Uploads playlist** = the channel id with `UC`→`UU` (string swap; no `channels.list` call needed). e.g. `UC16niRr50-MSBwiO3YDb3RA` → `UU16niRr50-MSBwiO3YDb3RA`.
2. `GET /youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=<UU…>&maxResults=10&key=<KEY>` → newest-first uploads: `contentDetails.videoId`, `contentDetails.videoPublishedAt` (true upload time — prefer over `snippet.publishedAt`), `snippet.title`, `snippet.channelTitle`. (1u)
3. `GET /youtube/v3/videos?part=statistics,status,contentDetails&id=<up to 50 ids csv>&key=<KEY>` → `statistics.viewCount`, `status.embeddable` (bool — SKIP if false), `contentDetails.duration` (ISO-8601; ≤60s ≈ Short), `contentDetails.contentRating.ytRating` (`ytAgeRestricted` → SKIP — won't play in anon embed), `contentDetails.regionRestriction`. (1u)
Quota = 10,000 u/day → ~2u/channel → a handful of seed channels with a 15–30 min TTL cache is trivial. `forHandle=<handle>` (1u) resolves a handle→UC if ever needed; cache the UC.

## Normalized `YouTubeVideo` (already the c1 mapper input)
`{ videoId, title, channelTitle, publishedAt, viewCount }` → `mapYouTubeVideosToEvents` (DONE, c1). Embed = `https://www.youtube.com/embed/<videoId>`, platform `youtube`, streamer = channelTitle.

## News-default seed channels (verified UC ids)
- BBC News `@BBCNews` = `UC16niRr50-MSBwiO3YDb3RA`
- Reuters `@Reuters` = `UChqUTb7kYRX8-EiaN3XFrSQ`
- Associated Press `@AssociatedPress` = `UCwSNeFq42XE7DuN7_p3ySsQ`
- Sky News `@SkyNews` = `UCoMdktPbSTixAyNGwb-UYkQ`
- NBC News `@NBCNews` = `UCeY0bbntWzzVIaj2z3QigXg`

## Guards (invariants)
- **Secrets-from-env:** `YOUTUBE_API_KEY` from `process.env` only; no key → `fetch()` returns `[]` (no-spend, no crash). Restrict the key to YouTube Data API + server IP in the console.
- **Cost-gating:** per-source TTL cache; bounded calls (2u/channel/refresh, not a poll storm).
- **Official-embeds-only:** `youtube.com/embed/<videoId>` verbatim; SKIP `status.embeddable===false` / age-restricted / region-blocked before rendering.
- **Spoiler-safety:** untrusted title stays data-only in `narrative` (never rendered).
- **Failure-silent:** `fetch()` resolves `[]` on any upstream/HTTP error (never throws).
