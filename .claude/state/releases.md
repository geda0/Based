# Releases — Based prototype (owned by project-manager)

_Each milestone, once PO-accepted and `pnpm verify`-green, is committed + git-tagged +
deployed to staging by the project-manager working with dev-ops. Newest first._

## Log
| Date | Milestone | Tag | Commit | Staging verified | Notes |
|------|-----------|-----|--------|------------------|-------|
| _pending_ | — | — | — | — | No release cut yet. **The repo has 0 commits** (git: `main`, remote `origin`=github.com/geda0/Based, nothing committed). M0–M2 are done + accepted and `pnpm verify` is green; staging is already live. A clean initial release (`git` first commit → tag `m2` → redeploy/verify) can be cut at a boundary when no session is mid-edit on M3. |

## Staging (current)
- **Frontend:** https://d253xma588uo3l.cloudfront.net  (S3 private + CloudFront/OAC)
- **Backend:**  https://pmf6qpvkfx.us-east-2.awsapprunner.com  (App Runner; `/health`)
- Region **us-east-2** · stacks `based-staging-ecr`, `based-staging` · deploy: `infra/deploy-staging.sh`

## Conventions
- **Tags:** milestone tags `mN` (`m0`,`m1`,`m2`,…), **annotated**, on the green commit
  that completes the milestone. (Switch to semver `v0.N` if the navigator prefers.)
- **Commits:** Conventional Commits (`docs/conventions.md`), one milestone per release commit.
- **Push:** to `origin` only when the PM/navigator asks (commit + tag locally by default).
- **Secrets:** `.env`/`backend/.env` are gitignored — dev-ops verifies `git status` is secret-free before committing.
