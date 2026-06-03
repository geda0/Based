# Progress

_Updated by the orchestrator every cycle. Cold-start source of truth — read it (and
`design-notes.md` + `backlog.md`) before doing anything, then run `pnpm verify`._

## Current feature
**M3 · Real Gemini narration** — `POST /narrate` proxy + FE integration. Backend-first,
seam-touching → **architect consult REQUIRED at DESIGN** before the first RED. See
`design-notes.md` (M3-scoped) + `backlog.md`. Scope/invariants: ADR 0003/0004.

## Status
- **Milestone:** **M2 done + accepted** (tests + tdd-critic PASS + qa-verifier 5/5 + PO sign-off). **M3 in flight** — not started; needs the DESIGN step first.
- **Layer:** frontend (M3's first BUILD layer is **backend**)
- **Phase:** — (feature boundary; M3 DESIGN next, then backend `red`)
- **Suite:** green — `pnpm verify` = 0 (frontend 19/19, backend `/health` + `cors`, e2e skipped).
- **Blocker:** none for M3 BUILD. Two navigator escalations open (see §13 in Notes) — neither blocks starting M3.

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

## Next — M3 · Real Gemini narration (backend → frontend), via the OUTER loop
Acceptance (7 layer-tagged bullets) in `design-notes.md`. Steps:
1. **DESIGN (architect, REQUIRED)** — M3 adds the `/narrate` seam + crosses layers. Architect
   confirms the request/response contract and records an ADR BEFORE the first RED. (Per the
   architect's charter this is a seam-touching feature, unlike additive M1/M2 UI.)
2. **BUILD — backend first** (`backend/src/modules/narrate/`, own zod schema): `POST /narrate` voices a
   `PerceptionEvent`'s SAFE fields via Gemini (key from env). Backend tests (mock the Gemini client):
   valid→one-line `{utterance}`; malformed→400 **and no Gemini call**; **spoiler-safety + tier-hedging**
   (anticipation-only; tier 1 plain / ≥2 hedged); **secrets-from-env INVARIANT** (`GEMINI_API_KEY`
   env-only, ignored from body, never logged/returned).
3. **BUILD — frontend**: FE calls `/narrate` (mockable at the boundary) to fill `utterance`. Tests:
   **cost-gating INVARIANT** (zero calls on idle; exactly one per surfacing event; never on a timer);
   utterance from API; on narration failure the host **stays silent** (player may still cut).
4. **tdd-critic → qa-verifier → PO accept → M4.**
Backend infra already prepped (CORS + `GEMINI_API_KEY` SSM secret — see Infrastructure). Confirm the
exact Gemini model id at DESIGN/impl. Set `layer=backend` for step 2.

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
