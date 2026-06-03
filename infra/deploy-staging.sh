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
SSM_NAME="/based/staging/gemini-api-key"
if [ -f backend/.env ]; then set -a; . ./backend/.env; set +a; fi
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3.1-flash}"
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
echo "    arn: $GEMINI_SSM_ARN   model: $GEMINI_MODEL"

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
  --parameter-overrides "BackendImageUri=$IMAGE" "GeminiSsmParameterArn=$GEMINI_SSM_ARN" "GeminiModel=$GEMINI_MODEL" \
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

step "4/5  Build frontend (VITE_API_BASE_URL=$BE_URL) + sync to S3"
VITE_API_BASE_URL="$BE_URL" pnpm --filter @app/frontend build
aws s3 sync frontend/dist "s3://$BUCKET/" --delete --region "$REGION"

step "5/5  Invalidate CloudFront cache"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" --region "$REGION" >/dev/null

printf '\n\033[1;32m✅ Based staging deployed.\033[0m\n'
printf '   Frontend (CloudFront): %s\n' "$CF_URL"
printf '   Backend  (App Runner): %s   (health: %s/health)\n' "$BE_URL" "$BE_URL"
printf '   Region: %s   |   Stacks: %s, %s\n' "$REGION" "$ECR_STACK" "$MAIN_STACK"
printf '   Tear down with: infra/destroy-staging.sh\n'
