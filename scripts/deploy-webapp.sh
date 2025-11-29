#!/bin/bash
set -e

# Configuration
AWS_PROFILE="gsf"
S3_BUCKET="gsf-development-dashboard-webapp"
CLOUDFRONT_DISTRIBUTION_ID="E1XMCD5KKVBOBU"
WEBAPP_DIR="src/webapp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${YELLOW}🚀 Starting webapp deployment...${NC}"

# Step 1: Build
echo -e "${YELLOW}📦 Building webapp...${NC}"
cd "$WEBAPP_DIR"
pnpm build
cd "$PROJECT_ROOT"

# Step 2: Deploy to S3
echo -e "${YELLOW}☁️  Uploading to S3...${NC}"
aws s3 sync "$WEBAPP_DIR/dist" "s3://$S3_BUCKET" \
  --delete \
  --profile "$AWS_PROFILE"

# Step 3: Invalidate CloudFront cache
echo -e "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --paths "/*" \
  --profile "$AWS_PROFILE"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "URL: https://dbujwji4q066z.cloudfront.net"
