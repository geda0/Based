# Progress

_Updated by the orchestrator every cycle. Cold-start source of truth — read it (and
`design-notes.md` + `backlog.md`) before doing anything, then run `pnpm verify`._

## Current feature
**LV1 · live-voice host (BUILD, in progress)** — swap M3's Web-Speech TTS for native
`gemini-3.1-flash-live-preview` audio over the Live WSS API. DESIGN done (ADR 0007, topology
RESOLVED). Building **backend-first against a stubbed upstream socket**. See `design-notes.md`
(LV1 KICKOFF — 12 unit-TDD + 3 qa bullets, 14-step cycle order) + `backlog.md`. Invariants: ADR 0003/0006/0007.

## Status
- **Milestone:** **LV1 · live-voice host — BUILD (in progress)** (ADR `0007-live-voice-seam`, topology RESOLVED). Replaces M3's text+Web-Speech with `gemini-3.1-flash-live-preview` over the **Live WSS API** (native streamed audio; resolves §13 voice identity). **Topology GATE CLOSED** via the navigator's reference repo `github.com/geda0/gvp`: resolved to **(b) backend WSS relay** — browsers can't set the `Authorization: Token` header the Live WSS needs, so the server mints a short-lived ephemeral token AND a backend relay opens the upstream socket (browser → relay → Google). Topology (a) browser-direct (`?access_token=`) exists in gvp but is disabled (Google close 1011). **§6 contracts + host loop UNCHANGED** — `speak()` generalizes to async `VoiceNarrator`; new backend `POST /live/session` (mint) + WSS relay; FE `live-narrator` (WS + AudioContext PCM). M0–M3 released (`m2`,`m3`).
- **Layer:** backend
- **Phase:** (between cycles — backend mint module COMPLETE + critic-hardened; next layer = backend RELAY)
- **Suite:** green — `pnpm verify`=0 (backend **7 files / 15 tests**, frontend 25/25, e2e 1 skipped, typecheck+lint clean). HEAD `ce194e7`; LV1 work is **local/uncommitted** (release infra-gated → navigator-approved ECS Express Mode).
- **LV1 BUILD progress** (against stubbed upstream; suite is the seam):
  - ✅ **cycle 1 — `buildLiveSetup` wire shape** (`backend/src/modules/live/live-setup.ts`): prefixed model id `models/gemini-3.1-flash-live-preview` + audio-only `responseModalities:['AUDIO']` (the two load-bearing Live facts; mixed modalities silently hang). GREEN.
  - ✅ **cycle 2 — `buildLiveSetup` systemInstruction**: persona + no-spoiler rule (spoiler-safety defense-in-depth). GREEN. **`buildLiveSetup` builder now complete.** (DRY: persona text duplicated with `narrate.prompt.ts` → shared-constant refactor later.)
  - ✅ **cycle 3 — `POST /live/session` mint (happy path)**: route + injected `liveMint.mintToken()` → `200 {token, model(bare), expiresAt}`; long-lived key never echoed (architect token-flow = **option B**, ADR 0007 Amendment). GREEN. + a test type-fix.
  - ✅ **cycle 4 — `/live/session` malformed→400 no-spend**: local zod `z.object({}).passthrough()` (ignores unknown keys); safeParse→400 before mint. GREEN.
  - ✅ **cycles 5–6 — `createLiveTokenClient` secrets-from-env**: (5) env-only sourcing via injectable `MintFn` (real `@google/genai` DEFERRED as a throwing `defaultMint` — the untested I/O edge); (6) rejects + no-spend if `GEMINI_API_KEY` absent (`as string` cast removed). GREEN.
  - ✅ **cycle 7 (refactor-hardening, post-critic)**: route-level secrets tripwire (bogus body key ignored + long-lived key never echoed, positive-control non-vacuous), `GEMINI_LIVE_MODEL` override coverage, env-leak fix. GREEN.
  - ✅ **tdd-critic (after cycle 6) = PASS w/ follow-ups**: HIGH route-secrets-tripwire → CLOSED in cycle 7; MEDIUM model-override + env-leak → CLOSED; deferred items → see RELEASE-PREP below.
  - **✅ BACKEND MINT MODULE COMPLETE** (`buildLiveSetup` + `POST /live/session` + `createLiveTokenClient`): secrets-from-env proven at **client + route**, malformed→400 no-spend, audio-only setup frame. 15 tests / 7 files.
  - ▶ **NEXT — the WSS RELAY** (KICKOFF #5–6): attaches `Authorization: Token <ephemeral>` + sends `setup` ONCE (stubbed upstream socket); forwards `clientContent` + pipes `serverContent` PCM back. Needs a WS-upgrade dep (`@fastify/websocket`). Then FE `VoiceNarrator` (#7–10) → integration (#11) → tdd-critic → qa (audible) → PO accept → release.
  - ⚠ **harness gap (recurring):** the run-suite hook runs vitest ONLY, not typecheck/lint — type errors slip past GREEN until `pnpm verify`. Mitigation: `pnpm verify` each cycle (doing this). Durable fix (→ POLISH): run-suite also `tsc --noEmit` the layer.

## LV1 RELEASE-PREP — untested I/O edges to WIRE before qa + staging release
Deliberately deferred "untested edges" (like M3's gemini-client `fetch`); the suite STUBS them. **Must be wired + qa-verified before LV1 qa/release:**
- **`@google/genai` mint** — `defaultMint` in `live-token-client.ts` throws "not wired"; add the dep + implement `authTokens.create` (`api_version:'v1alpha'`, `uses:1`, ~3-min open window). _(critic item 5)_
- **The relay's real upstream socket** — once the relay is built, wire the real Google Live WSS upstream (header `Authorization: Token`).
- **The FE real `AudioContext` + relay WS** — real Web-Audio PCM playback + real relay URL (`VITE_LIVE_RELAY_URL`).
- **ECS Express Mode relay host** (navigator-approved) — dev-ops stands up at release; ALB idle-timeout ~3600s + app-level WS pings; migrate-whole-backend vs separate-relay-service = PM/dev-ops call at release.
- **Deferred critic follow-ups (non-blocking):** item 2 — no-key-in-**LOGS** assertion (cross-cutting `/narrate`+`/live/session`; needs a capturing-logger helper; M3-inherited gap); item 6 — DRY persona dup in `live-setup.ts`↔`narrate.prompt.ts` (reviewed, intentionally deferred — the strings legitimately differ in register).
- **✅ INFRA DECISION — RESOLVED (navigator approved 2026-06-02):** **"Full LV1 + approve relay infra."** The WSS relay **cannot run on App Runner** (no inbound WebSocket; non-configurable 120s timeout; stateless; *and App Runner is closed to new customers / sunsetting*). → Stand up a small **ECS Express Mode** service (Fargate + auto-ALB) for the relay — reuses our ECR image + OIDC deploy, ~$25–30/mo, ~½ day, additive; doubles as the AWS-recommended App Runner migration path. **Queued for the RELEASE phase** (architect records hosting design → dev-ops scaffolds), AFTER the LV1 cycles are green — kept OUT of the inner loop to avoid shared phase/suite-status hook entanglement. LV1 BUILD proceeds now against a local/stubbed relay.
- **▶ Token-flow BUILD fork (ADR 0007 §7, "record at BUILD") — architect to resolve now (suite green):** does `POST /live/session` return the short-lived **ephemeral token** to the FE (FE hands it to the relay), or does the relay mint/hold it server-side (gvp-style session correlation), or mint on WS-upgrade? Decides the mint route's response contract (cycle 3). Long-lived `GEMINI_API_KEY` stays server-side in ALL options (the actual invariant); the choice is about the short-lived token's path + testability. Architect picks + appends to ADR 0007 before cycle 3's RED.
- ✅ **CI deploy gap — CLOSED** (`GEMINI_MODEL` now IaC-sourced in `infra/staging.yaml`, CI-proven on `ce194e7`). Model-id changes (incl. LV1's `gemini-3.1-flash-live-preview`) are CI-safe — just bump the `staging.yaml` default in the milestone commit.

## Staging demo-quality — embed fixes DEPLOYED ✅ (from the navigator's staging screenshot)
- ✅ **EMBED-TWITCH-PARENT — FIXED + DEPLOYED:** Player appends `parent=<window.location.hostname>` only for `player.twitch.tv` (ADR 0008; ADR 0003 #5 amended — required platform params allowed, still no rehost). The `[NoParent]` error is gone; real Twitch ids will now render.
- ✅ **SPOILER-HARDENING — FIXED + DEPLOYED:** rail label = `` `${type} · ${streamer}` `` via the shared `topVantage` (`frontend/src/lib/top-vantage.ts`), never the outcome-bearing narrative (ADR 0009 — **§13 spoiler-across-surfaces RESOLVED**). No on-screen outcome leak.
- ✅ **CI `GEMINI_MODEL` gap — CLOSED + DEPLOYED** (`ce194e7`, CI-deployed): the model id is now the version-controlled `infra/staging.yaml` default (`gemini-3.1-flash-lite`) and `deploy-staging.sh` always passes it (fixing the CFN "omitted param keeps stale value" gotcha) → CI ships the right model with no `.env`. Staging `GEMINI_MODEL=gemini-3.1-flash-lite`, `/narrate` smoke green. **Model-id changes are now CI-safe** (LV1 just bumps the `staging.yaml` default). Release log refreshed.
- **PLACEHOLDER-EMBEDS (demo-prep, open):** real Twitch/Kick channel ids (`EXAMPLE_*` are fake) — a content call at demo time (§13 Rights/ToS). With the parent fix, real Twitch ids now render.
- §13 remaining (pre-external-demo): **tier-hedging** wording. Voice identity → resolving via LV1. Tracked: Node 20→24 CI runner deprecation (due 2026-06-16).

## qa defects — M3 (ALL FIXED ✅ + unit-covered; re-qa pending)
_D1 ✅ stable module-level narrate client → no storm (regression test on the DEFAULT-client path: 1 call). D2 ✅ `dev` = `tsx watch --env-file=.env …` (env loads). D3 ✅ empty/whitespace utterance → no-speak (`narrating-host-loop.ts`). 24 FE + 7 BE tests, `pnpm verify`=0. Original detail below._
- **D1 [BLOCKER · cost-gating · frontend]** — `frontend/src/App.tsx` builds `createNarrateClient()` in the render body + `useEffect` dep `[narrate]` → every re-render re-subscribes the feed → unbounded `/narrate` storm (qa saw 230+ calls, 10–16/s; also leaves the character stuck "speaking"). FIX: stabilize the client (module-level default like `speak`, or `useMemo`/`useRef`) + a **regression test on the DEFAULT-client path** (stub global `fetch`, advance time, assert BOUNDED call count). The cycle-5 cost-gating unit passed only because it injected a *stable* client.
- **D2 [BLOCKER · dev wiring · backend]** — `backend` `dev` (`tsx watch src/server.ts`) doesn't load `backend/.env` → empty key/model → `/narrate`→`""` → host silent. FIX: `tsx watch --env-file=.env src/server.ts` (Node ≥20.6) or load dotenv in `server.ts`. (Staging unaffected — SSM injects env.)
- **D3 [Medium · robustness · frontend]** — empty/whitespace `utterance` (HTTP 200) isn't treated as failure → a blank `speak` is dispatched. FIX: treat empty utterance as no-speak in `frontend/src/lib/narrating-host-loop.ts` (extend the failure-silent guard).
- **qa PASSED:** DoD #4 (live lines), spoiler-safety, tier-hedging, secrets-from-env (live), no on-screen HOST spoiler — the **LLM/prompt/seam is sound**; the blockers are wiring/loop bugs. (Rail-narrative spoiler = the separate SPOILER-HARDENING item, not M3. Digest-on-load = M4.)
- **Resolved this phase:** Gemini model id fixed (`gemini-3.1-flash-lite` — `.env`/`.env.example`/client fallback); ADR 0006 spoiler claim reconciled (architect); design-notes reconciled (PO); **length-cap shipped** (~20 words). `topVantage` 3× dup + seam-tripwire → POLISH (backlog).

## Done
- **M0a ✓** — TDD harness (agents, hooks, config, state, ADR 0003, `.gitignore`). Verified.
- **Team expansion ✓** — `product-owner`/`architect`/`qa-verifier` agents + `backlog.md`;
  outer product loop wired into CLAUDE.md / AGENTS.md / tdd-workflow.md. All six agents load
  natively as of this session.
- **M0b ✓ (accepted)** — event bus + source-graph feed scheduler + §11 mock event-graph;
  architect completed the §6 seam (`RankedFeed` + `HostDirective`, literal `spoilerSafe: true`;
  ADR 0004). tdd-critic PASS.
- **M1 ✓ (accepted)** — channel-surf shell, 6 cycles:
  `ChannelRail` (list + heat meters, clickable buttons) · `Player` (iframe `src` = `embedUrl`
  verbatim → official-embeds-only) · `ChannelSurfShell` (default = top event's max-`lensScore`
  vantage; click-to-switch; manual surf) · `App` mounts the shell from the mock graph
  (placeholder `eventScore = heatDelta`; real ranking = M4). Gates: `pnpm verify`=0 (9 tests);
  tdd-critic PASS (2 minor nits → backlog "POLISH"); qa-verifier PASS on the running app
  (surf mechanics confirmed via Preview MCP; placeholder embeds blank-render as expected).
- **M2 ✓ (accepted)** — character + host loop (9 behaviors): `speak()` over Web Speech (injected/
  mockable) · `Character` idle↔speak + **auto-revert to idle** (silent↔active completes) · shell
  `cutTo` (resolves a feed vantage) + manual-surf coexists (§12.6) · `host-loop.ts` (idle-default;
  surfaces `speak`+`cutTo`; **spoiler-safety** + **silence-budget** invariants PROVEN) · `App` wires
  feed→bus→loop→character/player. Gates: `pnpm verify`=0 (19 tests); tdd-critic PASS; qa-verifier
  **5/5** live (idle→speaking→idle, cut, manual-surf override, no host-text spoiler). NB: qa filed the
  rail-spoiler defect → see Open follow-ups.
- **Harness fix:** vite glob `*.test.{ts,tsx}` (logic tests `.ts`, component tests `.tsx`).

## Next — LV1 · live-voice host (or M4)   ← M0–M3 done + released (`m3`)
PO sequenced **LV1 (live-voice host)** ahead of M4. LV1 is **seam-touching → architect DESIGN required FIRST** (before any RED):
1. **DESIGN — architect:** the WSS Live API topology for `gemini-3.1-flash-live-preview` — crucially **how the key stays server-side over a WebSocket** (server proxy vs ephemeral token; the browser must NEVER hold the raw key) + the audio pipeline replacing `speak()`. Record an ADR; re-prove **secrets-from-env over WSS**. Then PO refreshes `design-notes.md` into the LV1 KICKOFF.
2. **BUILD** (backend-first WSS proxy/session → FE audio) via the inner loop → tdd-critic → qa (audible voice + spoiler-safe) → PO accept → **RELEASE lv1**.
**Fallback-first:** if Live-audio proves heavy, do **M4** first (two-level ranking + "while you were gone" digest — pure-FE, no new external dep; M4 delivers **DoD #1**, the one unmet DoD item), then LV1.
⚠ **Before any model-id-changing release (LV1):** fix the CI deploy gap — sync `GEMINI_MODEL` to SSM (see Status / `releases.md`) or CI will ship the hardcoded fallback again.
§13 still open (pre-external-demo only): tier-hedging wording; spoiler-across-surfaces (rail).

## Open follow-ups (in backlog)
- **SPOILER-HARDENING (high):** the channel rail renders outcome-bearing `narrative` verbatim
  (`channel-rail.tsx:9`) → on-screen spoiler, inconsistent with the host's spoiler-safe utterance.
  Re-opens M1's accepted rail design → navigator §13 call (see Notes). Rec: label from `type`+`streamer`.
- **POLISH (low):** 5 nits — stale `.js` artifacts (delete + gitignore `frontend/**/*.js`); App wake
  test `act()` warning + fragile no-`act` timing; `topVantage` dup (shell+loop → shared `lib` helper);
  + 2 M1 nits (redundant `aria-valuenow`; click test could independently guard max-`lensScore`).

## Harness status (this session)
All six agents + hooks are **native and enforcing** this session. (The navigator hardened
`require-green-to-stop.sh` to re-run the layer suite when cached `suite-status` is red, before
blocking — avoids stale-cache false blocks.)

## Infrastructure / staging (deployed — outside the TDD loop)
AWS **staging is live** (architecture in ADR `docs/decisions/0005-staging-deployment.md`):
- **Frontend** https://d253xma588uo3l.cloudfront.net — S3 (private) + CloudFront/OAC. HTTP 200.
- **Backend**  https://pmf6qpvkfx.us-east-2.awsapprunner.com — App Runner (container from ECR).
  `/health` → 200 `{"status":"ok"}`; service RUNNING.
- IaC in `infra/` (CloudFormation `ecr.yaml` + `staging.yaml`); idempotent `infra/deploy-staging.sh`
  + `infra/destroy-staging.sh`. Region us-east-2, account 429844072978 (root keys — see ADR caution).
- **Build fix (kept the bar green):** the `frontend` `build` was `tsc -b`, which emits `.js` into
  `src/` → those emitted files broke `eslint` (no-undef on browser globals). Changed to
  `tsc --noEmit && vite build` (never pollutes `src`); `*.tsbuildinfo` gitignored. `pnpm verify`=0.
- **Harness gap noted:** the `run-suite` hook runs only the layer **tests**, not `lint`/`typecheck`,
  so a lint/type regression is invisible until `pnpm verify`. Keep `pnpm verify` in feature acceptance.
- **GEMINI_API_KEY + CORS wired (M3-ready):** backend has `@fastify/cors` (allowlist from
  `CORS_ORIGINS`, covered by `backend/tests/cors.test.ts`); App Runner gets `GEMINI_API_KEY` as a
  secret from an SSM SecureString (`/based/staging/gemini-api-key`) via `AppRunnerInstanceRole`,
  plus `GEMINI_MODEL` + `CORS_ORIGINS` (=CloudFront URL) env. Key lives only in `backend/.env`
  (gitignored) + SSM. Remaining for M3: implement `POST /narrate` + confirm the exact Gemini model id.

## Carry-forward risks (test at the named milestone)
- **M4:** `HostDirective.staging.fireAtMs` (ms) vs `Vantage.offsetSec` (sec) — convert
  explicitly (off-by-1000 trap); add a test.
- **M4:** `RankedFeed.events` "sorted desc by `eventScore`" — the ranker needs an ordering
  test (M1 uses a placeholder `eventScore = heatDelta`).
- **M3 (now):** cost-gating + secrets-from-env are the newly-required invariants — prove with tests
  (FE call-count: zero on idle / one per event / never on a timer; backend: key from env only, never
  in body or logs). Spoiler-safety now also means tier-aware hedging of the generated line.
- **M2 ✓ (done):** spoiler-safety + silence-budget proven by host-loop tests.

## Notes
- Cross-layer order: frontend-first; backend appears at M3 (Gemini `/narrate`).
- Narration: Gemini 3.1 Flash Live behind `POST /narrate`; key in `backend/.env`
  (`GEMINI_API_KEY`), documented empty in `.env.example`. (M3.)
- **§13 decisions (→ navigator)** — two OPEN; neither blocks starting M3:
  - **Tier-aware hedging** — ACTIVE for M3. PO rec: tier 1 plain; tiers 2–4 hedge ("looks like…");
    tier 4 explicitly unconfirmed (§10/§14). Model is stubbed in tests, so it doesn't block M3 BUILD;
    needed before showing a generated line externally.
  - **Spoiler-safety across surfaces (NEW)** — does no-spoiler bind the whole UI or only the host's
    voice? Surfaced by qa (rail leaks outcomes). PO rec: hedge the rail too (pro-creator/anti-spoiler
    moat). Re-opens M1's rail design; resolve together with tier-hedging; needed before an external
    demo with a visible rail.
  - Settled-for-now: persona (one host), voice (Web Speech), rights/embeds (placeholders → real ids
    at demo time). Re-attach before an external demo.
