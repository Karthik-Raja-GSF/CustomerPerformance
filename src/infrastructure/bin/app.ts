#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AitStack } from "../lib/stacks/ait-stack";
import { environments } from "../lib/config/environments";

const app = new cdk.App();

// ===================
// Common configuration
// ===================
const HOSTED_ZONE_ID = "Z069970017BSYGUAVXEZK"; // tratin.com in dev account

// ===================
// Account IDs
// ===================
const AWS_DEV_ACCOUNT = "201002506909"; // gsf profile - has Route53 hosted zone
const AWS_PROD_ACCOUNT = "231570082843"; // gsfprod profile
const AWS_REGION = "us-east-1";

// ===================
// AIT Dev Stack
// ===================
new AitStack(app, "AitDevStack", {
  env: {
    account: AWS_DEV_ACCOUNT,
    region: AWS_REGION,
  },
  config: environments.dev,
  hostedZoneId: HOSTED_ZONE_ID,
  // Create delegation role for prod account to manage Route53
  trustedAccountId: AWS_PROD_ACCOUNT,
  description: "AIT Dev Infrastructure - Full stack with new naming convention",
});

// ===================
// AIT Prod Stack (cross-account Route53)
// ===================
new AitStack(app, "AitPrdStack", {
  env: {
    account: AWS_PROD_ACCOUNT,
    region: AWS_REGION,
  },
  config: environments.prd,
  hostedZoneId: HOSTED_ZONE_ID,
  // Cross-account Route53 - DNS records will be created manually
  // ACM certificates will require manual DNS validation
  crossAccountRoute53: {
    roleArn: `arn:aws:iam::${AWS_DEV_ACCOUNT}:role/ait-dev-ue1-iam-r53-delegate-01`,
    hostedZoneId: HOSTED_ZONE_ID,
    zoneName: "tratin.com",
  },
  description: "AIT Prod Infrastructure - Cross-account Route53",
});
