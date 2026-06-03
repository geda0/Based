# Progress

_Updated by the orchestrator every cycle. Cold-start source of truth — read it (and
`design-notes.md` + `backlog.md`) before doing anything, then run `pnpm verify`._

## Current feature
**M3 · Real Gemini narration** — `POST /narrate` proxy + FE integration. Backend-first,
seam-touching → **architect consult REQUIRED at DESIGN** before the first RED. See
`design-notes.md` (M3-scoped) + `backlog.md`. Scope/invariants: ADR 0003/0004.

## Status
- **Milestone:** **M3 — qa blockers FIXED; ready for re-qa → PO accept → RELEASE `m3`.** Build + length-cap done; narration quality confirmed live (DoD #4 ✓); the 3 qa defects D1/D2/D3 are **fixed + unit-covered**.
- **Layer:** frontend
- **Phase:** — (feature boundary; **re-qa** next → PO sign-off → release)
- **Suite:** green — `pnpm verify`=0 (backend 7/7, frontend 24/24, e2e skipped).
- **Blocker:** none. ✅ D1 fixed → no more storm, `pnpm dev` is safe again. §13 tier-hedging + spoiler-across-surfaces still open (pre-external-demo only). **NEXT MILESTONE queued (navigator-chosen):** live-voice host — `gemini-3.1-flash-live-preview` (WSS + native streaming audio, replaces Web Speech; resolves §13 voice identity).

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

## Next — M3 · ACCEPT + RELEASE
**Build DONE + critic PASS** (backend 4 cycles: valid→line · 400-no-spend · secrets-from-env · spoiler/tier-prompt;
FE 4: cost-gating · utterance-from-API · failure-silent · App-wiring). 28 tests (BE 6 / FE 22), `pnpm verify`=0.
New modules: `backend/src/modules/narrate/{routes,schema,gemini-client,prompt}`, `frontend/src/lib/{narrate-client,narrating-host-loop}`, App narrates via injectable client. ADR 0006 (spoiler claim reconciled — prompt is the control).
Remaining to ACCEPT + ship:
1. **Docs:** ADR 0006 reconciled ✓ (architect). PO to fix design-notes §10 spoiler wording + tick the M3 FE bullets/checklist at accept.
2. **qa-verifier** — drive the LIVE wake→speak→cut; confirm the line is **LLM-generated** (DoD #4) + spoiler-safe + failure-degrades-to-silence. ⚠ This makes a **REAL Gemini call** (FE→`/narrate`→Gemini w/ env key). Needs the exact **Gemini model id/endpoint confirmed** — `gemini-3.1-flash` is wired; if the id/endpoint is off the call fails → host silent → no live line (so confirm against Google docs first, or qa reports "silent: model call failed"). Run `pnpm dev` (FE+BE) locally.
3. **PO accept** — triage critic follow-ups (#2 length-bound: cap+test or strike; #3 topVantage dedup→POLISH; #4 seam tripwire) + sign off M3 vs acceptance + DoD #4.
4. **RELEASE m3** (PM + dev-ops): commit + annotated tag `m3` + push + deploy to staging + verify health → `releases.md`. Runs **in parallel with M4** per the PM cadence.
§13 now live-relevant: **tier-hedging** wording (shapes the generated line — needed before external demo) + **spoiler-across-surfaces/rail** (still open). Neither blocks accept.

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
