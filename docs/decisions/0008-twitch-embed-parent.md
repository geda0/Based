# 0008 — Twitch embed `parent` param: Player-appends, runtime host

## Status
Accepted (prototype phase). Refines the official-embeds-only invariant
(ADR 0003 #5). Append-only.

## Context
Staging (`d253xma588uo3l.cloudfront.net`) console shows
`Twitch embed error: [NoParent] parent query string value was not specified`.
Twitch player embeds (`player.twitch.tv`) **require** a `&parent=<hostname>` query
param naming the embedding domain, or the player refuses to render. The §11 mock
Twitch `embedUrl`s omit it (`event-graph.ts` — `?channel=EXAMPLE_A`,
`?channel=EXAMPLE_RUN`), so **even a real Twitch channel will not render** on
staging or local dev without it. YouTube (`/embed/…`) and Kick do not need
`parent`; this is Twitch-specific.

The Player (`frontend/src/components/player.tsx`) renders `props.vantage.embedUrl`
**verbatim** today — the official-embeds-only / "render `embedUrl` verbatim" path
(ADR 0003 #5). So the fix touches that seam and needs an architect call.

Two placements were considered:
- **Param in the data** — each environment carries `embedUrl`s with `&parent=…`
  baked in. Couples the mock/feed data to the deploy host; needs per-environment
  data (CloudFront host vs `localhost`); a real perception backend would have to
  know the embedding domain. Rejected.
- **Player appends** (chosen) — the Player derives the host at runtime and appends
  the mandated param. One place, environment-correct without per-env data, keeps
  mock/real `embedUrl`s host-agnostic.

## Decision
- **The Player appends Twitch's required `parent` param**; the contract/feed
  `embedUrl`s stay host-agnostic.
- **Exact rule the implementer builds:**
  - **Which hosts:** only when the `embedUrl`'s host is `player.twitch.tv`. Detect
    by parsing the URL host, not by substring match on the whole string.
  - **What param(s):** append a single `parent` query param whose value is the bare
    hostname (no scheme, no port, no path) — e.g. `parent=localhost`,
    `parent=d253xma588uo3l.cloudfront.net`. Twitch wants only `parent`; do not add
    `referrer`/`autoplay`/etc. as part of this change. If the source `embedUrl`
    already carries a `parent`, do not duplicate it.
  - **Source of the host:** the **runtime** embedding host — `window.location.hostname`.
    This is env-correct by construction: `localhost` in dev, the CloudFront host on
    staging, any future custom domain automatically. No env var, no build-time host.
  - **What stays untouched:** for `player.twitch.tv` URLs, the existing host,
    `channel`/path, and all existing query params are preserved — `parent` is only
    **added**. For YouTube, Kick, TikTok, and any non-`player.twitch.tv` URL, the
    `embedUrl` is rendered **verbatim** with **no** added param.

## Consequences
- Twitch embeds render on every environment without per-env data and without
  hardcoding a host; new domains work automatically.
- official-embeds-only (ADR 0003 #5) holds: the Player renders the source's
  `embedUrl` and only **appends** the platform's required param — host, channel,
  and path are unchanged; nothing is rehosted, proxied, or rewritten to a different
  source. **A test must prove this** on the embed path (Twitch src carries `parent`
  with the host; channel/path unchanged; non-Twitch src is byte-for-byte verbatim).
- Couples to PLACEHOLDER-EMBEDS: a real Twitch channel still needs this param, so
  "real ids + parent" land together as demo-prep.
- Tests that need a deterministic host should inject/stub `window.location.hostname`
  (jsdom) rather than asserting a live value.

## Alternatives considered
- **Param in the data / per-env `embedUrl`s** — couples data to deploy host, needs
  per-env data, and pushes embedding-domain knowledge into a future real backend.
  Rejected (see Context).
- **Build-time env var for the host** — works but is redundant with
  `window.location.hostname`, can drift from the actual serving host, and adds a
  config surface. Rejected; runtime host is self-correcting.
