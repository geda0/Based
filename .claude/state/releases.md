# Releases — Based prototype (owned by project-manager)

_Each milestone, once PO-accepted and `pnpm verify`-green, is committed + git-tagged +
deployed to staging by the project-manager working with dev-ops. Newest first._

## Log
| Date | Milestone | Tag | Commit | Staging verified | Notes |
|------|-----------|-----|--------|------------------|-------|
| 2026-06-03 | post-m3 fix · embeds + CI single-source | _(none — patch between `m3` and LV1)_ | `ce194e7` | ✅ FE CloudFront 200 · BE `/health` 200 · App Runner `based-staging-backend` RUNNING (image `based-staging-backend:ce194e7-20260603041536`) · **`GEMINI_MODEL`=`gemini-3.1-flash-lite` shipped by CI** (no manual deploy — the CI single-source gap is closed) · live `POST /narrate` smoke 200 (real spoiler-safe line: _"Co-streamer A is holding his breath as the final duel kicks off—chat is absolutely losing it right now!"_) · embed fixes confirmed in the deployed bundle (Twitch `parent`, rail `type · streamer`) | Patch (no milestone tag) between `m3` and the upcoming **LV1** cut. **Commits:** `a66fc29` (embed fixes + ADRs 0007/0008/0009 + ADR 0003 amendment + state docs + first CI fix) and `ce194e7` (CFN always-pass correction); **HEAD=`ce194e7`**, pushed to `origin/main`, no new tag. **Embed fixes:** Twitch `parent` param correct so the player loads on the staging host; discovery-rail labels are spoiler-safe (`type · streamer`, no outcomes). **CI `GEMINI_MODEL` single-source gap CLOSED:** root cause was CFN — on a stack *update*, an **omitted** parameter retains its **stale** prior value (not the template default), so CI kept re-shipping `gemini-3.1-flash` despite the template. Fix: `GEMINI_MODEL` is now the **version-controlled default in `infra/staging.yaml`** (`gemini-3.1-flash-lite`) **and** `deploy-staging.sh` **always** passes it to CloudFormation — so CI ships the correct model with **no reliance on gitignored `backend/.env`**. Proven live (gap closed). **Deploy:** via CI ([`deploy-staging.yml` run `26863305091`](https://github.com/geda0/Based/actions/runs/26863305091)) — `pnpm verify` gate → green → deploy; **no manual `deploy-staging.sh`, no `UPDATE_IN_PROGRESS` collision**. (Note: the earlier `docs(releases): record m3` commit `ad49d56` had a CI deploy that **silently re-broke** the model to `gemini-3.1-flash`, overwriting m3's manual correction — which is why the prior "Staging (current)" snapshot was stale; this fix repaired it **and** prevents recurrence.) |
| 2026-06-02 | M3 — real Gemini narration | `m3` | `217db0b` | ✅ FE CloudFront 200 · BE `/health` 200 `{"status":"ok"}` · App Runner `based-staging-backend` RUNNING (image `based-staging-backend:217db0b-…`, has `/narrate`) · **`GEMINI_MODEL` corrected → `gemini-3.1-flash-lite`** (was the wrong 404 `gemini-3.1-flash`) · live `POST /narrate` smoke 200 (real spoiler-safe tier-hedged line) | `feat(m3): real Gemini narration — /narrate proxy + cost-gated FE integration`. PO-accepted 2026-06-02; **annotated tag `m3`** on the green milestone commit; `pnpm verify`=0 (**backend 7, frontend 24**, e2e skipped). **Pushed to `origin`** (github.com/geda0/Based): `refs/heads/main`=`217db0b` + annotated `refs/tags/m3`→`217db0b` (clean fast-forward over `0331221`; nothing extra). Secret-safe (only `backend/.env.example` tracked, key blank; real `.env` gitignored — `git status` secret-free pre-commit; key never printed). **Deploy:** the push auto-triggered CI run [`26861017913`](https://github.com/geda0/Based/actions/runs/26861017913) (`pnpm verify` gate → green → `infra/deploy-staging.sh`, **success**, sha `217db0b`) — but **CI deployed the wrong `GEMINI_MODEL` (`gemini-3.1-flash`)** because CI has no `backend/.env` to source, so the script fell back to its default. A manual `infra/deploy-staging.sh` run (local `backend/.env`=`gemini-3.1-flash-lite`) **corrected it** — first attempt collided with the in-progress CI deploy (`UPDATE_IN_PROGRESS`, exit 254, no harm: SSM key + image already refreshed); re-run after the stack settled landed `GeminiModel=gemini-3.1-flash-lite` (verified on App Runner). SSM key ARN `arn:aws:ssm:us-east-2:429844072978:parameter/based/staging/gemini-api-key` (value hidden). FE built with `VITE_API_BASE_URL`=the App Runner URL so the SPA reaches `/narrate`. **Known CI gap → follow-up below.** |
| 2026-06-02 | M0–M2 | `m2` | `eb715a6` | ✅ FE CloudFront 200 · BE `/health` 200 `{"status":"ok"}` · App Runner `based-staging-backend` RUNNING | Initial commit (`main` had 0 commits) folds M0a/M0b/M1/M2 — contracts, channel-surf shell, silent↔active host loop + staging infra. Annotated tag, green bar (`pnpm verify`=0), secret-safe (only `backend/.env.example` tracked; real `.env` gitignored). **Pushed to `origin`** (github.com/geda0/Based) 2026-06-02: branch `main` (upstream set, `refs/heads/main`=`eb715a6`) + annotated tag `m2` (`refs/tags/m2`→`eb715a6`); no auth issues, nothing pushed beyond `main`+`m2`. 102 files. |

## Staging (current — post-m3 fix / `ce194e7`)
- **Frontend:** https://d253xma588uo3l.cloudfront.net  (S3 private + CloudFront/OAC) — SPA built with `VITE_API_BASE_URL`=the backend URL, reaches `/narrate`; embed fixes live (Twitch `parent`, spoiler-safe rail labels).
- **Backend:**  https://pmf6qpvkfx.us-east-2.awsapprunner.com  (App Runner; `/health`) — image `ce194e7-20260603041536` with `POST /narrate`; **`GEMINI_MODEL`=`gemini-3.1-flash-lite`** (shipped by CI — single-source gap closed, no manual override); key from SSM SecureString.
- Region **us-east-2** · stacks `based-staging-ecr`, `based-staging` · deploy: **CI on push to `main`** (manual/break-glass: `infra/deploy-staging.sh`). The CI `GEMINI_MODEL` gap is **resolved** — CI now ships the IaC default; no manual step is needed for model-id changes.

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

## Navigator decisions (resolved)
- **Push to `origin`** — ✅ **Approved 2026-06-02** (standing approval). `m2` pushed to
  github.com/geda0/Based (branch `main` + annotated tag `m2`) by dev-ops. No longer a
  per-release call: pushing the milestone commit + `mN` tag is now standard release flow
  (see Cadence / Conventions). No open navigator decisions.

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
