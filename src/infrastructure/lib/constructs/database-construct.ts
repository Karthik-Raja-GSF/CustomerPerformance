import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { AuroraConfig } from "../config/environments";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface DatabaseConstructProps {
  envName: string;
  vpc: ec2.IVpc;
  config: AuroraConfig;
  naming: NamingConfig;
}

export class DatabaseConstruct extends Construct {
  public readonly cluster: rds.DatabaseCluster;
  public readonly secret: secretsmanager.ISecret;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const { envName, vpc, config, naming } = props;

    // Generate resource names
    const n = createNamingHelper(naming);
    const sgName = n.name(ResourceTypes.SECURITY_GROUP, "db", "01");
    const clusterName = n.name(ResourceTypes.RDS, "app", "01");
    const secretName = n.name(ResourceTypes.SECRETS_MANAGER, "aurora", "01");

    // Security group for Aurora
    this.securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      securityGroupName: sgName,
      description: `Security group for AIT ${envName} Aurora Serverless v2`,
      allowAllOutbound: true,
    });

    // Aurora Serverless v2 PostgreSQL cluster
    this.cluster = new rds.DatabaseCluster(this, "Cluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      clusterIdentifier: clusterName,
      defaultDatabaseName: "admin_panel",
      credentials: rds.Credentials.fromGeneratedSecret("postgres", {
        secretName: secretName,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.securityGroup],
      serverlessV2MinCapacity: config.minCapacity,
      serverlessV2MaxCapacity: config.maxCapacity,
      writer: rds.ClusterInstance.serverlessV2("writer", {
        publiclyAccessible: false,
      }),
      backup: {
        retention: cdk.Duration.days(
          envName === "prod" || envName === "prd" ? 30 : 7
        ),
        preferredWindow: "03:00-04:00",
      },
      deletionProtection: config.deletionProtection,
      removalPolicy: config.deletionProtection
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.SNAPSHOT,
      storageEncrypted: true,
      cloudwatchLogsRetention: cdk.aws_logs.RetentionDays.ONE_MONTH,
      cloudwatchLogsExports: ["postgresql"],
    });

    // Get the generated secret
    this.secret = this.cluster.secret!;

    // Tags
    addStandardTags(this.cluster, naming.env, clusterName);
    addStandardTags(this.securityGroup, naming.env, sgName);
    addStandardTags(this.secret, naming.env, secretName);
  }

  /**
   * Allow connections from a security group
   */
  public allowConnectionsFrom(
    securityGroup: ec2.ISecurityGroup,
    description: string
  ) {
    this.securityGroup.addIngressRule(
      securityGroup,
      ec2.Port.tcp(5432),
      description
    );
  }

  /**
   * Get DATABASE_URL for the application
   * Note: This creates a reference, actual value resolved at deploy time
   */
  public getDatabaseUrl(): string {
    // This will be used in ECS task definition with secretsmanager reference
    return `postgresql://\${username}:\${password}@${this.cluster.clusterEndpoint.hostname}:${this.cluster.clusterEndpoint.port}/ait_procurement`;
  }
}
