#!/bin/bash
set -e

# Configuration
AWS_PROFILE="gsf"
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="201002506909"
ECR_REPO="gsf-backend-apis"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"
EC2_HOST="98.88.196.240"
EC2_USER="ec2-user"
SSH_KEY="$HOME/Downloads/gsf-dev-keypair.pem"
BACKEND_DIR="src/backend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}🚀 Starting backend deployment...${NC}"

# Copy tsconfig.base.json to backend for Docker build
echo -e "${YELLOW}📋 Copying tsconfig.base.json to backend...${NC}"
cp tsconfig.base.json "$BACKEND_DIR/"

# Step 1: Build Docker image for linux/amd64 (EC2 architecture)
echo -e "${YELLOW}🐳 Building Docker image...${NC}"
docker build --platform linux/amd64 -t "$ECR_REPO:latest" "$BACKEND_DIR"

# Cleanup: Remove copied tsconfig
rm "$BACKEND_DIR/tsconfig.base.json"

# Step 2: Login to ECR
echo -e "${YELLOW}🔐 Logging into ECR...${NC}"
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
  docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Step 3: Tag and push image
echo -e "${YELLOW}📤 Pushing image to ECR...${NC}"
docker tag "$ECR_REPO:latest" "$ECR_URI:latest"
docker push "$ECR_URI:latest"

# Step 4: Deploy to EC2
echo -e "${YELLOW}🖥️  Deploying to EC2...${NC}"
ssh -o IdentitiesOnly=yes -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" << 'ENDSSH'
  # Login to ECR
  aws ecr get-login-password --region us-east-1 | sudo docker login --username AWS --password-stdin 201002506909.dkr.ecr.us-east-1.amazonaws.com

  # Pull latest image
  sudo docker pull 201002506909.dkr.ecr.us-east-1.amazonaws.com/gsf-backend-apis:latest

  # Stop and remove existing container
  sudo docker stop gsf-backend 2>/dev/null || true
  sudo docker rm gsf-backend 2>/dev/null || true

  # Run new container
  sudo docker run -d \
    --name gsf-backend \
    --restart unless-stopped \
    -p 8887:8887 \
    --env-file /home/ec2-user/.env \
    201002506909.dkr.ecr.us-east-1.amazonaws.com/gsf-backend-apis:latest

  # Cleanup old images
  sudo docker image prune -f

  # Show status
  sudo docker ps
ENDSSH

echo -e "${GREEN}✅ Backend deployment complete!${NC}"
