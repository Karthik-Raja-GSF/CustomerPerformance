import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvironmentConfig, getDomainNames } from "../config/environments";
import { VpcConstruct } from "../constructs/vpc-construct";
import { DatabaseConstruct } from "../constructs/database-construct";
import { AuthConstruct } from "../constructs/auth-construct";
import { EcrConstruct } from "../constructs/ecr-construct";
import { FrontendConstruct } from "../constructs/frontend-construct";
import { BackendConstruct } from "../constructs/backend-construct";

export interface GsfStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  hostedZoneId: string;
}

export class GsfStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GsfStackProps) {
    super(scope, id, props);

    const { config, hostedZoneId } = props;
    const domains = getDomainNames(config);

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
    });

    // ===================
    // Database (Aurora Serverless v2)
    // ===================
    const databaseConstruct = new DatabaseConstruct(this, "Database", {
      envName: config.envName,
      vpc: vpcConstruct.vpc,
      config: config.aurora,
    });

    // ===================
    // Auth (Cognito)
    // ===================
    const authConstruct = new AuthConstruct(this, "Auth", {
      envName: config.envName,
      frontendUrl: `https://${domains.frontend}`,
    });

    // ===================
    // ECR Repository
    // ===================
    const ecrConstruct = new EcrConstruct(this, "Ecr", {
      envName: config.envName,
    });

    // ===================
    // Frontend (S3 + CloudFront)
    // ===================
    const frontendConstruct = new FrontendConstruct(this, "Frontend", {
      envName: config.envName,
      domainName: domains.frontend,
      hostedZone,
    });

    // ===================
    // Import existing backend secrets (contains DATABASE_URL)
    // Use fromSecretNameV2 - ECS resolves by name (same as working gsf-backend stack)
    // ===================
    const backendSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "BackendSecret",
      "gsf-dev-backend-secrets"
    );

    // ===================
    // Backend (ECS Fargate + ALB)
    // ===================
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
      config: config.ecs,
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
