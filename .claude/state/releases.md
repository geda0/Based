# Releases — Based prototype (owned by project-manager)

_Each milestone, once PO-accepted and `pnpm verify`-green, is committed + git-tagged +
deployed to staging by the project-manager working with dev-ops. Newest first._

## Log
| Date | Milestone | Tag | Commit | Staging verified | Notes |
|------|-----------|-----|--------|------------------|-------|
| 2026-06-02 | M0–M2 | `m2` | `eb715a6` | ✅ FE CloudFront 200 · BE `/health` 200 `{"status":"ok"}` · App Runner `based-staging-backend` RUNNING | Initial commit (`main` had 0 commits) folds M0a/M0b/M1/M2 — contracts, channel-surf shell, silent↔active host loop + staging infra. Annotated tag, green bar (`pnpm verify`=0), secret-safe (only `backend/.env.example` tracked; real `.env` gitignored). **Pushed to `origin`** (github.com/geda0/Based) 2026-06-02: branch `main` (upstream set, `refs/heads/main`=`eb715a6`) + annotated tag `m2` (`refs/tags/m2`→`eb715a6`); no auth issues, nothing pushed beyond `main`+`m2`. 102 files. |

## Staging (current)
- **Frontend:** https://d253xma588uo3l.cloudfront.net  (S3 private + CloudFront/OAC)
- **Backend:**  https://pmf6qpvkfx.us-east-2.awsapprunner.com  (App Runner; `/health`)
- Region **us-east-2** · stacks `based-staging-ecr`, `based-staging` · deploy: **CI on push to `main`** (manual/break-glass: `infra/deploy-staging.sh`)

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
- **Next:** cut + tag + **push** **`m3`** when M3 is PO-accepted and the bar is green (M3
  in flight, uncommitted, as of this CI go-live). CI will auto-deploy on that push; the PM
  verifies the run. Future milestones follow the same pattern (`m4`, …).

## Navigator decisions (resolved)
- **Push to `origin`** — ✅ **Approved 2026-06-02** (standing approval). `m2` pushed to
  github.com/geda0/Based (branch `main` + annotated tag `m2`) by dev-ops. No longer a
  per-release call: pushing the milestone commit + `mN` tag is now standard release flow
  (see Cadence / Conventions). No open navigator decisions.

## Follow-ups (non-blocking — owner-routed, not release blockers)
- **ADR for the CI/CD decision (architect).** Record an ADR — **next number 0007**
  (0006 is taken by the M3 narrate-seam) — for choosing **GitHub Actions + OIDC,
  deploy-on-push to `main`** as the staging delivery model. Captures the keyless-auth
  and gate-on-`pnpm verify` rationale alongside ADR 0005 (staging deployment).
- **Bump GitHub Action versions (dev-ops) before 2026-06-16.** GitHub's **Node 20→24
  runner cutover** lands 2026-06-16; bump the pinned actions in
  `.github/workflows/deploy-staging.yml` — `actions/checkout`, `actions/setup-node`,
  `pnpm/action-setup`, `aws-actions/configure-aws-credentials` (all `@v4` today) — to the
  Node-24-compatible majors ahead of the cutover so CI/deploys don't break.

## Conventions
- **Tags:** milestone tags `mN` (`m0`,`m1`,`m2`,…), **annotated**, on the green commit
  that completes the milestone. (Switch to semver `v0.N` if the navigator prefers.)
- **Commits:** Conventional Commits (`docs/conventions.md`), one milestone per release commit.
- **Push:** standard part of every release (navigator-approved 2026-06-02) — push the
  milestone commit on `main` + the `mN` tag to `origin` (github.com/geda0/Based) as part
  of the cut. dev-ops verifies via `git ls-remote` that `refs/heads/main` + `refs/tags/mN`
  landed and nothing extra was pushed.
- **Secrets:** `.env`/`backend/.env` are gitignored — dev-ops verifies `git status` is secret-free before committing.
