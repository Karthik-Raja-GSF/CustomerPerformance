import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvironmentConfig } from "../config/environments";
import { NamingConfig, Environment } from "../config/naming";
import { addStandardTags } from "../config/tags";
import { VpcConstruct } from "../constructs/vpc-construct";
import { DatabaseConstruct } from "../constructs/database-construct";
import { AuthConstruct } from "../constructs/auth-construct";
import { EcrConstruct } from "../constructs/ecr-construct";
import { FrontendConstruct } from "../constructs/frontend-construct";
import { BackendConstruct } from "../constructs/backend-construct";

export interface AitStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  hostedZoneId: string;
}

/**
 * AIT Stack - AI Transformation Infrastructure
 *
 * Uses the new naming convention: ait-{env}-{region}-{resource-type}-{scope}-{id}
 * All resources are tagged with standard AIT tags.
 *
 * @see aws-naming.md for naming conventions
 */
export class AitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AitStackProps) {
    super(scope, id, props);

    const { config, hostedZoneId } = props;

    // AIT-specific domain names (different from GSF stack)
    const aitDomainPrefix =
      config.envName === "prod" ? "ait" : `ait-${config.envName}`;
    const domains = {
      frontend: `${aitDomainPrefix}.${config.baseDomain}`, // ait-dev.tratin.com
      backend: `${aitDomainPrefix}-be.${config.baseDomain}`, // ait-dev-be.tratin.com
    };

    // Create naming config for all constructs
    // Map envName to Environment type ('dev' | 'prd')
    const envCode: Environment = config.envName === "prod" ? "prd" : "dev";
    const naming: NamingConfig = {
      env: envCode,
      region: "ue1", // us-east-1
      accountId: cdk.Aws.ACCOUNT_ID,
    };

    // Apply standard tags to entire stack
    addStandardTags(this, naming.env);

    // Import existing Route53 Hosted Zone
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: hostedZoneId,
        zoneName: config.baseDomain,
      }
    );

    // ===================
    // VPC
    // ===================
    const vpcConstruct = new VpcConstruct(this, "Vpc", {
      envName: config.envName,
      config: config.vpc,
      naming,
    });

    // ===================
    // Database (Aurora Serverless v2)
    // ===================
    const databaseConstruct = new DatabaseConstruct(this, "Database", {
      envName: config.envName,
      vpc: vpcConstruct.vpc,
      config: config.aurora,
      naming,
    });

    // ===================
    // Auth (Cognito)
    // ===================
    const authConstruct = new AuthConstruct(this, "Auth", {
      envName: config.envName,
      frontendUrl: `https://${domains.frontend}`,
      naming,
    });

    // ===================
    // ECR Repository
    // ===================
    const ecrConstruct = new EcrConstruct(this, "Ecr", {
      envName: config.envName,
      naming,
    });

    // ===================
    // Frontend (S3 + CloudFront)
    // ===================
    const frontendConstruct = new FrontendConstruct(this, "Frontend", {
      envName: config.envName,
      domainName: domains.frontend,
      hostedZone,
      naming,
    });

    // ===================
    // Backend Secret (create new one for AIT stack)
    // ===================
    const backendSecret = new secretsmanager.Secret(this, "BackendSecret", {
      secretName: `ait-${envCode}-ue1-sm-backend-01`,
      description: "Backend secrets for AIT application",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          DATABASE_URL: `postgresql://postgres:PLACEHOLDER@${databaseConstruct.cluster.clusterEndpoint.hostname}:5432/admin_panel`,
        }),
        generateStringKey: "TEMP_KEY",
      },
    });

    // ===================
    // Backend (ECS Fargate + ALB)
    // ===================
    const ecsConfig = {
      ...config.ecs,
      desiredCount: config.ecs.desiredCount,
    };

    const backendConstruct = new BackendConstruct(this, "Backend", {
      envName: config.envName,
      vpc: vpcConstruct.vpc,
      ecrRepository: ecrConstruct.repository,
      backendSecret,
      cognitoUserPoolId: authConstruct.userPool.userPoolId,
      cognitoClientId: authConstruct.userPoolClient.userPoolClientId,
      domainName: domains.backend,
      frontendUrl: `https://${domains.frontend}`,
      hostedZone,
      config: ecsConfig,
      naming,
    });

    // Allow Fargate to connect to Aurora
    databaseConstruct.allowConnectionsFrom(
      backendConstruct.getSecurityGroup(),
      "Allow Fargate to connect to Aurora"
    );

    // ===================
    // Outputs
    // ===================
    new cdk.CfnOutput(this, "VpcId", {
      value: vpcConstruct.vpc.vpcId,
      description: "VPC ID",
    });

    new cdk.CfnOutput(this, "AuroraClusterEndpoint", {
      value: databaseConstruct.cluster.clusterEndpoint.hostname,
      description: "Aurora Cluster Endpoint",
    });

    new cdk.CfnOutput(this, "AuroraSecretArn", {
      value: databaseConstruct.secret.secretArn,
      description: "Aurora Credentials Secret ARN",
    });

    new cdk.CfnOutput(this, "BackendSecretArn", {
      value: backendSecret.secretArn,
      description: "Backend Secret ARN (update with DATABASE_URL)",
    });

    new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: authConstruct.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "CognitoClientId", {
      value: authConstruct.userPoolClient.userPoolClientId,
      description: "Cognito Client ID",
    });

    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: ecrConstruct.repository.repositoryUri,
      description: "ECR Repository URI",
    });

    new cdk.CfnOutput(this, "FrontendUrl", {
      value: `https://${domains.frontend}`,
      description: "Frontend URL",
    });

    new cdk.CfnOutput(this, "BackendUrl", {
      value: `https://${domains.backend}`,
      description: "Backend URL",
    });

    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: frontendConstruct.distribution.distributionId,
      description: "CloudFront Distribution ID",
    });

    new cdk.CfnOutput(this, "S3BucketName", {
      value: frontendConstruct.bucket.bucketName,
      description: "S3 Bucket Name",
    });

    new cdk.CfnOutput(this, "EcsClusterName", {
      value: backendConstruct.cluster.clusterName,
      description: "ECS Cluster Name",
    });

    new cdk.CfnOutput(this, "EcsServiceName", {
      value: backendConstruct.service.serviceName,
      description: "ECS Service Name",
    });
  }
}
