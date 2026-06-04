# Releases — Based prototype (owned by project-manager)

_Each milestone, once PO-accepted and `pnpm verify`-green, is committed + git-tagged +
deployed to staging by the project-manager working with dev-ops. Newest first._

## Log
| Date | Milestone | Tag | Commit | Staging verified | Notes |
|------|-----------|-----|--------|------------------|-------|
| 2026-06-04 | **M4 — two-level ranking + "while you were gone" digest** (the LAST unmet brief DoD #1) | _(none — incremental cut; not numbered-`mN`-tagged. See "Open release items" — tagging M4 `m4` is a navigator call.)_ | `c699a1e` | ✅ **FE DEPLOYED + verified** · FE CloudFront `https://d253xma588uo3l.cloudfront.net` `200` (PM re-confirmed) · BE `/health` `200 {"status":"ok"}` (PM re-confirmed) · live bundle **`index-DGjY9pqp.js`** (dev-ops byte-verified the ranker+digest in the live bundle) · digest **spoiler-safe** (the lone "world record" string in the bundle is an internal `narrative` DATA field, NEVER rendered — ADR 0009) · live voice **ON** (`VITE_LIVE_VOICE=1`) | **Status: committed (`c699a1e`, 14 ahead of origin) + FE DEPLOYED to staging — NOT pushed, NO git tag.** M4 = a REAL two-level **`eventScore` ranker** (`rankFeed`/`computeEventScore` in `frontend/src/lib/ranker.ts`, weighted blend of heatDelta/novelty/legibility/confidenceTier) **replacing the M2 `heatDelta` placeholder**, + the **"while you were gone" digest** voiced FIRST on Start before the live feed, reworded spoiler-safe. PO KICKOFF (`design-notes.md`); **NO architect** — additive on existing contracts (`RankedFeed.eventScore` + `HostDirective.action:'digest'`). `pnpm verify`=0 at the commit (**frontend 46 / backend 16**, typecheck+lint clean); critic CONCERNS → CLOSED (voiced-digest spoiler guard + multi-event cost-gating tripwire + `character.test` digest-render). **Deploy = FRONTEND-ONLY** (dev-ops, manual/break-glass `infra/deploy-staging.sh` FE path — not a CI-on-push deploy, since not pushed): FE rebuilt with the ranker + digest + `VITE_LIVE_VOICE=1`, published to S3/CloudFront, CloudFront invalidated. **Backend UNCHANGED** — App Runner keeps the LV1 image (`9b07c38-…`: live mint `/live/session` + text `/narrate`); image cached, not rebuilt. **Secrets gate CLEAN** (only `backend/.env.example` tracked; real `.env` gitignored — dev-ops confirmed `git status` secret-free pre-commit). **Open release items (see section below):** (1) **15 commits ahead of origin, NOT pushed** — push is the navigator's standing ask; the 15 = M4 `c699a1e` + 13 prior unpushed (WDC/WDC-D2/LV1/team-tactics chores) + the on-top harness chore `c20d3db` (`chore: upgrade team-tactics to 0.9.1`, HEAD); (2) **no git tag** — incremental cut, not a numbered-milestone tag; **whether to cut a `m4` annotated tag is a navigator call** (M4 IS a milestone — the last brief DoD — so it arguably warrants `m4`; PM recommends tagging `m4` at the push). **Residual experience check:** the navigator's catch-up watch-through (open the FE → Start → host delivers the digest, THEN ranked live moments) + the §13 audible — both the navigator's eye/ear at the staging URL; this verify is the HTTP surface + the byte-verified bundle. **AWAITING navigator confirm → PO accept → M4 = DONE (all brief DoDs complete).** ⚠ **Push caveat unchanged from LV1:** when these DO get pushed, the FE-build flag `VITE_LIVE_VOICE=1` MUST be committed (it is, since LV1) AND CI-on-push will REBUILD the FE+backend — verify CI deploys the M4 bundle + live voice stays on. |
| 2026-06-03 | LV1 — live-voice host (BROWSER-DIRECT Gemini Live audio) | `lv1` (re-tagged) | `9b07c38` | ✅ **DEPLOYED + verified** · FE CloudFront `200` · BE `/health` `200 {"status":"ok"}` · **`POST /live/session` `200` returning `{ token, model, expiresAt, setup }` — the `setup` envelope PRESENT** (`{ setup: { model:"models/gemini-3.1-flash-live-preview", generationConfig:{responseModalities:["AUDIO"]}, systemInstruction:{…no-spoiler…} } }`; token redacted) · App Runner `based-staging-backend` **RUNNING** on the new image `9b07c38-20260603160335` · CORS allows the CloudFront origin on `/live/session` (preflight `204` + POST `200`, `access-control-allow-origin: https://d253xma588uo3l.cloudfront.net`) | **Status: committed + re-tagged + DEPLOYED to staging (no push — navigator-gated).** This is the **browser-direct** LV1 (ADR 0007 Amendment C) — it **SUPERSEDES** the relay-based `78b1d9f` previously tagged `lv1` (the tag was moved to the browser-direct HEAD). PO **re-accepted** on the browser-direct transport 2026-06-03; `pnpm verify`=0 at the tag (**backend 16, frontend 37**, e2e 1 skipped, typecheck+lint clean). **Annotated tag `lv1`** re-pointed `78b1d9f → 9b07c38` (`git tag -d lv1 && git tag -a lv1 -m "LV1 — live-voice host (browser-direct Gemini Live audio)"`). **Secrets gate CLEAN:** `backend/.env` (real `GEMINI_API_KEY`) gitignored + unstaged; no `frontend/.env.local`; only `backend/.env.example` tracked; staged-diff secret grep (`AIza`/`GEMINI_API_KEY=`/`access_token=<val>`/`auth_tokens/`) found **no real values** on either commit (the one hit was the **removed** test-fixture line `access_token=eph-123`, a stub; the `?access_token=`/`auth_tokens/…` URL-template strings are the feature); throwaway probes `backend/scripts/` gitignored. **Two commits on top of the relay-based `78b1d9f`:** (A) `053591f` `chore: upgrade teamentic to 0.5.0` (harness/kit/docs delta — `tdd-pairing→teamentic` markers, `.teamentic/` manifest, upgraded hooks, the new planner state file, + the 0.4.0 "Flagged" leftovers `.claude/tdd.config` / `.github/workflows/tdd-verify.yml` / `.claude/state/.gitkeep`); (B) `9b07c38` `refactor(lv1): browser-direct voice transport — retire relay + ECS` — `/live/session` now ALSO returns the server-built `setup` envelope (`live.routes.ts`); **DELETED** `live-relay.ts`/`live-relay.routes.ts`/`live-relay.test.ts` + removed the `@fastify/websocket`/`ws`/`@types/ws` deps (`package.json` + `pnpm-lock.yaml`); FE `live-relay-client.ts` opens Google's Live WSS **directly** (`…BidiGenerateContentConstrained?access_token=`, no relay, `binaryType='arraybuffer'`); `live-narrator.ts` sends **setup→clientContent** on `open` (cycle-7 inverted); ADR 0007 **Amendment C** + state docs. **Topology a** (browser → Google Live WSS direct): the browser mints via `/live/session`, opens Google's WSS with the server-minted ephemeral token, and sends the canonical server-built `setup` itself; the long-lived `GEMINI_API_KEY` stays SSM/`process.env`-only, server-side (only the short-lived single-use ~3-min token transits — A1's accepted posture). **Relay + ECS RETIRED/CANCELLED** (saves ~$25–30/mo + the standup; App Runner keeps only the plain-HTTP mint — it never could host WS, which is now fine). **Live voice ON in staging** via `VITE_LIVE_VOICE=1` (a non-secret build flag added to `deploy-staging.sh` step 4; **no `VITE_LIVE_RELAY_URL`** — retired). Live model `gemini-3.1-flash-live-preview` ships via the code default (`GEMINI_LIVE_MODEL` knob; NOT the App Runner `GEMINI_MODEL`, which stays `gemini-3.1-flash-lite` for the unchanged `/narrate` text path). SSM key ARN `arn:aws:ssm:us-east-2:429844072978:parameter/based/staging/gemini-api-key` (value hidden). **Deployed via `infra/deploy-staging.sh`** (Docker up; image build/push → App Runner, FE build w/ `VITE_LIVE_VOICE=1` → S3/CloudFront, invalidate). **Residual:** the §13 **audible / voice-identity** confirmation is the navigator's ear at the staging URL (a browser check — the live-voice AUDIO itself; this verify is the HTTP surface + that the mint returns `setup`). **Not pushed** (push waits for the navigator). |
| 2026-06-03 | post-m3 fix · embeds + CI single-source | _(none — patch between `m3` and LV1)_ | `ce194e7` | ✅ FE CloudFront 200 · BE `/health` 200 · App Runner `based-staging-backend` RUNNING (image `based-staging-backend:ce194e7-20260603041536`) · **`GEMINI_MODEL`=`gemini-3.1-flash-lite` shipped by CI** (no manual deploy — the CI single-source gap is closed) · live `POST /narrate` smoke 200 (real spoiler-safe line: _"Co-streamer A is holding his breath as the final duel kicks off—chat is absolutely losing it right now!"_) · embed fixes confirmed in the deployed bundle (Twitch `parent`, rail `type · streamer`) | Patch (no milestone tag) between `m3` and the upcoming **LV1** cut. **Commits:** `a66fc29` (embed fixes + ADRs 0007/0008/0009 + ADR 0003 amendment + state docs + first CI fix) and `ce194e7` (CFN always-pass correction); **HEAD=`ce194e7`**, pushed to `origin/main`, no new tag. **Embed fixes:** Twitch `parent` param correct so the player loads on the staging host; discovery-rail labels are spoiler-safe (`type · streamer`, no outcomes). **CI `GEMINI_MODEL` single-source gap CLOSED:** root cause was CFN — on a stack *update*, an **omitted** parameter retains its **stale** prior value (not the template default), so CI kept re-shipping `gemini-3.1-flash` despite the template. Fix: `GEMINI_MODEL` is now the **version-controlled default in `infra/staging.yaml`** (`gemini-3.1-flash-lite`) **and** `deploy-staging.sh` **always** passes it to CloudFormation — so CI ships the correct model with **no reliance on gitignored `backend/.env`**. Proven live (gap closed). **Deploy:** via CI ([`deploy-staging.yml` run `26863305091`](https://github.com/geda0/Based/actions/runs/26863305091)) — `pnpm verify` gate → green → deploy; **no manual `deploy-staging.sh`, no `UPDATE_IN_PROGRESS` collision**. (Note: the earlier `docs(releases): record m3` commit `ad49d56` had a CI deploy that **silently re-broke** the model to `gemini-3.1-flash`, overwriting m3's manual correction — which is why the prior "Staging (current)" snapshot was stale; this fix repaired it **and** prevents recurrence.) |
| 2026-06-02 | M3 — real Gemini narration | `m3` | `217db0b` | ✅ FE CloudFront 200 · BE `/health` 200 `{"status":"ok"}` · App Runner `based-staging-backend` RUNNING (image `based-staging-backend:217db0b-…`, has `/narrate`) · **`GEMINI_MODEL` corrected → `gemini-3.1-flash-lite`** (was the wrong 404 `gemini-3.1-flash`) · live `POST /narrate` smoke 200 (real spoiler-safe tier-hedged line) | `feat(m3): real Gemini narration — /narrate proxy + cost-gated FE integration`. PO-accepted 2026-06-02; **annotated tag `m3`** on the green milestone commit; `pnpm verify`=0 (**backend 7, frontend 24**, e2e skipped). **Pushed to `origin`** (github.com/geda0/Based): `refs/heads/main`=`217db0b` + annotated `refs/tags/m3`→`217db0b` (clean fast-forward over `0331221`; nothing extra). Secret-safe (only `backend/.env.example` tracked, key blank; real `.env` gitignored — `git status` secret-free pre-commit; key never printed). **Deploy:** the push auto-triggered CI run [`26861017913`](https://github.com/geda0/Based/actions/runs/26861017913) (`pnpm verify` gate → green → `infra/deploy-staging.sh`, **success**, sha `217db0b`) — but **CI deployed the wrong `GEMINI_MODEL` (`gemini-3.1-flash`)** because CI has no `backend/.env` to source, so the script fell back to its default. A manual `infra/deploy-staging.sh` run (local `backend/.env`=`gemini-3.1-flash-lite`) **corrected it** — first attempt collided with the in-progress CI deploy (`UPDATE_IN_PROGRESS`, exit 254, no harm: SSM key + image already refreshed); re-run after the stack settled landed `GeminiModel=gemini-3.1-flash-lite` (verified on App Runner). SSM key ARN `arn:aws:ssm:us-east-2:429844072978:parameter/based/staging/gemini-api-key` (value hidden). FE built with `VITE_API_BASE_URL`=the App Runner URL so the SPA reaches `/narrate`. **Known CI gap → follow-up below.** |
| 2026-06-02 | M0–M2 | `m2` | `eb715a6` | ✅ FE CloudFront 200 · BE `/health` 200 `{"status":"ok"}` · App Runner `based-staging-backend` RUNNING | Initial commit (`main` had 0 commits) folds M0a/M0b/M1/M2 — contracts, channel-surf shell, silent↔active host loop + staging infra. Annotated tag, green bar (`pnpm verify`=0), secret-safe (only `backend/.env.example` tracked; real `.env` gitignored). **Pushed to `origin`** (github.com/geda0/Based) 2026-06-02: branch `main` (upstream set, `refs/heads/main`=`eb715a6`) + annotated tag `m2` (`refs/tags/m2`→`eb715a6`); no auth issues, nothing pushed beyond `main`+`m2`. 102 files. |

## Staging (current — M4 / `c699a1e` FE over LV1-`9b07c38` backend; UNTAGGED, NOT pushed)
- **Frontend (M4 / `c699a1e`):** https://d253xma588uo3l.cloudfront.net  (S3 private + CloudFront/OAC) — SPA bundle **`index-DGjY9pqp.js`** built from the **M4** commit with the **two-level `eventScore` ranker** (`rankFeed`/`computeEventScore`) + the **"while you were gone" digest** (voiced first on Start, reworded spoiler-safe), `VITE_API_BASE_URL`=the backend URL, **and `VITE_LIVE_VOICE=1`** (live-voice ON; browser-direct Gemini Live audio). Reaches `/narrate` (text) + `/live/session` (mint); embed fixes live (Twitch `parent`, spoiler-safe rail labels). **No `VITE_LIVE_RELAY_URL`** — relay retired. (dev-ops byte-verified the ranker+digest live; PM re-confirmed CloudFront `200` 2026-06-04.)
- **Backend (UNCHANGED — still LV1 / `9b07c38`):**  https://pmf6qpvkfx.us-east-2.awsapprunner.com  (App Runner; `/health` `200`, PM re-confirmed) — image **`9b07c38-20260603160335`** (NOT rebuilt for M4 — M4 is FE-only; image cached) with `POST /narrate` **and `POST /live/session`** (mint returns `{ token, model, expiresAt, setup }`; the `setup` envelope present). **`GEMINI_MODEL`=`gemini-3.1-flash-lite`** (text path, IaC default via CI); the LV1 live model `gemini-3.1-flash-live-preview` ships via the `GEMINI_LIVE_MODEL` code default. Key from SSM SecureString (`arn:aws:ssm:us-east-2:429844072978:parameter/based/staging/gemini-api-key`, value hidden). CORS_ORIGINS = the CloudFront origin. **No WSS relay on App Runner** — the live path is browser→Google-direct; App Runner serves only the plain-HTTP mint.
- **Repo vs staging:** the live FE = the **M4 commit `c699a1e`**; the backend image = the LV1 commit `9b07c38`. **`origin/main`=`ce194e7` (post-m3 fix) — staging is 14 commits ahead of origin on FE, NOT pushed.** HEAD=`c20d3db` (`chore: upgrade team-tactics to 0.9.1`, on top of M4 — NOT deployed; FE deploy was cut at `c699a1e`).
- Region **us-east-2** · stacks `based-staging-ecr`, `based-staging` · deploy: **CI on push to `main`** (manual/break-glass: `infra/deploy-staging.sh`; **M4 was deployed via the manual FE path — not pushed**, same as LV1). The CI `GEMINI_MODEL` gap is **resolved** — CI ships the IaC default. **ECS Express Mode (Amendment A2) CANCELLED** — no persistent-socket host needed under topology (a).

## CI/CD (live as of 2026-06-03)
Deploys to staging are now **automated on push to `main`** — previously a manual
`infra/deploy-staging.sh` run. **Keyless** (no stored AWS keys) and **gated by `pnpm verify`**.
- **Workflow:** `.github/workflows/deploy-staging.yml` — on push to `main` (or manual
  `workflow_dispatch`); `concurrency: deploy-staging` serializes deploys.
- **Auth:** GitHub **OIDC** → assumes IAM role `based-staging-ci-deploy`
  (account `429844072978`, region `us-east-2`). No secrets in GitHub; the Gemini key
  stays in SSM (reused by the deploy script). Infra: `infra/ci-oidc.yaml` (stack `based-staging-ci`).
- **Gate:** the job runs `pnpm verify` (typecheck + lint + full suite) before deploying —
  a red bar never reaches staging.
- **Verified end-to-end (dev-ops):** run
  https://github.com/geda0/Based/actions/runs/26857612273 → **success**; staging
  redeployed (fresh image `based-staging-backend:0331221-20260603011137`), health **3/3** green.
- **CI commits on `main` (pushed, not a milestone — no tag):** `461c1d0` (workflow) +
  `0331221` (pnpm-version fix, derives pnpm from `packageManager`). In-flight M3 work was
  uncommitted, so CI deployed the **m2+CI** state.

## Cadence (go-forward — CI/CD model as of 2026-06-03)
- **Release per milestone, in parallel with feature work.** The go-forward flow:
  **PM gates** (PO-accepted **and** `pnpm verify` green, no unrelated mid-edit work) →
  **dev-ops commits + annotated `mN` tag** → **push `main`** → **CI auto-deploys + verifies**.
  No manual deploy for routine releases — the push **is** the deploy.
- **Deploy/verify is now CI's job.** Pushing `main` triggers
  `.github/workflows/deploy-staging.yml`: `pnpm verify` gate → `infra/deploy-staging.sh` →
  health. The PM **confirms the Actions run is green** (and health 3/3) rather than running
  the deploy by hand. `infra/deploy-staging.sh` remains the **manual/break-glass** path
  (run locally with AWS creds) for when CI is down or an out-of-band deploy is needed.
- **Push is part of every cut (navigator-approved 2026-06-02).** The milestone commit on
  `main` + the `mN` tag push to github.com/geda0/Based as part of the release — no longer
  a per-release navigator decision. Pushing `main` now also **triggers the deploy**.
- **Boundary gate (unchanged):** never push a red bar or a tree with unrelated mid-edit
  work (e.g. a parallel M3 session mid-cycle) — note CI deploys **whatever is on `main`**,
  so the gate matters more than ever. Wait for a clean boundary or coordinate. (Annotated
  tags don't trigger CI; the **push to `main`** does.)
- **Model-id changes are now CI-safe (single source of truth).** `GEMINI_MODEL` lives as the
  version-controlled default in **`infra/staging.yaml`**, and `deploy-staging.sh` **always**
  passes it to CloudFormation — so CI ships the correct model with no reliance on gitignored
  `backend/.env` and **no manual `infra/deploy-staging.sh` after the push**. To change the model
  id (e.g. LV1's `gemini-3.1-flash-live-preview`), **just update the `staging.yaml` default** in
  the milestone commit; the push deploys it. (Resolved 2026-06-03 — see the post-m3 fix row.)
- **Next:** **`m3` is shipped** (2026-06-02) and the **post-m3 embed + CI fix** is live
  (`ce194e7`, 2026-06-03 — see those rows). The next cut is **LV1 · Live-voice host**
  (`gemini-3.1-flash-live-preview` over the Live API — navigator-chosen, ahead of M4;
  **seam-touching → architect DESIGN + ADR required before BUILD**) — cut + tag + **push** its
  `mN` when PO-accepted and the bar is green; bump the `staging.yaml` `GEMINI_MODEL` default in
  that commit and the push deploys it (no manual step). M4 (two-level ranking + digest) follows.
  Same pattern each milestone.

## Navigator decisions
### Open (as of M4, 2026-06-04)
- **Push the 15 unpushed commits to `origin`** — **OPEN / the navigator's standing ask.**
  Although push was approved as standing flow 2026-06-02, the WDC→LV1→M4 run was deployed via the
  **manual** FE path and **never pushed** at the navigator's instruction (the live-voice §13 audible
  + catch-up experience are still pending the navigator's eye/ear). `origin/main`=`ce194e7`; HEAD=`c20d3db`
  is **15 ahead**: M4 `c699a1e` + 13 prior (WDC `22975c7`, WDC-D2 `78d189e`, LV1 `053591f`/`9b07c38`,
  team-tactics chores) + the on-top `c20d3db` (`chore: upgrade team-tactics to 0.9.1`). ⚠ **On push, CI
  (`deploy-staging.yml`) auto-deploys whatever is on `main` (FE + backend rebuild)** — verify the M4
  bundle ships and `VITE_LIVE_VOICE=1` stays on. Push when the navigator clears it.
- **Tag M4 `m4`?** — **OPEN / navigator + PM call.** M4 was cut as an **incremental** FE deploy and is
  currently **untagged**. But M4 IS a milestone (the LAST unmet brief DoD #1 — all brief DoDs complete on
  accept), so per the milestone-tag convention it arguably warrants an **annotated `m4`** on `c699a1e`.
  **PM recommendation:** cut the annotated `m4` tag on `c699a1e` at the push (one tag per milestone, on the
  green commit). Confirm with the navigator (also: keep `mN` or switch to semver `v0.N`).

### Resolved
- **Push to `origin`** — ✅ **Approved 2026-06-02** (standing approval). `m2` pushed to
  github.com/geda0/Based (branch `main` + annotated tag `m2`) by dev-ops. Standing release flow
  (see Cadence / Conventions) — but the WDC→LV1→M4 run is **held unpushed** pending the navigator's
  live-voice/catch-up sign-off (see Open above); push resumes when cleared.

## Follow-ups (non-blocking — owner-routed, not release blockers)
- **✅ RESOLVED 2026-06-03 — CI deployed a stale `GEMINI_MODEL` (dev-ops).** _Was: surfaced during
  the m3 cut 2026-06-02; CI re-shipped the wrong model because it had no `backend/.env` to source._
  **Root cause** turned out to be CloudFormation: on a stack *update* an **omitted** parameter
  retains its **stale** prior value (not the template default), so CI kept re-applying
  `gemini-3.1-flash`. **Fix (shipped, `ce194e7`):** `GEMINI_MODEL` is the version-controlled default
  in **`infra/staging.yaml`** (`gemini-3.1-flash-lite`) **and** `deploy-staging.sh` **always** passes
  it to CFN — single source of truth, CI-safe, no reliance on `backend/.env`. Proven live (CI run
  `26863305091`). Future model-id changes just update the `staging.yaml` default (see Cadence). No
  manual deploy step remains.
- **✅ RESOLVED — ADR for the CI/CD decision (architect).** Recorded as part of the post-m3 fix
  (commit `a66fc29` landed ADRs 0007/0008/0009 + an ADR 0003 amendment). Captures the
  GitHub Actions + OIDC, deploy-on-push-to-`main` staging delivery model alongside ADR 0005.
- **Bump GitHub Action versions (dev-ops) before 2026-06-16.** GitHub's **Node 20→24
  runner cutover** lands 2026-06-16; bump the pinned actions in
  `.github/workflows/deploy-staging.yml` — `actions/checkout`, `actions/setup-node`,
  `pnpm/action-setup`, `aws-actions/configure-aws-credentials` (all `@v4` today) — to the
  Node-24-compatible majors ahead of the cutover so CI/deploys don't break.

## Conventions
- **Tags:** milestone tags `mN` (`m0`,`m1`,`m2`,…), **annotated**, on the green commit
  that completes the milestone. (Switch to semver `v0.N` if the navigator prefers.)
  **Patches/fixes between milestones are recorded but not tagged** (e.g. the 2026-06-03
  post-m3 embed + CI fix, `ce194e7`).
- **Model id is IaC, not env.** `GEMINI_MODEL` is the version-controlled default in
  `infra/staging.yaml`; CI ships it (no `backend/.env` dependency). Change the model id
  by editing that default in the milestone commit — the push deploys it, no manual step.
- **Commits:** Conventional Commits (`docs/conventions.md`), one milestone per release commit.
- **Push:** standard part of every release (navigator-approved 2026-06-02) — push the
  milestone commit on `main` + the `mN` tag to `origin` (github.com/geda0/Based) as part
  of the cut. dev-ops verifies via `git ls-remote` that `refs/heads/main` + `refs/tags/mN`
  landed and nothing extra was pushed.
- **Secrets:** `.env`/`backend/.env` are gitignored — dev-ops verifies `git status` is secret-free before committing.
