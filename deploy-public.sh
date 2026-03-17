#!/usr/bin/env bash
set -euo pipefail

#
# deploy-public.sh - Deploy dev public frontend to S3 + CloudFront (ait-dev.tratin.com)
#
# Usage:
#   ./deploy-public.sh
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
# Verify prerequisites
# ──────────────────────────────────────────────
for cmd in aws pnpm curl; do
  if ! command -v "$cmd" &>/dev/null; then
    error "$cmd is required but not installed"
    exit 1
  fi
done

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
AWS_PROFILE="gsf"
AWS_REGION="us-east-1"
FRONTEND_URL="https://ait-dev.tratin.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/src/webapp/dist"

echo ""
info "============================================"
info "  Deploying public frontend (dev)"
info "  $FRONTEND_URL"
info "============================================"
echo ""

# ──────────────────────────────────────────────
# Step 1: Discover AWS resources
# ──────────────────────────────────────────────
info "[1/5] Discovering AWS resources..."

S3_BUCKET=$(aws s3api list-buckets \
  --profile "$AWS_PROFILE" \
  --query "Buckets[?starts_with(Name,'ait-dev-gbl-s3-webapp')].Name" \
  --output text)

if [[ -z "$S3_BUCKET" ]]; then
  error "Could not find S3 bucket matching 'ait-dev-gbl-s3-webapp*'"
  exit 1
fi

ok "S3 bucket: $S3_BUCKET"

CF_DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --profile "$AWS_PROFILE" \
  --query "DistributionList.Items[?contains(Origins.Items[0].DomainName,'$S3_BUCKET')].Id" \
  --output text)

if [[ -z "$CF_DISTRIBUTION_ID" ]]; then
  error "Could not find CloudFront distribution for bucket $S3_BUCKET"
  exit 1
fi

ok "CloudFront distribution: $CF_DISTRIBUTION_ID"

# ──────────────────────────────────────────────
# Step 2: Build webapp
# ──────────────────────────────────────────────
info "[2/5] Building webapp..."

export VITE_COGNITO_USER_POOL_ID="us-east-1_hO4sbrlVw"
export VITE_COGNITO_CLIENT_ID="6divm16kgf3lljacicn0cjl0pn"
export VITE_COGNITO_REGION="us-east-1"
export VITE_COGNITO_DOMAIN="ait-dev.auth.us-east-1.amazoncognito.com"
export VITE_COGNITO_AZURE_AD_IDP_NAME="ait-dev-gbl-cog-idp-ad-01"
export VITE_API_BASE_URL="https://ait-dev-be.tratin.com"

cd "$SCRIPT_DIR"
pnpm --filter webapp build

ok "Build complete: $DIST_DIR"

# ──────────────────────────────────────────────
# Step 3: Sync to S3
# ──────────────────────────────────────────────
info "[3/5] Syncing to S3..."

# Static assets with aggressive caching (1 year, immutable)
aws s3 sync "$DIST_DIR/" "s3://$S3_BUCKET" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --exclude "*.json" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION"

# index.html with no-cache (always fetch latest)
aws s3 cp "$DIST_DIR/index.html" "s3://$S3_BUCKET/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION"

# JSON files with no-cache (if any exist)
if ls "$DIST_DIR/"*.json 1> /dev/null 2>&1; then
  aws s3 sync "$DIST_DIR/" "s3://$S3_BUCKET" \
    --exclude "*" \
    --include "*.json" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION"
fi

ok "S3 sync complete"

# ──────────────────────────────────────────────
# Step 4: Invalidate CloudFront cache
# ──────────────────────────────────────────────
info "[4/5] Invalidating CloudFront cache..."

INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text \
  --profile "$AWS_PROFILE")

ok "Invalidation initiated: $INVALIDATION_ID"

# ──────────────────────────────────────────────
# Step 5: Verify health
# ──────────────────────────────────────────────
info "[5/5] Verifying frontend health..."

for i in 1 2 3 4 5 6 7 8 9 10; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    ok "Health check passed (HTTP $HTTP_CODE)"
    break
  fi

  if [ "$i" = "10" ]; then
    warn "Health check failed after 10 attempts (HTTP $HTTP_CODE)"
    warn "CloudFront invalidation may still be propagating"
    break
  fi

  info "Attempt $i/10 (HTTP $HTTP_CODE), retrying in 6s..."
  sleep 6
done

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo ""
info "============================================"
ok "  Deployment complete!"
info "============================================"
info "URL:          $FRONTEND_URL"
info "S3 bucket:    $S3_BUCKET"
info "CloudFront:   $CF_DISTRIBUTION_ID"
info "Invalidation: $INVALIDATION_ID"
echo ""
