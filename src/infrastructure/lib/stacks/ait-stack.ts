import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as route53 from "aws-cdk-lib/aws-route53";
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
import { BastionConstruct } from "../constructs/bastion-construct";
import { SecretsConstruct } from "../constructs/secrets-construct";
import { DmsConstruct } from "../constructs/dms-construct";
import { EventBridgeConstruct } from "../constructs/eventbridge-construct";
import { DashboardConstruct } from "../constructs/dashboard-construct";
import { Route53DelegationConstruct } from "../constructs/route53-delegation-construct";
import { WafConstruct } from "../constructs/waf-construct";
import { defaultWafConfigs } from "../config/waf-config";

export interface CrossAccountRoute53Config {
  roleArn: string; // ARN of IAM role in dev account that can manage Route53
  hostedZoneId: string; // Hosted zone ID in dev account
  zoneName: string; // tratin.com
}

export interface AitStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  hostedZoneId: string;
  // For dev: create delegation role for this account
  trustedAccountId?: string;
  // For prod: use cross-account Route53
  crossAccountRoute53?: CrossAccountRoute53Config;
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

    const { config, hostedZoneId, trustedAccountId, crossAccountRoute53 } =
      props;

    // AIT-specific domain names (different from GSF stack)
    const aitDomainPrefix =
      config.envName === "prd" ? "ait" : `ait-${config.envName}`;
    const domains = {
      frontend: `${aitDomainPrefix}.${config.baseDomain}`, // ait-dev.tratin.com
      backend: `${aitDomainPrefix}-be.${config.baseDomain}`, // ait-dev-be.tratin.com
    };

    // Create naming config for all constructs
    // Map envName to Environment type ('dev' | 'prd')
    const envCode: Environment = config.envName === "prd" ? "prd" : "dev";
    const naming: NamingConfig = {
      env: envCode,
      region: "ue1", // us-east-1
      accountId: cdk.Aws.ACCOUNT_ID,
    };

    // Apply standard tags to entire stack
    addStandardTags(this, naming.env);

    // Import existing Route53 Hosted Zone (only if same account)
    // For cross-account, hostedZone will be undefined - DNS records created manually
    const hostedZone = crossAccountRoute53
      ? undefined
      : route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
          hostedZoneId: hostedZoneId,
          zoneName: config.baseDomain,
        });

    // ===================
    // Route53 Delegation Role (for dev stack only)
    // ===================
    if (trustedAccountId && config.envName === "dev") {
      new Route53DelegationConstruct(this, "Route53Delegation", {
        hostedZoneId: hostedZoneId,
        trustedAccountId: trustedAccountId,
        naming,
      });
    }

    // ===================
    // VPC
    // ===================
    const vpcConstruct = new VpcConstruct(this, "Vpc", {
      envName: config.envName,
      config: config.vpc,
      naming,
    });

    // ===================
    // VPC Peering (imported - manually created)
    // ===================
    if (config.vpcPeering?.enabled && config.vpcPeering.peeringConnectionId) {
      // Routes will be added once peering is accepted
      if (config.vpcPeering.accepted) {
        // Add routes to isolated subnets (for DMS access to Aurora)
        vpcConstruct.vpc.isolatedSubnets.forEach((subnet, i) => {
          new ec2.CfnRoute(this, `VpcPeeringIsolatedRoute${i + 1}`, {
            routeTableId: subnet.routeTable.routeTableId,
            destinationCidrBlock: config.vpcPeering!.peerVpcCidr,
            vpcPeeringConnectionId: config.vpcPeering!.peeringConnectionId!,
          });
        });

        // Add routes to private subnets (for DMS replication instance access to peer VPC)
        vpcConstruct.vpc.privateSubnets.forEach((subnet, i) => {
          new ec2.CfnRoute(this, `VpcPeeringPrivateRoute${i + 1}`, {
            routeTableId: subnet.routeTable.routeTableId,
            destinationCidrBlock: config.vpcPeering!.peerVpcCidr,
            vpcPeeringConnectionId: config.vpcPeering!.peeringConnectionId!,
          });
        });
      }

      new cdk.CfnOutput(this, "VpcPeeringConnectionId", {
        value: config.vpcPeering.peeringConnectionId,
        description: "VPC Peering Connection ID (manually created)",
      });
    }

    // ===================
    // Database (Aurora Serverless v2)
    // ===================
    const databaseConstruct = new DatabaseConstruct(this, "Database", {
      envName: config.envName,
      vpc: vpcConstruct.vpc,
      config: config.aurora,
      naming,
    });

    // Allow DMS from peer VPC to connect to Aurora (via VPC peering)
    if (config.vpcPeering?.enabled && config.vpcPeering.accepted) {
      databaseConstruct.securityGroup.addIngressRule(
        ec2.Peer.ipv4(config.vpcPeering.peerVpcCidr),
        ec2.Port.tcp(5432),
        `Allow DMS from peer VPC (${config.vpcPeering.peerVpcCidr})`
      );
    }

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
    // WAF (Web Application Firewall) - CloudFront
    // Must be created before Frontend to pass WebACL ARN
    // ===================
    const wafConfig = config.waf || defaultWafConfigs[envCode];
    let cloudfrontWaf: WafConstruct | undefined;

    if (wafConfig.enabled && wafConfig.cloudfront.enabled) {
      cloudfrontWaf = new WafConstruct(this, "CloudFrontWaf", {
        naming,
        config: wafConfig,
        scope: "CLOUDFRONT",
        scopeId: "frontend",
      });
    }

    // ===================
    // Frontend (S3 + CloudFront)
    // ===================
    const frontendConstruct = new FrontendConstruct(this, "Frontend", {
      envName: config.envName,
      domainName: domains.frontend,
      hostedZone,
      naming,
      crossAccountRoute53,
      webAclId: cloudfrontWaf?.getWebAclArn(),
    });

    // ===================
    // External Database Secrets (DMS sources, StockIQ API)
    // ===================
    const secretsConstruct = new SecretsConstruct(this, "Secrets", {
      envName: config.envName,
      naming,
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
      databaseSecret: databaseConstruct.secret,
      siqSecret: secretsConstruct.siqSecret,
      cognitoUserPoolId: authConstruct.userPool.userPoolId,
      cognitoClientId: authConstruct.userPoolClient.userPoolClientId,
      domainName: domains.backend,
      frontendUrl: `https://${domains.frontend}`,
      hostedZone,
      config: ecsConfig,
      naming,
      crossAccountRoute53,
    });

    // Allow Fargate to connect to Aurora
    databaseConstruct.allowConnectionsFrom(
      backendConstruct.getSecurityGroup(),
      "Allow Fargate to connect to Aurora"
    );

    // ===================
    // WAF (Web Application Firewall) - ALB
    // ===================
    let albWaf: WafConstruct | undefined;

    if (wafConfig.enabled && wafConfig.alb.enabled) {
      albWaf = new WafConstruct(this, "AlbWaf", {
        naming,
        config: wafConfig,
        scope: "REGIONAL",
        scopeId: "backend",
      });

      // Associate WAF with ALB
      albWaf.associateWithAlb(backendConstruct.loadBalancer);
    }

    // ===================
    // Bastion Host (for database SSH tunnel access)
    // ===================
    const bastionConstruct = new BastionConstruct(this, "Bastion", {
      envName: config.envName,
      vpc: vpcConstruct.vpc,
      naming,
    });

    // Allow Bastion to connect to Aurora
    databaseConstruct.allowConnectionsFrom(
      bastionConstruct.securityGroup,
      "Allow Bastion SSH tunnel to Aurora"
    );

    // ===================
    // DMS (Database Migration Service)
    // ===================
    let dmsConstruct: DmsConstruct | undefined;
    if (
      config.dms &&
      config.vpcPeering?.enabled &&
      config.vpcPeering.accepted
    ) {
      dmsConstruct = new DmsConstruct(this, "Dms", {
        envName: config.envName,
        vpc: vpcConstruct.vpc,
        naming,
        config: config.dms,
        sourceSecret: secretsConstruct.dw2Secret,
        auroraCluster: databaseConstruct.cluster,
        auroraSecret: databaseConstruct.secret,
        auroraSecurityGroup: databaseConstruct.securityGroup,
        targetDatabaseName: config.aurora.databaseName,
      });
    }

    // ===================
    // EventBridge (Schedulers)
    // ===================
    let eventBridgeConstruct: EventBridgeConstruct | undefined;
    if (dmsConstruct && config.dms?.scheduler?.enabled) {
      eventBridgeConstruct = new EventBridgeConstruct(this, "EventBridge", {
        envName: config.envName,
        naming,
        dmsSchedulerConfig: config.dms.scheduler,
        replicationTaskArn: dmsConstruct.replicationTask.ref,
      });
    }

    // ===================
    // CloudWatch Dashboard
    // ===================
    const dashboardConstruct = new DashboardConstruct(this, "Dashboard", {
      naming,
    });

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

    new cdk.CfnOutput(this, "BastionPublicIp", {
      value: bastionConstruct.getPublicIp(),
      description: "Bastion Host Public IP (Elastic IP)",
    });

    new cdk.CfnOutput(this, "BastionKeyParameterName", {
      value: bastionConstruct.getPrivateKeyParameterName(),
      description: "SSM Parameter Store path for Bastion SSH private key",
    });

    new cdk.CfnOutput(this, "Dw2SecretArn", {
      value: secretsConstruct.dw2Secret.secretArn,
      description: "DW2 SQL Server Credentials Secret ARN (DMS source)",
    });

    new cdk.CfnOutput(this, "SiqSecretArn", {
      value: secretsConstruct.siqSecret.secretArn,
      description: "Stock IQ API Credentials Secret ARN",
    });

    // DMS Outputs

    if (dmsConstruct) {
      new cdk.CfnOutput(this, "DmsReplicationInstanceArn", {
        value: dmsConstruct.replicationInstance.ref,
        description: "DMS Replication Instance ARN",
      });

      // DW2 endpoint (src-01) CS 1/7/26
      new cdk.CfnOutput(this, "DmsSourceEndpointArn", {
        value: dmsConstruct.dw2SourceEndpoint.ref,
        description: "DMS Source Endpoint ARN (DW2 SQL Server)",
      });

      // Guestdata endpoint (src-02) CS 1/7/26
      new cdk.CfnOutput(this, "DmsGuestdataSourceEndpointArn", {
        value: dmsConstruct.guestdataSourceEndpoint.ref,
        description: "DMS Source Endpoint ARN (GUESTDATA SQL Server)",
      });

      new cdk.CfnOutput(this, "DmsTargetEndpointArn", {
        value: dmsConstruct.targetEndpoint.ref,
        description: "DMS Target Endpoint ARN (Aurora PostgreSQL)",
      });
    }

    // EventBridge Outputs
    if (eventBridgeConstruct) {
      new cdk.CfnOutput(this, "DmsSchedulerArn", {
        value: eventBridgeConstruct.dmsScheduleArn,
        description: "EventBridge Scheduler ARN for DMS replication task",
      });

      new cdk.CfnOutput(this, "DmsSchedulerRoleArn", {
        value: eventBridgeConstruct.dmsScheduleRole.roleArn,
        description: "IAM Role ARN for DMS EventBridge Scheduler",
      });
    }

    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#dashboards:name=${dashboardConstruct.dashboard.dashboardName}`,
      description: "CloudWatch Dashboard URL",
    });

    // WAF Outputs
    if (cloudfrontWaf) {
      new cdk.CfnOutput(this, "CloudFrontWafArn", {
        value: cloudfrontWaf.getWebAclArn(),
        description: "CloudFront WAF WebACL ARN",
      });
    }

    if (albWaf) {
      new cdk.CfnOutput(this, "AlbWafArn", {
        value: albWaf.getWebAclArn(),
        description: "ALB WAF WebACL ARN",
      });
    }
  }
}
