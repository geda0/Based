# infra/ — Based AWS hosting (staging)

Infrastructure-as-code + deploy scripts for the Based prototype's **staging** environment.
Architecture decision recorded in `docs/decisions/0005-staging-deployment.md`.

## Topology
```
            ┌──────────── CloudFront (HTTPS, SPA) ────────────┐
 viewer ──▶ │  /*  → S3 (private, OAC)   = Vite static build  │
            └─────────────────────────────────────────────────┘
 viewer ──▶  App Runner (HTTPS)  = Fastify container (from ECR)  →  GET /health
```
- **Frontend** — `frontend/` built with `vite build`, synced to a **private S3** bucket,
  served by **CloudFront** via Origin Access Control. SPA routes fall back to `index.html`.
- **Backend** — `backend/` (Fastify) packaged by `backend.Dockerfile`, pushed to **ECR**,
  run on **App Runner** (0.25 vCPU / 0.5 GB), health-checked at `/health`.

## Files
| File | Purpose |
|---|---|
| `ecr.yaml` | CloudFormation: ECR repo (deployed first, so the image exists before App Runner). |
| `staging.yaml` | CloudFormation: S3 + CloudFront + OAC + App Runner + IAM access role. |
| `backend.Dockerfile` | Backend container (build context = repo root). |
| `deploy-staging.sh` | One command: ECR → build+push image → infra stack → build+sync SPA → invalidate. |
| `destroy-staging.sh` | Tear everything down (empties bucket + ECR first). |

## Use
```bash
# Deploy / update staging (region defaults to us-east-2):
infra/deploy-staging.sh

# Tear down (stops all staging cost):
infra/destroy-staging.sh
```
Prereqs: authenticated `aws` CLI, `docker`, `pnpm`, `node`. Override region with `AWS_REGION=...`.

## Cost (staging, idle)
S3 + CloudFront are pay-per-use (pennies). App Runner bills for the provisioned
0.25 vCPU / 0.5 GB while the service is running. Run `destroy-staging.sh` to zero it out.

## M3 wiring (done — ready for the `/narrate` proxy)
- **`GEMINI_API_KEY`** reaches App Runner as a `RuntimeEnvironmentSecret` from an **SSM
  SecureString** (`/based/staging/gemini-api-key`), read via the App Runner **instance role**
  (`AppRunnerInstanceRole`, scoped to `ssm:GetParameter*` on that ARN + KMS decrypt via SSM).
  The key value lives only in `backend/.env` (gitignored) and SSM — never in the template, the
  deploy command, or logs. `deploy-staging.sh` syncs it from `backend/.env`.
- **`GEMINI_MODEL`** and **`CORS_ORIGINS`** (= the CloudFront URL) are plain App Runner env vars.
- **CORS** is enforced in the backend (`@fastify/cors`, allowlist from `CORS_ORIGINS`; covered by
  `backend/tests/cors.test.ts`).

Remaining for M3: implement `POST /narrate` (reads `GEMINI_API_KEY` / `GEMINI_MODEL` from env) and
confirm the exact Gemini model id / endpoint.

## Security note
The current AWS credentials are **root account** keys. For anything beyond throwaway
staging, switch to a scoped IAM user/role and remove root access keys.
