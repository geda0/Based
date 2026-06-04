#!/usr/bin/env bash
# Build + deploy the Based STAGING environment to AWS.
#   Frontend: S3 (private) + CloudFront.   Backend: container on App Runner (image from ECR).
# Idempotent — re-running updates the stacks, ships a fresh image, and re-publishes the SPA.
#
# Prereqs: aws cli (authenticated), docker, pnpm, node. Region defaults to us-east-2.
set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
ECR_STACK="based-staging-ecr"
MAIN_STACK="based-staging"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo manual)-$(date +%Y%m%d%H%M%S)"
step "Deploying Based staging  |  account $ACCOUNT  |  region $REGION  |  tag $IMAGE_TAG"

# Gemini key -> SSM SecureString. Sourced from backend/.env (gitignored) or the
# environment; the value is never printed or passed to CloudFormation (only its ARN is).
# GEMINI_MODEL (non-secret) is single-sourced from the version-controlled IaC default
# (the `Default:` of GeminiModel in infra/staging.yaml). backend/.env (or the env) may
# OVERRIDE it locally; CI (no backend/.env) gets the IaC default. We ALWAYS pass
# GeminiModel to CloudFormation: an omitted parameter on a stack UPDATE retains the
# stack's previous value (NOT the template default), so the value must be explicit to
# converge the stack onto the IaC default — that retain-previous behaviour was the m3
# CI model gap. No hardcoded model id in this script. See ADR 0005.
SSM_NAME="/based/staging/gemini-api-key"
if [ -f backend/.env ]; then set -a; . ./backend/.env; set +a; fi
step "0/5  Gemini API key -> SSM SecureString ($SSM_NAME)"
if [ -n "${GEMINI_API_KEY:-}" ]; then
  aws ssm put-parameter --name "$SSM_NAME" --type SecureString --value "$GEMINI_API_KEY" --overwrite --region "$REGION" >/dev/null
  echo "    stored/updated SecureString (value hidden)"
elif aws ssm get-parameter --name "$SSM_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "    reusing existing SecureString (no GEMINI_API_KEY in env/backend/.env)"
else
  echo "ERROR: GEMINI_API_KEY not set (backend/.env or env) and no existing SSM parameter. Set it and re-run." >&2
  exit 1
fi
GEMINI_SSM_ARN="$(aws ssm get-parameter --name "$SSM_NAME" --region "$REGION" --query 'Parameter.ARN' --output text)"
echo "    arn: $GEMINI_SSM_ARN"

# YouTube Data API key -> SSM SecureString (Based TV news source), mirroring the
# Gemini key above: sourced from backend/.env (gitignored) or the env; the value is
# never printed or passed to CloudFormation (only its ARN is). A local run with the
# key refreshes the SecureString; CI (no backend/.env) reuses the existing parameter.
# No key -> the backend YouTube source is failure-silent ([], no spend, server boots).
YT_SSM_NAME="/based/staging/youtube-api-key"
step "0b/5  YouTube API key -> SSM SecureString ($YT_SSM_NAME)"
if [ -n "${YOUTUBE_API_KEY:-}" ]; then
  aws ssm put-parameter --name "$YT_SSM_NAME" --type SecureString --value "$YOUTUBE_API_KEY" --overwrite --region "$REGION" >/dev/null
  echo "    stored/updated SecureString (value hidden)"
elif aws ssm get-parameter --name "$YT_SSM_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "    reusing existing SecureString (no YOUTUBE_API_KEY in env/backend/.env)"
else
  echo "ERROR: YOUTUBE_API_KEY not set (backend/.env or env) and no existing SSM parameter. Set it and re-run." >&2
  exit 1
fi
YOUTUBE_SSM_ARN="$(aws ssm get-parameter --name "$YT_SSM_NAME" --region "$REGION" --query 'Parameter.ARN' --output text)"
echo "    arn: $YOUTUBE_SSM_ARN"

# Single-source GEMINI_MODEL from the version-controlled IaC default (GeminiModel's
# `Default:` in infra/staging.yaml). backend/.env / env OVERRIDES it; CI uses the IaC
# default. Always passed to CloudFormation (an omitted param on update retains the
# stale stack value — the m3 gap).
IAC_MODEL_DEFAULT="$(awk '/^  GeminiModel:/{f=1} f&&/^    Default:/{print $2; exit}' infra/staging.yaml)"
if [ -z "$IAC_MODEL_DEFAULT" ]; then
  echo "ERROR: could not read GeminiModel Default from infra/staging.yaml." >&2
  exit 1
fi
if [ -n "${GEMINI_MODEL:-}" ] && [ "$GEMINI_MODEL" != "$IAC_MODEL_DEFAULT" ]; then
  echo "    model: $GEMINI_MODEL  (override from backend/.env or env; IaC default is $IAC_MODEL_DEFAULT)"
else
  GEMINI_MODEL="$IAC_MODEL_DEFAULT"
  echo "    model: $GEMINI_MODEL  (IaC default from infra/staging.yaml)"
fi

step "1/5  ECR repository (CloudFormation: $ECR_STACK)"
aws cloudformation deploy \
  --stack-name "$ECR_STACK" \
  --template-file infra/ecr.yaml \
  --region "$REGION" \
  --no-fail-on-empty-changeset
REPO_URI="$(aws cloudformation describe-stacks --stack-name "$ECR_STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue" --output text)"
REGISTRY="${REPO_URI%%/*}"
IMAGE="$REPO_URI:$IMAGE_TAG"
echo "    repo: $REPO_URI"

step "2/5  Build + push backend image (linux/amd64) -> $IMAGE"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
if docker buildx version >/dev/null 2>&1; then
  docker buildx build --platform linux/amd64 -f infra/backend.Dockerfile -t "$IMAGE" --push .
else
  DOCKER_BUILDKIT=1 docker build --platform linux/amd64 -f infra/backend.Dockerfile -t "$IMAGE" .
  docker push "$IMAGE"
fi

step "3/5  Infrastructure stack (CloudFormation: $MAIN_STACK) — CloudFront + App Runner can take ~5-10 min"
aws cloudformation deploy \
  --stack-name "$MAIN_STACK" \
  --template-file infra/staging.yaml \
  --parameter-overrides "BackendImageUri=$IMAGE" "GeminiSsmParameterArn=$GEMINI_SSM_ARN" "YouTubeSsmParameterArn=$YOUTUBE_SSM_ARN" "GeminiModel=$GEMINI_MODEL" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset

out() { aws cloudformation describe-stacks --stack-name "$MAIN_STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET="$(out FrontendBucketName)"
DIST_ID="$(out CloudFrontDistributionId)"
CF_URL="$(out CloudFrontUrl)"
BE_URL="$(out BackendServiceUrl)"
echo "    frontend bucket: $BUCKET"
echo "    cloudfront:      $CF_URL ($DIST_ID)"
echo "    backend:         $BE_URL"

# VITE_LIVE_VOICE=1 turns on the LV1 live-voice path (browser-direct Gemini Live
# audio) in the STAGING bundle. The FE defaults it OFF so tests/dev keep Web Speech;
# staging opts in. It is a NON-SECRET build flag (the long-lived GEMINI_API_KEY stays
# server-side in SSM; the browser mints only a short-lived ephemeral token via
# POST /live/session). NO VITE_LIVE_RELAY_URL — the relay was retired (ADR 0007
# Amendment C, topology a: browser opens Google's Live WSS directly).
#
# VITE_USE_REMOTE_SOURCE=1 turns on the Based TV remote source: the FE fetches
# GET ${VITE_API_BASE_URL}/sources/events (real YouTube news, served server-side with
# the SSM YOUTUBE_API_KEY) instead of the static mock. NON-SECRET build flag — the
# browser never holds the YouTube key (it stays server-side in SSM; the FE only calls
# our own /sources/events). Failure-silent: a failed/empty endpoint falls back to the
# mock (ADR 0010 §5). VITE_API_BASE_URL (the App Runner backend URL) is REQUIRED for
# the remote source — without it the FE would call a relative /sources/events (404).
# It is baked below for both /narrate and /sources/events.
step "4/5  Build frontend (VITE_API_BASE_URL=$BE_URL, VITE_LIVE_VOICE=1, VITE_USE_REMOTE_SOURCE=1) + sync to S3"
VITE_API_BASE_URL="$BE_URL" VITE_LIVE_VOICE=1 VITE_USE_REMOTE_SOURCE=1 pnpm --filter @app/frontend build
aws s3 sync frontend/dist "s3://$BUCKET/" --delete --region "$REGION"

step "5/5  Invalidate CloudFront cache"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" --region "$REGION" >/dev/null

printf '\n\033[1;32m✅ Based staging deployed.\033[0m\n'
printf '   Frontend (CloudFront): %s\n' "$CF_URL"
printf '   Backend  (App Runner): %s   (health: %s/health)\n' "$BE_URL" "$BE_URL"
printf '   Region: %s   |   Stacks: %s, %s\n' "$REGION" "$ECR_STACK" "$MAIN_STACK"
printf '   Tear down with: infra/destroy-staging.sh\n'
