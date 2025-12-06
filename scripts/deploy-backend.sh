#!/bin/bash
set -e

# Configuration
AWS_PROFILE="gsf"
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="201002506909"
ECR_REPO="gsf-backend-apis"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"
ECS_CLUSTER="gsf-backend"
ECS_SERVICE="gsf-backend"
BACKEND_DIR="src/backend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}Starting backend deployment...${NC}"

# Copy tsconfig.base.json to backend for Docker build
echo -e "${YELLOW}Copying tsconfig.base.json to backend...${NC}"
cp tsconfig.base.json "$BACKEND_DIR/"

# Step 1: Build Docker image for linux/amd64 (Fargate architecture)
echo -e "${YELLOW}Building Docker image...${NC}"
docker build --platform linux/amd64 -t "$ECR_REPO:latest" "$BACKEND_DIR"

# Cleanup: Remove copied tsconfig
rm "$BACKEND_DIR/tsconfig.base.json"

# Step 2: Login to ECR
echo -e "${YELLOW}Logging into ECR...${NC}"
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
  docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Step 3: Tag and push image
echo -e "${YELLOW}Pushing image to ECR...${NC}"
docker tag "$ECR_REPO:latest" "$ECR_URI:latest"
docker push "$ECR_URI:latest"

# Step 4: Force new deployment on ECS Fargate
echo -e "${YELLOW}Triggering ECS Fargate deployment...${NC}"
aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --force-new-deployment \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --no-cli-pager

# Step 5: Wait for deployment to stabilize (optional)
echo -e "${YELLOW}Waiting for service to stabilize...${NC}"
aws ecs wait services-stable \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE"

echo -e "${GREEN}Backend deployment complete!${NC}"
