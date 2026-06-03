# 0005 — Staging deployment (AWS)

## Status
Accepted (prototype phase). Deployment/ops decision; does **not** change the §6
contract seams (ADR 0003/0004). Append-only.

## Context
The Based prototype needs a live, shareable **staging** environment so the
navigator and stakeholders can "see it live this week" (brief goal) rather than
only on localhost. The app is two pieces: a Vite static SPA (`frontend/`) and a
Fastify HTTP server (`backend/`, currently `/health`; the Gemini `/narrate` proxy
lands at M3). We want a conventional, reproducible deploy that is cheap to stand
up and trivial to tear down, with no persistence and no auth (both out of scope
per ADR 0003 / brief §15).

## Decision
Host on **AWS**, region **us-east-2**, defined as **CloudFormation** and driven by
shell scripts in `infra/`:

- **Frontend** — `vite build` output synced to a **private S3** bucket
  (public access blocked, SSE-AES256, `BucketOwnerEnforced`), served by
  **CloudFront** over HTTPS via **Origin Access Control**. CloudFront maps SPA
  client-side routes by serving `/index.html` for **403/404** (`CustomErrorResponses`).
  Deploy builds the SPA with `VITE_API_BASE_URL` set to the live backend URL,
  `aws s3 sync --delete`s it, and invalidates the CloudFront cache.
- **Backend** — packaged by `infra/backend.Dockerfile` (Node 22, runs
  `tsx src/server.ts`, binds `0.0.0.0:8080`, serves `GET /health`), pushed to
  **ECR**, and run on **AWS App Runner** (0.25 vCPU / 0.5 GB), health-checked at
  `/health`. App Runner pulls from ECR via a scoped service access role
  (`AWSAppRunnerServicePolicyForECRAccess`); auto-deployments are off (deploys are
  explicit).
- **Two stacks, ordered:** `infra/ecr.yaml` first (so the image exists before the
  service references it), then `infra/staging.yaml` (S3 + CloudFront + OAC +
  App Runner + IAM access role). `infra/deploy-staging.sh` runs the whole pipeline
  idempotently (ECR → build+push image tagged `<git-sha>-<timestamp>` → infra stack
  → build+sync SPA → invalidate); `infra/destroy-staging.sh` empties the bucket +
  ECR images, then deletes both stacks.

## Consequences
- One command stands up or updates the full environment; one command tears it down.
- **App Runner bills while running** (provisioned 0.25 vCPU / 0.5 GB), unlike a
  scale-to-zero Lambda. S3 + CloudFront are pay-per-use (pennies idle).
  `destroy-staging.sh` zeroes staging cost — the intended posture between demos.
- The contract seam is untouched: this is purely how the existing `frontend/` and
  `backend/` artifacts are hosted. Swapping mock perception for real, or anything in
  §6, is unaffected.
- **M3 follow-ups** (when the Gemini `/narrate` proxy lands):
  - Inject `GEMINI_API_KEY` via App Runner **`RuntimeEnvironmentSecrets`** sourced
    from **SSM Parameter Store / Secrets Manager** — never a template literal — plus
    an App Runner **instance role** with read access to that secret. This keeps the
    secrets-from-env invariant (ADR 0003 #6) intact in the cloud.
  - Add **CORS** on the backend for the CloudFront origin (the SPA calls the backend
    cross-origin), or front the API through CloudFront as a second origin/behavior.
- **Security:** deploys currently use **root-account** access keys. Acceptable only
  for throwaway staging; before anything longer-lived, switch to a scoped IAM
  user/role and remove root access keys.

## Alternatives considered
- **Serverless backend (S3 + CloudFront + Lambda + API Gateway).** Scales to zero
  (near-zero idle cost) but the navigator preferred a conventional long-running
  server, and a Fastify container ports 1:1 from local dev with no handler/adapter
  reshaping. Rejected for the prototype; revisit if idle cost or burst scale matters.
- **ECS Fargate** for the container. More control, but requires a VPC, ALB, and task
  definitions — overhead unjustified for a single prototype service. **App Runner**
  gives HTTPS, health checks, and ECR pulls with none of that wiring. Rejected.
- **No staging (localhost / demo only).** Cheapest, but defeats the "see it live,
  shareable link" goal. Rejected.
