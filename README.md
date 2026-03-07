# AIT Procurement Admin Panel

## Overview

Modern admin panel for AIT Procurement system built with React, TypeScript, and NestJS.

## Architecture

- **Frontend**: React + TypeScript + Vite (CloudFront + S3)
- **Backend**: NestJS + Prisma + PostgreSQL (ECS Fargate + Aurora Serverless v2)
- **Infrastructure**: AWS CDK (TypeScript)
- **Authentication**: AWS Cognito

## Environments

### Development

- Frontend: https://ait-dev.tratin.com
- Backend: https://ait-dev-be.tratin.com
- AWS Account: 201002506909
- Auto-deploys on push to `main`

### Production

- Frontend: https://ait.tratin.com
- Backend: https://ait-be.tratin.com
- AWS Account: 231570082843
- Manual deployment with approval gate

## Development

### Prerequisites

- Node.js 20+
- pnpm
- Docker (for backend local development)
- AWS CLI configured with profiles `gsf` (dev) and `gsfprod` (prod)

### Setup

```bash
# Install dependencies
pnpm install

# Setup environment variables
cp src/backend/.env.example src/backend/.env
cp src/webapp/.env.example src/webapp/.env

# Generate Prisma client
pnpm --filter backend prisma:generate

# Run database migrations (local)
pnpm --filter backend prisma:migrate:dev
```

### Run Locally

```bash
# Backend (port 8887)
pnpm --filter backend dev

# Frontend (port 5173)
pnpm --filter webapp dev
```

## Deployment

### Development Deployment

Development environment auto-deploys when changes are pushed to `main`:

1. **Backend**: Triggered when `src/backend/**` changes
   - Builds Docker image
   - Pushes to dev ECR
   - Updates ECS service
   - Waits for stability

2. **Frontend**: Triggered when `src/webapp/**` changes
   - Builds React app with dev env vars
   - Syncs to S3
   - Invalidates CloudFront cache

### Production Deployment

Production requires manual approval and follows this workflow:

#### Step 1: Test in Development

```bash
# Make changes
git add .
git commit -m "Add feature X"
git push origin main

# Wait for dev deployment to complete
# Test on ait-dev.tratin.com and ait-dev-be.tratin.com
```

#### Step 2: Deploy Backend to Production

1. Go to **GitHub Actions** → **Deploy Backend**
2. Click **Run workflow**
3. Select environment: **prod**
4. Input version: `v1.0.0` (semantic versioning)
5. Add release notes (optional)
6. Click **Run workflow**

**What happens:**

- ✅ Creates git tag `v1.0.0` (if doesn't exist)
- ✅ Typechecks code
- ✅ **Copies dev Docker image** (exact same container tested in dev - no rebuild!)
- ✅ Pushes to prod ECR with tags: `:sha`, `:v1.0.0`, `:latest`
- ⏸️ **WAITS FOR MANUAL APPROVAL** (2 reviewers required)
- ✅ Runs database migrations (separate task)
- ✅ Updates ECS service (zero-downtime deployment)
- ✅ Verifies health endpoint
- ✅ Monitors CloudWatch alarms for 5 minutes
- ❌ Auto-rollback if health checks fail

#### Step 3: Deploy Frontend to Production

1. Go to **GitHub Actions** → **Deploy Frontend**
2. Click **Run workflow**
3. Select environment: **prod**
4. Input same version: `v1.0.0`
5. Click **Run workflow**

**What happens:**

- ✅ Validates tag exists (created by backend deployment)
- ✅ Typechecks code
- ✅ Builds React app with prod env vars
- ⏸️ **WAITS FOR MANUAL APPROVAL**
- ✅ Syncs to S3 with cache headers
- ✅ Invalidates CloudFront cache
- ✅ Verifies frontend is accessible

#### Step 4: Verify Deployment

```bash
# Check backend health
curl https://ait-be.tratin.com/health

# Check frontend
open https://ait.tratin.com

# Monitor CloudWatch dashboard
open https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=ait-prd-ue1-cw-dashboard-01
```

### Rollback

#### Automated Rollback

Production deployments automatically rollback on:

- Health check failures
- ECS service instability > 5 minutes
- CloudWatch alarm breaches during deployment

#### Manual Rollback

**Using GitHub Actions:**

1. Go to **Deploy Backend** workflow
2. Click **Run workflow**
3. Select environment: **prod**
4. Input previous version tag: `v1.0.0`
5. Approve deployment

**Using AWS CLI:**

```bash
# Get previous task definition
aws ecs describe-services \
  --cluster ait-prd-ue1-ecs-cluster-01 \
  --service ait-prd-ue1-ecs-backend-01 \
  --query 'services[0].deployments[1].taskDefinition' \
  --output text

# Rollback
aws ecs update-service \
  --cluster ait-prd-ue1-ecs-cluster-01 \
  --service ait-prd-ue1-ecs-backend-01 \
  --task-definition <previous-task-def-arn> \
  --force-new-deployment
```

## GitHub Environment Setup (One-time)

### Required Environments

Create these 3 environments in **Settings** → **Environments** → **New environment**:

#### 1. `production-ecr` (Backend - Prod ECR Push Gate)

- **Protection rules**: Required reviewers (2)
- **Purpose**: Approves pushing Docker image to production ECR

#### 2. `approval` (Frontend - Prod Deployment Gate)

- **Protection rules**: Required reviewers (2)
- **Purpose**: Approves production build and deployment for frontend

#### 3. `production` (Final Prod Deployment)

- **Protection rules**: Required reviewers (2)
- **Purpose**: Approves final deployment to production (backend ECS + frontend S3)

### Repository Secrets

Add the following secrets to **Settings → Secrets and variables → Actions → Repository secrets**:

**Dev**:

```
AWS_ACCESS_KEY_ID=<IAM key for dev account 201002506909>
AWS_SECRET_ACCESS_KEY=<Secret key>
S3_BUCKET=ait-dev-gbl-s3-webapp-01-201002506909
CLOUDFRONT_DISTRIBUTION_ID=E20DSSZY8XDOFO
```

**Prod** (need to add):

```
AWS_ACCESS_KEY_ID_PROD=<IAM key for prod account 231570082843>
AWS_SECRET_ACCESS_KEY_PROD=<Secret key>
AWS_ACCOUNT_ID_PROD=231570082843
S3_BUCKET_PROD=ait-prd-gbl-s3-webapp-01-231570082843
CLOUDFRONT_DISTRIBUTION_ID_PROD=E2Q5JID33W5NY8
```

### Repository Variables

Add the following variables to **Settings → Secrets and variables → Actions → Repository variables**:

**Dev**:

```
VITE_API_BASE_URL=https://ait-dev-be.tratin.com
VITE_COGNITO_USER_POOL_ID=<from dev CDK output>
VITE_COGNITO_CLIENT_ID=<from dev CDK output>
VITE_COGNITO_REGION=us-east-1
```

**Prod**:

```
VITE_API_BASE_URL_PROD=https://ait-be.tratin.com
VITE_COGNITO_USER_POOL_ID_PROD=us-east-1_W5bvCFDmH
VITE_COGNITO_CLIENT_ID_PROD=5q7a6h16r5f2drnd4nr4206hme
VITE_COGNITO_REGION_PROD=us-east-1
```

## Infrastructure

### Deploy Infrastructure

**Development:**

```bash
cd src/infrastructure
AWS_PROFILE=gsf npx cdk deploy AitDevStack
```

**Production:**

```bash
cd src/infrastructure
AWS_PROFILE=gsfprod npx cdk deploy AitPrdStack
```

### Infrastructure Components

- **VPC**: Isolated network with public/private subnets
- **Aurora Serverless v2**: PostgreSQL database with auto-scaling (0.5-8 ACU)
- **ECS Fargate**: Containerized backend with auto-scaling (2-4 tasks in prod)
- **ALB**: Application Load Balancer for backend
- **CloudFront + S3**: Frontend hosting with CDN
- **Cognito**: User authentication
- **Route53**: DNS with cross-account delegation
- **CloudWatch**: Monitoring and alarms (prod only)

### Production CloudWatch Alarms

- High CPU (>80% for 10 min)
- High Memory (>80% for 10 min)
- HTTP 5xx Errors (>10 per minute)
- Unhealthy Targets (>0)
- Low Task Count (<2)

## Best Practices

### Versioning

- Use semantic versioning: `v1.0.0` (major.minor.patch)
- Tag format: Always start with `v`
- Backend and frontend should use the same version tag

### Deployment Windows

- **Recommended**: Tuesday-Thursday, 10 AM - 2 PM ET
- **Avoid**: Friday deployments (weekend risk)
- **Require**: 2+ team members available during deployment

### Testing

- Always test in dev before deploying to prod
- Run full integration tests in dev environment
- Verify all critical user flows
- Check CloudWatch metrics before and after deployment

### Database Migrations

- All migrations must be backward-compatible
- Test migrations in dev first
- Migrations run automatically during deployment
- Failed migrations block deployment (rollback triggered)

### Security

- Never commit secrets to git
- Use AWS Secrets Manager for sensitive data
- Rotate IAM keys regularly
- Review CloudWatch logs for suspicious activity

## Monitoring

### CloudWatch Dashboard

https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=ait-prd-ue1-cw-dashboard-01

### Key Metrics

- ECS CPU/Memory utilization
- ALB request count and latency
- Aurora database connections
- CloudFront cache hit rate

### Logs

**Backend logs:**

```bash
aws logs tail /ecs/ait-prd-ue1-backend-01 --follow
```

**Database logs:**

```bash
aws rds describe-db-log-files \
  --db-instance-identifier ait-prd-ue1-rds-app-01
```

## Troubleshooting

### Backend container not starting

```bash
# Check ECS service events
aws ecs describe-services \
  --cluster ait-prd-ue1-ecs-cluster-01 \
  --services ait-prd-ue1-ecs-backend-01

# View container logs
aws logs tail /ecs/ait-prd-ue1-backend-01 --follow
```

### Database connection issues

```bash
# Check RDS cluster status
aws rds describe-db-clusters \
  --db-cluster-identifier ait-prd-ue1-rds-app-01

# Verify security group rules
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=ait-prd-ue1-sg-rds-01"
```

### Frontend not loading

```bash
# Check CloudFront distribution
aws cloudfront get-distribution \
  --id <distribution-id>

# Verify S3 bucket contents
aws s3 ls s3://ait-prd-gbl-s3-webapp-01-231570082843/

# Create CloudFront invalidation
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/*"
```

## Project Structure

```
.
├── .github/workflows/          # CI/CD workflows
│   ├── deploy-backend.yml      # Dev backend auto-deploy
│   ├── deploy-backend-prod.yml # Prod backend manual deploy
│   ├── deploy-webapp.yml       # Dev frontend auto-deploy
│   └── deploy-webapp-prod.yml  # Prod frontend manual deploy
├── src/
│   ├── backend/                # NestJS backend
│   │   ├── prisma/            # Database schema & migrations
│   │   ├── src/               # Source code
│   │   └── Dockerfile         # Backend container
│   ├── webapp/                 # React frontend
│   │   └── src/               # Source code
│   └── infrastructure/         # AWS CDK
│       ├── bin/               # CDK app entry
│       ├── lib/               # CDK stacks & constructs
│       └── config/            # Environment configs
├── package.json               # Workspace config
└── pnpm-workspace.yaml        # pnpm monorepo
```

## Support

For issues or questions:

- Check CloudWatch logs and alarms
- Review GitHub Actions workflow runs
- Contact the development team

## License

Proprietary - AIT Procurement
