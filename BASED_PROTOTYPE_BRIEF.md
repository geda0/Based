# Based — Prototype Build Brief

**Audience:** coding agent(s) tasked with building a live, demoable prototype.
**Goal of this doc:** give you everything needed to build something you can *see live* this week — not a production backend. Build the experience real; mock the expensive intelligence behind clean seams.

---

## 1. What Based is

**One-liner:** An AI host who watches all of live streaming so you don't have to, and tells you where to look right now.

Live streaming is a firehose — thousands of streams across Twitch, YouTube, Kick, TikTok. Discovery today is a wall of thumbnails. Based collapses that into a lean-back, channel-surfing experience: an AI watches what's happening live, understands what each stream is *about* moment-to-moment, ranks it, and routes the good stuff into curated channels you flip through like TV.

**The product is the character, not the grid.** A ranked list is a feature. A host who has already watched everything and turns to tell you what's worth your time is a product with a face. The character is the voice of what the Live AI has already digested.

**The core mechanic: silent ↔ active.** The character starts silent ("I'm watching, nothing's peaked"). It activates when something happens ("listen — this is worth it"). The transition *is* the content. The best version mostly waits and earns its interruptions; the worst narrates constantly and becomes noise.

---

## 2. The one idea that drives the whole system

**Streams are not atomic. They are vantage points on events.**

- 200 streamers co-streaming a Valorant major = **one event**, 200 lenses.
- A streamer reacting to a YouTube video = a **vantage**; the video is the **source**.
- A breaking-news moment with many IRL streams converging = one event, many vantages.

So before spending anything on deep understanding, we cluster streams into **events** and find each event's **source**. We then understand the *event once* and inherit that understanding across all its vantages. This is what makes the system affordable, and it's the defensible part — anyone can embed players; the provenance layer is the moat.

---

## 3. Architecture — three loops + a source graph

Four stages at different clock speeds. The character is the presentation layer of all of them.

| Stage | Clock speed | Responsibility | In → Out |
|---|---|---|---|
| **Loop 1 — wide & cheap** | seconds | Heat detection across everything. No video understanding. | raw streams → heat-gated candidates |
| **Source graph** | on candidates | Cluster vantages into events; find/attach source. | candidates → events (source + vantages) |
| **Loop 2 — narrow & deep** | on hot events | Multimodal understanding of the **source** (not every vantage). Produces the one-line "what's happening". | hot events → narrated events |
| **Loop 3 — host loop** | real-time | Decide: speak? what to say? cut to which vantage? Drives TTS + character. | ranked feed → host directives |

**Discipline that keeps it cheap:** Loop 1 gates the source graph; the source graph gates Loop 2; you never run deep understanding on the full firehose. In the prototype, Loops 1–2 are mocked (see §7), but the *seams* must exist so they can be replaced with real implementations.

---

## 4. Ranking logic

### 4.1 Heat is about deltas, not levels
A mid stream *spiking* is more interesting than a huge stream coasting. Signals: rate of change in chat velocity, emote spam, clip-creation rate, viewer influx.

### 4.2 Three scores per event
- **Heat** — rate of change of engagement (not raw count).
- **Novelty** — is something happening now that wasn't a minute ago?
- **Narrative legibility** — can the AI say in one line what's happening? If it can't describe it, the host can't sell it, so it doesn't surface. (This is also a cost filter: only legible, hot events get deep analysis.)

### 4.3 Two-level ranking — this is why the host sounds natural
- **Event rank** → "what's happening right now." Scores the collapsed event across all vantages. → the host's *what*.
- **Vantage rank** → "where do I send you." Scores lenses within a hot event (best reaction, best production, biggest personality). → the host's *where*.

A good host speaks in exactly these two beats: *"Something just popped off in the Major — and X's reaction is the one to watch."*

### 4.4 Source-of-truth hierarchy (confidence tiers)
When the host states what's happening, it pulls truth from the highest available tier:

1. **Direct digital source** (official feed, original video) — highest trust.
2. **Highest-fidelity vantage** as a proxy (cleanest restream) — when no clean source exists.
3. **Consensus** across independent vantages — when several agree.
4. **Single noisy vantage** — lowest; narrate as unconfirmed.

Tier controls *how the host is allowed to talk*. Tier 1 → confident. Tiers 2–4 → hedged ("looks like…", "chat's saying…"). IRL/breaking events live in tiers 2–3 and carry the highest spoiler and misinformation risk.

---

## 5. The host loop

**Inputs:** ranked feed (events + vantages + narrative + confidence tier + time offsets).
**Outputs:** `HostDirective` stream consumed by the UI.

Behaviors:
- **Idle/silent** by default. A *silence budget* rate-limits speaking so interruptions feel earned.
- **Speak** a short, persona-voiced line when an event clears the surface threshold.
- **Cut** the player to the top-ranked vantage for that event.
- **Predictive staging (the magic trick):** because we've digested the source and know each vantage's time offset, we can predict *when* a reaction stream will hit a moment and cut to the streamer's face exactly as they react. ("Watch X in 3… 2…")
- **"While you were gone" digest** on load — catches the user up on the last hour. Solves cold start; the channel is never empty, even at 4am.

**Hard invariant — no spoilers.** Foreknowledge from the source is used only to *time* the cut, never to leak the outcome. "Watch X's reaction in three…" = magic. "X is about to get aced" = product-killer. Every directive is `spoilerSafe`.

**Principle — route value to the source.** When you can tell an original from a leech restreaming it, surface and credit the original. This makes Based structurally pro-creator (and the opposite of a piracy aggregator).

---

## 6. Data contracts (the seams)

Build agents work in parallel against these. UI only ever consumes `HostDirective` + channel state; the backend produces `PerceptionEvent → RankedFeed → HostDirective`. Swap mock for real without touching the UI.

```ts
// Emitted by the source graph (mocked in prototype, real later)
interface PerceptionEvent {
  eventId: string;
  type: 'clutch' | 'reveal' | 'drama' | 'launch' | 'irl' | 'other';
  narrative: string;          // one line: what's happening
  heatDelta: number;          // 0..1, rate of change (not level)
  novelty: number;            // 0..1
  legibility: number;         // 0..1, can we describe it?
  confidenceTier: 1 | 2 | 3 | 4;
  source: { kind: 'video' | 'broadcast' | 'realworld' | 'original'; ref?: string };
  vantages: Vantage[];
  ts: number;                 // event wall-clock ms
}

interface Vantage {
  streamId: string;
  platform: 'twitch' | 'youtube' | 'kick' | 'tiktok';
  embedUrl: string;
  offsetSec: number;          // delay behind source (drives predictive staging)
  lensScore: number;          // 0..1, vantage rank within the event
  streamer?: string;
}

// Output of ranking
interface RankedFeed {
  events: Array<PerceptionEvent & { eventScore: number }>; // sorted desc
}

// Emitted by the host loop, consumed by the UI
interface HostDirective {
  action: 'idle' | 'speak' | 'cutTo' | 'digest';
  utterance?: string;                         // text → TTS
  cutToVantage?: { streamId: string; embedUrl: string };
  staging?: { fireAtMs: number };             // predictive cut timing
  spoilerSafe: true;                          // invariant, always true
}
```

---

## 7. Prototype scope — real vs mocked

**Definition of "live" for the demo:** the *experience* is real and convincing; the perception backend is faked behind the contracts above.

| Component | Prototype approach |
|---|---|
| Channel-surf UI | **REAL.** Player area + channel rail; user can flip channels anytime. |
| Live content | **REAL embeds** of a few streams (Twitch/YouTube iframes) — or pre-recorded HLS loops for demo reliability. Never rehost; official embeds only. |
| The character | **REAL.** Rendered, with `idle` and `active/speak` animation states driven by `HostDirective`. |
| Host voice | **REAL.** Web Speech API TTS to start (free, instant); swappable for a TTS API. |
| Host narration | **REAL AI.** LLM turns a `PerceptionEvent`'s text fields into a persona-voiced line. This makes "Live AI understands and narrates" *genuinely true* in the demo. |
| Firehose / Loop 1 | **MOCK.** A scripted event feed emits `PerceptionEvent`s on a timeline. (Stretch: poll one real platform API for crude real heat on a few streams.) |
| Source graph | **MOCK.** Hand-authored event-graph JSON with sources + vantages + offsets. |
| Loop 2 (video understanding) | **MOCK.** `narrative` text is pre-authored per event; the LLM voices it. The expensive multimodal step is faked by feeding text descriptions. |

**Why this is honest:** the claim being tested is "an AI host makes live discovery feel like TV." That's fully demonstrated. Real perception is an engineering scale problem to solve *after* the experience is validated.

---

## 8. Recommended stack (optimize for speed-to-live)

- **React + Vite + TypeScript** — contracts in §6 as shared types.
- **State / event bus** — Zustand or a tiny emitter. The mock backend pushes `HostDirective`s onto it.
- **Stream embeds** — Twitch/YouTube iframe embeds, or `<video>` + HLS for recorded loops in a controlled demo.
- **Character** — for prototype speed use a **2D rig (Rive or Lottie)** or even state-driven SVG/CSS; defer 3D (Three.js) until the experience is proven. Two states minimum: `idle`, `speaking`.
- **TTS** — `window.speechSynthesis` first; abstract behind a `speak(text)` interface for later swap.
- **LLM narration** — call the model with a tight persona system prompt (see §10). Fire it *only on events*, never continuously, to mirror the real cost-gating.

---

## 9. Build plan — every milestone is independently demoable

**M0 · Skeleton + contracts.** Repo, shared types (§6), event bus, mock event-graph JSON (§11). *Demo: events flow through the bus (console).*

**M1 · Channel-surf shell.** Player + channel rail; plays real embeds from mock vantages; user flips channels. *Demo: surf 3 channels of real live content.*

**M2 · The character, silent ↔ active.** Render character; subscribe to `HostDirective`; idle pose + activate/speak with TTS; cut player to the directed vantage. *Demo: character wakes up, says a line, cuts you to a stream.*

**M3 · Real AI narration.** Replace canned utterances with an LLM call that voices each `PerceptionEvent` in persona (§10). *Demo: same flow, but lines are generated live and feel alive.*

**M4 · Two-level ranking + "while you were gone."** Mock source graph emits multiple events with vantages; ranker picks event + best vantage; on load the host plays a catch-up digest. *Demo: open at "4am," get caught up, then live moments surface.*

**M5 (stretch) · Thin real heat.** Poll one platform's public API for live metadata/viewer counts on a handful of tracked streams; compute a crude real `heatDelta`; feed one *real* event into the otherwise-mocked graph. *Demo: a genuinely real moment surfaces alongside scripted ones.*

---

## 10. Host LLM system prompt (starting point)

```
You are the host of "Based" — a live-TV channel for the streaming internet.
You have already watched everything happening live right now.
Your job: in ONE short, punchy line (max ~20 words), tell the viewer what's
happening and why they should look, then we cut them there.

Voice: sharp, warm, a little hype, never cringe. Like a friend who has great taste
and great timing. You mostly stay quiet — when you speak, it matters.

You will be given: {type, narrative, confidenceTier, streamer, eventScore}.

Rules:
- NEVER spoil an outcome. You may build anticipation ("watch this") but never
  reveal what's about to happen. Foreknowledge is for timing, not leaking.
- Match your confidence to confidenceTier: tier 1 = state it plainly;
  tiers 2-4 = hedge ("looks like", "chat's losing it over").
- Credit the source/original streamer, never a re-streamer.
- One line. No preamble. No emoji. No hashtags.
```

---

## 11. Sample mock event-graph payload

Drop this into the mock source graph so the prototype always has something to surface (and never an empty channel).

```json
{
  "generatedAt": "2026-06-02T04:00:00Z",
  "digest": "Quiet night so far — a Valorant major semifinal just went live, a speedrunner is one trick from a world record, and there's slow-building drama in a Just Chatting stream.",
  "events": [
    {
      "eventId": "evt_major_semi",
      "type": "clutch",
      "narrative": "1v3 retake clutch to win the round in the Valorant major semifinal",
      "heatDelta": 0.91, "novelty": 0.8, "legibility": 0.95, "confidenceTier": 1,
      "source": { "kind": "broadcast", "ref": "valorant_official_feed" },
      "vantages": [
        { "streamId": "vmajor_co_a", "platform": "twitch", "embedUrl": "https://player.twitch.tv/?channel=EXAMPLE_A", "offsetSec": 6, "lensScore": 0.92, "streamer": "Co-streamer A" },
        { "streamId": "vmajor_off",  "platform": "youtube", "embedUrl": "https://www.youtube.com/embed/EXAMPLE_OFFICIAL", "offsetSec": 0, "lensScore": 0.7, "streamer": "Official" }
      ],
      "ts": 1
    },
    {
      "eventId": "evt_speedrun_wr",
      "type": "reveal",
      "narrative": "Speedrunner attempting the final trick for a world record, chat going wild",
      "heatDelta": 0.78, "novelty": 0.9, "legibility": 0.9, "confidenceTier": 2,
      "source": { "kind": "original" },
      "vantages": [
        { "streamId": "vrun_main", "platform": "twitch", "embedUrl": "https://player.twitch.tv/?channel=EXAMPLE_RUN", "offsetSec": 0, "lensScore": 0.88, "streamer": "Original runner" }
      ],
      "ts": 45000
    },
    {
      "eventId": "evt_jc_drama",
      "type": "drama",
      "narrative": "Slow-building disagreement on a Just Chatting stream; chat is split",
      "heatDelta": 0.55, "novelty": 0.4, "legibility": 0.7, "confidenceTier": 3,
      "source": { "kind": "original" },
      "vantages": [
        { "streamId": "vjc_main", "platform": "kick", "embedUrl": "https://player.kick.com/EXAMPLE_JC", "offsetSec": 0, "lensScore": 0.6 }
      ],
      "ts": 90000
    }
  ]
}
```

---

## 12. Definition of done (the demo must show)

1. App loads → **"while you were gone" digest** plays in the host's voice.
2. Over a ~3-minute window, **at least 2 events fire**; the character transitions **silent → active** each time.
3. On each, the player **cuts to the top-ranked vantage**, and the host says a line that fits the *what + where* pattern.
4. Host lines are **LLM-generated live** (not hardcoded).
5. **No spoiler leak** — the host never names an outcome before the cut lands.
6. The user can **manually surf channels** at any point without breaking the host.

---

## 13. Decisions to surface (don't silently pick these)

- **Persistent persona vs per-channel skin.** One named host (stronger brand, merch/clip engine) vs different hosts per vibe. Affects character work — recommend committing to one persona for the prototype.
- **Rights / ToS.** Official embeds only; never rehost or restream. The "route value to source" principle should hold in the demo too.
- **Tier-aware hedging.** How aggressively the host hedges in confidence tiers 2–4, especially for IRL/breaking events (highest spoiler + misinformation risk).
- **Voice identity.** Web Speech API for the prototype; pick a real TTS voice direction before any external demo.

---

## 14. Risks & guardrails

- **Host becomes noise** → enforce a silence budget; speaking is rate-limited and threshold-gated. Idle is the default state.
- **Spoilers** → hard invariant in the host loop and system prompt; tier-gate confident narration.
- **Cost (real version)** → deep understanding only on heat-gated, legible events; never the full firehose. In the prototype, the LLM fires only on events.
- **Rights** → official embeds only; surface originals over re-streamers.

---

## 15. Explicitly out of scope for the prototype

Real-time multimodal video understanding at scale; real firehose ingestion across all platforms; real audio/perceptual-hash source matching; production source-graph clustering; auth, accounts, persistence; mobile-native. All are deferred behind the §6 contracts and can be built once the experience is validated.
