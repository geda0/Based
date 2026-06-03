#!/usr/bin/env bash
# Tear down the Based STAGING environment (stops all staging costs).
# Empties the S3 bucket + deletes ECR images first (CloudFormation can't delete non-empty ones).
set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
ECR_STACK="based-staging-ecr"
MAIN_STACK="based-staging"

out() { aws cloudformation describe-stacks --stack-name "$1" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text 2>/dev/null || true; }

BUCKET="$(out "$MAIN_STACK" FrontendBucketName)"
if [ -n "${BUCKET:-}" ] && [ "$BUCKET" != "None" ]; then
  echo "Emptying s3://$BUCKET ..."
  aws s3 rm "s3://$BUCKET" --recursive --region "$REGION" || true
fi

echo "Deleting stack $MAIN_STACK ..."
aws cloudformation delete-stack --stack-name "$MAIN_STACK" --region "$REGION"
aws cloudformation wait stack-delete-complete --stack-name "$MAIN_STACK" --region "$REGION" || true

REPO="$(out "$ECR_STACK" RepositoryName)"
if [ -n "${REPO:-}" ] && [ "$REPO" != "None" ]; then
  echo "Deleting images in ECR repo $REPO ..."
  IDS="$(aws ecr list-images --repository-name "$REPO" --region "$REGION" --query 'imageIds' --output json 2>/dev/null || echo '[]')"
  if [ "$IDS" != "[]" ]; then
    aws ecr batch-delete-image --repository-name "$REPO" --image-ids "$IDS" --region "$REGION" >/dev/null 2>&1 || true
  fi
fi

echo "Deleting stack $ECR_STACK ..."
aws cloudformation delete-stack --stack-name "$ECR_STACK" --region "$REGION"

echo "Deleting SSM SecureString /based/staging/gemini-api-key ..."
aws ssm delete-parameter --name "/based/staging/gemini-api-key" --region "$REGION" 2>/dev/null || true

echo "Teardown initiated (ECR stack deletes in the background)."
