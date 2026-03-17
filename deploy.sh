#!/usr/bin/env bash
set -euo pipefail

#
# deploy.sh - Deploy backend or webapp to ECS from local machine
#
# Usage:
#   ./deploy.sh --service backend --env dev
#   ./deploy.sh --service webapp --env prod
#

# ──────────────────────────────────────────────
# Color helpers
# ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ──────────────────────────────────────────────
# Parse arguments
# ──────────────────────────────────────────────
SERVICE=""
ENV=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --service) SERVICE="$2"; shift 2 ;;
    --env)     ENV="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --service <backend|webapp> --env <dev|prod>"
      echo ""
      echo "Options:"
      echo "  --service   Service to deploy (backend or webapp)"
      echo "  --env       Target environment (dev or prod)"
      echo "  -h, --help  Show this help message"
      exit 0
      ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$SERVICE" || -z "$ENV" ]]; then
  error "Both --service and --env are required"
  echo "Usage: $0 --service <backend|webapp> --env <dev|prod>"
  exit 1
fi

if [[ "$SERVICE" != "backend" && "$SERVICE" != "webapp" ]]; then
  error "Invalid service: $SERVICE (must be 'backend' or 'webapp')"
  exit 1
fi

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  error "Invalid environment: $ENV (must be 'dev' or 'prod')"
  exit 1
fi

# ──────────────────────────────────────────────
# Verify prerequisites
# ──────────────────────────────────────────────
for cmd in docker aws git; do
  if ! command -v "$cmd" &>/dev/null; then
    error "$cmd is required but not installed"
    exit 1
  fi
done

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
AWS_REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve environment-specific config (Bash 3.2 compatible — no associative arrays)
case "$ENV" in
  dev)
    AWS_PROFILE="gsf"
    ACCOUNT_ID="201002506909"
    WAIT_TIMEOUT="300"
    if [[ "$SERVICE" == "backend" ]]; then
      ECR_REPOSITORY="ait-dev-gbl-ecr-backend-01"
      ECS_SERVICE="ait-dev-ue1-ecs-backend-01"
    else
      ECR_REPOSITORY="ait-dev-gbl-ecr-webapp-01"
      ECS_SERVICE="ait-dev-ue1-ecs-webapp-01"
    fi
    ECS_CLUSTER="ait-dev-ue1-ecs-cluster-01"
    ;;
  prod)
    AWS_PROFILE="gsf-prd"
    ACCOUNT_ID="231570082843"
    WAIT_TIMEOUT="600"
    if [[ "$SERVICE" == "backend" ]]; then
      ECR_REPOSITORY="ait-prd-gbl-ecr-backend-01"
      ECS_SERVICE="ait-prd-ue1-ecs-backend-01"
    else
      ECR_REPOSITORY="ait-prd-gbl-ecr-webapp-01"
      ECS_SERVICE="ait-prd-ue1-ecs-webapp-01"
    fi
    ECS_CLUSTER="ait-prd-ue1-ecs-cluster-01"
    ;;
esac

ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

if [[ "$SERVICE" == "backend" ]]; then
  DOCKERFILE="src/backend/Dockerfile"
  LOCAL_IMAGE_NAME="backend-image"
else
  DOCKERFILE="src/webapp/Dockerfile"
  LOCAL_IMAGE_NAME="webapp-${ENV}-image"
fi

# Git SHA as image tag (full SHA, matching CI)
IMAGE_TAG="$(git -C "$SCRIPT_DIR" rev-parse HEAD)"

# ──────────────────────────────────────────────
# Webapp build args per environment
# ──────────────────────────────────────────────
get_webapp_build_args() {
  local env="$1"

  case "$env" in
    dev)
      echo "--build-arg VITE_COGNITO_USER_POOL_ID=us-east-1_hO4sbrlVw"
      echo "--build-arg VITE_COGNITO_CLIENT_ID=6divm16kgf3lljacicn0cjl0pn"
      echo "--build-arg VITE_COGNITO_REGION=us-east-1"
      echo "--build-arg VITE_COGNITO_DOMAIN=ait-dev.auth.us-east-1.amazoncognito.com"
      echo "--build-arg VITE_COGNITO_AZURE_AD_IDP_NAME=ait-dev-gbl-cog-idp-ad-01"
      echo "--build-arg VITE_API_BASE_URL=https://aitdev.goldstarfoods.com/api"
      ;;
    prod)
      echo "--build-arg VITE_COGNITO_USER_POOL_ID=us-east-1_W5bvCFDmH"
      echo "--build-arg VITE_COGNITO_CLIENT_ID=5q7a6h16r5f2drnd4nr4206hme"
      echo "--build-arg VITE_COGNITO_REGION=us-east-1"
      echo "--build-arg VITE_COGNITO_DOMAIN=ait.auth.us-east-1.amazoncognito.com"
      echo "--build-arg VITE_COGNITO_AZURE_AD_IDP_NAME=ait-prd-gbl-cog-idp-ad-01"
      echo "--build-arg VITE_API_BASE_URL=https://ait.goldstarfoods.com/api"
      ;;
  esac
}

# ──────────────────────────────────────────────
# Production confirmation gate
# ──────────────────────────────────────────────
if [[ "$ENV" == "prod" ]]; then
  echo ""
  warn "=========================================="
  warn "  PRODUCTION DEPLOYMENT"
  warn "=========================================="
  warn "Service:  $SERVICE"
  warn "Cluster:  $ECS_CLUSTER"
  warn "Service:  $ECS_SERVICE"
  warn "Image:    ${IMAGE_TAG:0:12}..."
  warn "Account:  $ACCOUNT_ID (prod)"
  warn "=========================================="
  echo ""
  read -rp "Type 'yes' to confirm production deployment: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    error "Deployment cancelled"
    exit 1
  fi
  echo ""
fi

# ──────────────────────────────────────────────
# Deploy
# ──────────────────────────────────────────────
echo ""
info "============================================"
info "  Deploying $SERVICE to $ENV"
info "============================================"
info "Image tag:   ${IMAGE_TAG:0:12}..."
info "ECR repo:    $ECR_REGISTRY/$ECR_REPOSITORY"
info "ECS cluster: $ECS_CLUSTER"
info "ECS service: $ECS_SERVICE"
info "AWS profile: $AWS_PROFILE"
echo ""

# Step 1: Build Docker image
info "[1/6] Building Docker image..."

BUILD_ARGS=""
if [[ "$SERVICE" == "webapp" ]]; then
  BUILD_ARGS="$(get_webapp_build_args "$ENV")"
fi

# shellcheck disable=SC2086
docker build --platform linux/amd64 \
  -f "$SCRIPT_DIR/$DOCKERFILE" \
  $BUILD_ARGS \
  -t "$LOCAL_IMAGE_NAME:$IMAGE_TAG" \
  "$SCRIPT_DIR"

ok "Docker image built: $LOCAL_IMAGE_NAME:${IMAGE_TAG:0:12}..."

# Step 2: Login to ECR
info "[2/6] Logging in to ECR..."

aws ecr get-login-password \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
| docker login \
  --username AWS \
  --password-stdin "$ECR_REGISTRY"

ok "ECR login successful"

# Step 3: Tag image
info "[3/6] Tagging image..."

FULL_IMAGE="$ECR_REGISTRY/$ECR_REPOSITORY"

docker tag "$LOCAL_IMAGE_NAME:$IMAGE_TAG" "$FULL_IMAGE:$IMAGE_TAG"
docker tag "$LOCAL_IMAGE_NAME:$IMAGE_TAG" "$FULL_IMAGE:latest"

ok "Tagged: $FULL_IMAGE:${IMAGE_TAG:0:12}..."
ok "Tagged: $FULL_IMAGE:latest"

# Step 4: Push to ECR
info "[4/6] Pushing image to ECR..."

docker push "$FULL_IMAGE:$IMAGE_TAG"
docker push "$FULL_IMAGE:latest"

ok "Image pushed to ECR"

# Step 5: Force new ECS deployment
info "[5/6] Updating ECS service (force new deployment)..."

aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --force-new-deployment \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --no-cli-pager > /dev/null

ok "ECS deployment triggered"

# Step 6: Wait for service stability
info "[6/6] Waiting for ECS service to stabilize (timeout: ${WAIT_TIMEOUT}s)..."

aws ecs wait services-stable \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --cli-read-timeout "$WAIT_TIMEOUT"

ok "ECS service is stable"

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo ""
info "============================================"
ok "  Deployment complete!"
info "============================================"
info "Service:   $SERVICE"
info "Env:       $ENV"
info "Image:     ${IMAGE_TAG:0:12}..."
info "ECR:       $FULL_IMAGE:latest"
echo ""
