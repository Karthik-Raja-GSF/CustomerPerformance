# AWS Resource Naming Convention

## Overview

This document defines the standard naming convention for all AWS resources in the AI Transformation (AIT) project. Consistent naming enables easier resource identification, filtering, automation, and cost allocation.

## Naming Pattern

```
[project]-[environment]-[region]-[resource-type]-[scope]-[id]
```

**Example:** `ait-dev-ue1a-sg-public-01`

## Component Definitions

| Component     | Description                 | Format      | Required |
| ------------- | --------------------------- | ----------- | -------- |
| project       | Project identifier          | 3 letters   | Yes      |
| environment   | Deployment environment      | 3 letters   | Yes      |
| region        | AWS region/AZ or global     | 3-4 letters | Yes      |
| resource-type | AWS service abbreviation    | 2-4 letters | Yes      |
| scope         | Logical grouping or context | variable    | No       |
| id            | Unique numeric identifier   | 2 digits    | Yes      |

## Allowed Values

### Project

| Code | Description       |
| ---- | ----------------- |
| ait  | AI Transformation |

### Environment

| Code | Description |
| ---- | ----------- |
| dev  | Development |
| stg  | Staging     |
| prd  | Production  |

### Region

**Regional resources:**

| Code | AWS Region |
| ---- | ---------- |
| ue1a | us-east-1a |
| ue1b | us-east-1b |
| ue1c | us-east-1c |
| uw2a | us-west-2a |
| uw2b | us-west-2b |
| uw2c | us-west-2c |

**Global resources:**

| Code | Description              |
| ---- | ------------------------ |
| gbl  | Global (region-agnostic) |

### Resource Type

| Code | AWS Service               |
| ---- | ------------------------- |
| ec2  | EC2 Instance              |
| s3   | S3 Bucket                 |
| rds  | RDS Database              |
| alb  | Application Load Balancer |
| nlb  | Network Load Balancer     |
| sg   | Security Group            |
| vpc  | Virtual Private Cloud     |
| sn   | Subnet                    |
| igw  | Internet Gateway          |
| nat  | NAT Gateway               |
| rt   | Route Table               |
| eip  | Elastic IP                |
| efs  | Elastic File System       |
| lam  | Lambda Function           |
| sqs  | SQS Queue                 |
| sns  | SNS Topic                 |
| cw   | CloudWatch                |
| cf   | CloudFront Distribution   |
| r53  | Route 53                  |
| iam  | IAM Role/Policy           |
| kms  | KMS Key                   |
| sm   | Secrets Manager           |
| ecr  | ECR Repository            |
| ecs  | ECS Cluster/Service       |
| eks  | EKS Cluster               |
| asg  | Auto Scaling Group        |
| tg   | Target Group              |

### Scope

The scope field provides context for the resource's purpose or logical grouping. Examples:

| Context           | Scope Values              |
| ----------------- | ------------------------- |
| Network tier      | public, private, data     |
| Application layer | web, api, worker, db      |
| Function          | auth, logging, monitoring |
| Team/ownership    | platform, app, data       |

### ID

Two-digit numeric identifier: `01`, `02`, `03`, etc.

## Global vs Regional Resources

### Global Resources (use `gbl`)

- IAM (roles, policies, users)
- S3 (bucket names are globally unique)
- CloudFront distributions
- Route 53 hosted zones and records
- WAF (when attached to CloudFront)
- ACM certificates (for CloudFront, must be in us-east-1)

### Regional Resources (use region code)

- EC2, RDS, ECS, EKS
- VPC, Subnets, Security Groups
- ALB, NLB, Target Groups
- Lambda, SQS, SNS
- EFS, EBS

## Examples

### Regional Resources

```
ait-dev-ue1a-vpc-main-01          # Main VPC in us-east-1a dev
ait-dev-ue1a-sn-public-01         # Public subnet
ait-dev-ue1a-sn-private-01        # Private subnet
ait-dev-ue1a-sg-web-01            # Security group for web tier
ait-dev-ue1a-sg-db-01             # Security group for database tier
ait-dev-ue1a-ec2-web-01           # Web server instance
ait-dev-ue1a-rds-app-01           # Application database
ait-dev-ue1a-alb-web-01           # Web application load balancer
ait-prd-uw2a-ec2-api-01           # API server in us-west-2a prod
ait-prd-uw2a-ecs-worker-01        # ECS worker cluster
```

### Global Resources

```
ait-dev-gbl-s3-assets-01          # Static assets bucket
ait-dev-gbl-s3-logs-01            # Logging bucket
ait-dev-gbl-iam-lambda-exec-01    # Lambda execution role
ait-dev-gbl-cf-web-01             # CloudFront distribution
ait-prd-gbl-r53-main-01           # Route 53 hosted zone
ait-prd-gbl-iam-ecs-task-01       # ECS task role
```

## Tagging Strategy

Complement naming with consistent tags for additional metadata:

| Tag Key     | Description              | Allowed Values             |
| ----------- | ------------------------ | -------------------------- |
| Company     | Company identifier       | GSF                        |
| Project     | Project name             | AI Transformation          |
| ProjectAbbr | Project abbreviation     | AIT                        |
| Environment | Deployment environment   | development, production    |
| Owner       | Accountability & contact | RKrishnan@GSFoodsGroup.com |
| CostCenter  | Billing allocation       | gsf                        |
| ManagedBy   | IaC tool                 | CDK                        |

## Best Practices

1. **Always use lowercase** — Avoid case sensitivity issues across tools
2. **No special characters** — Use only alphanumeric characters and hyphens
3. **Keep scope meaningful** — Choose scope values that aid resource discovery
4. **Document new resource types** — Update this guide when adding new service abbreviations
5. **Use tags for flexibility** — Names are immutable; tags can be updated
6. **Validate in IaC** — Enforce naming convention in Terraform/CloudFormation

## Filtering Examples

```bash
# All dev security groups
aws ec2 describe-security-groups --filters "Name=tag:Name,Values=ait-dev-*-sg-*"

# All global resources
aws resourcegroupstaggingapi get-resources --tag-filters Key=Name,Values=ait-*-gbl-*

# All public-tier resources in prod
aws resourcegroupstaggingapi get-resources --tag-filters Key=Name,Values=ait-prd-*-*-public-*
```

---

**Version:** 1.0  
**Last Updated:** December 2024  
**Owner:** CargoConnect
