#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { GsfStack } from "../lib/stacks/gsf-stack";
import { AitStack } from "../lib/stacks/ait-stack";
import { environments } from "../lib/config/environments";

// Keep the old stack import for reference (will be removed after migration)
import { BackendStack } from "../lib/backend-stack";

const app = new cdk.App();

// ===================
// Common configuration
// ===================
const AWS_ACCOUNT = "201002506909";
const AWS_REGION = "us-east-1";
const HOSTED_ZONE_ID = "Z069970017BSYGUAVXEZK"; // tratin.com

// ===================
// OLD Stack (keep for now, don't delete)
// ===================
new BackendStack(app, "GsfBackendStack", {
  env: {
    account: AWS_ACCOUNT,
    region: AWS_REGION,
  },
  description:
    "GSF Backend Infrastructure - ECS Fargate with ALB (OLD - will be removed after migration)",
});

// ===================
// GSF Dev Stack (OLD naming - gsf-{env}-{resource})
// ===================
new GsfStack(app, "GsfDevStack", {
  env: {
    account: AWS_ACCOUNT,
    region: AWS_REGION,
  },
  config: environments.dev,
  hostedZoneId: HOSTED_ZONE_ID,
  description: "GSF Dev Infrastructure - Full stack with Aurora Serverless v2",
});

// ===================
// AIT Dev Stack (NEW naming - ait-{env}-{region}-{type}-{scope}-{id})
// ===================
new AitStack(app, "AitDevStack", {
  env: {
    account: AWS_ACCOUNT,
    region: AWS_REGION,
  },
  config: environments.dev,
  hostedZoneId: HOSTED_ZONE_ID,
  description: "AIT Dev Infrastructure - Full stack with new naming convention",
});

// ===================
// AIT Prod Stack (for production deployment)
// ===================
// Uncomment and configure when ready to deploy to prod
// new AitStack(app, "AitPrdStack", {
//   env: {
//     account: AWS_ACCOUNT,
//     region: AWS_REGION,
//   },
//   config: environments.prod,
//   hostedZoneId: HOSTED_ZONE_ID,
//   description: "AIT Prod Infrastructure - Full stack with new naming convention",
// });
