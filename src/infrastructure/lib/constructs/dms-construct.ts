import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as dms from "aws-cdk-lib/aws-dms";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { DmsConfig } from "../config/environments";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface DmsConstructProps {
  envName: string;
  vpc: ec2.IVpc;
  naming: NamingConfig;
  config: DmsConfig;

  // Source: DW2 SQL Server (via VPC peering)
  sourceSecret: secretsmanager.ISecret;

  // Target: Aurora PostgreSQL
  auroraCluster: rds.IDatabaseCluster;
  auroraSecret: secretsmanager.ISecret;
  auroraSecurityGroup: ec2.ISecurityGroup;
  targetDatabaseName: string; // Database name in Aurora to replicate to
}

/**
 * Construct for AWS Database Migration Service (DMS) resources.
 * Creates a replication instance, source endpoint (SQL Server), and target endpoint (Aurora PostgreSQL).
 */
export class DmsConstruct extends Construct {
  public readonly replicationInstance: dms.CfnReplicationInstance;
  public readonly sourceEndpoint: dms.CfnEndpoint;
  public readonly targetEndpoint: dms.CfnEndpoint;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DmsConstructProps) {
    super(scope, id);

    const {
      envName,
      vpc,
      naming,
      config,
      sourceSecret,
      auroraCluster,
      auroraSecret,
      auroraSecurityGroup,
      targetDatabaseName,
    } = props;

    // Generate resource names
    const n = createNamingHelper(naming);
    const sgName = n.name(ResourceTypes.SECURITY_GROUP, "dms", "01");
    const subnetGroupName = n.name("dms", "subnet", "01");
    const replInstanceId = n.name("dms", "repl", "01");
    const sourceEndpointId = n.name("dms", "src", "01");
    const targetEndpointId = n.name("dms", "tgt", "01");

    // ===================
    // Security Group for DMS
    // ===================
    this.securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      securityGroupName: sgName,
      description: `Security group for AIT ${envName} DMS Replication Instance`,
      allowAllOutbound: true,
    });

    // ===================
    // DMS IAM Service Roles (required with exact names)
    // ===================
    const dmsVpcRole = new iam.Role(this, "DmsVpcRole", {
      roleName: "dms-vpc-role",
      assumedBy: new iam.ServicePrincipal("dms.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonDMSVPCManagementRole"
        ),
      ],
    });

    const dmsCloudWatchRole = new iam.Role(this, "DmsCloudWatchRole", {
      roleName: "dms-cloudwatch-logs-role",
      assumedBy: new iam.ServicePrincipal("dms.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonDMSCloudWatchLogsRole"
        ),
      ],
    });

    // ===================
    // DMS Replication Subnet Group
    // ===================
    const subnetIds = vpc.privateSubnets.map((subnet) => subnet.subnetId);

    const subnetGroup = new dms.CfnReplicationSubnetGroup(this, "SubnetGroup", {
      replicationSubnetGroupIdentifier: subnetGroupName,
      replicationSubnetGroupDescription: `DMS Subnet Group for AIT ${envName} - Private subnets with egress`,
      subnetIds: subnetIds,
    });

    // Ensure IAM roles are created before subnet group
    subnetGroup.node.addDependency(dmsVpcRole);
    subnetGroup.node.addDependency(dmsCloudWatchRole);

    // ===================
    // DMS Replication Instance
    // ===================
    this.replicationInstance = new dms.CfnReplicationInstance(
      this,
      "ReplicationInstance",
      {
        replicationInstanceIdentifier: replInstanceId,
        replicationInstanceClass: config.instanceClass,
        allocatedStorage: config.allocatedStorage,
        replicationSubnetGroupIdentifier:
          subnetGroup.replicationSubnetGroupIdentifier,
        vpcSecurityGroupIds: [this.securityGroup.securityGroupId],
        multiAz: config.multiAz,
        publiclyAccessible: config.publiclyAccessible,
        engineVersion: "3.5.3",
        autoMinorVersionUpgrade: true,
      }
    );

    // Ensure subnet group is created before replication instance
    this.replicationInstance.addDependency(subnetGroup);

    // ===================
    // Source Endpoint (SQL Server - DW2)
    // ===================
    this.sourceEndpoint = new dms.CfnEndpoint(this, "SourceEndpoint", {
      endpointIdentifier: sourceEndpointId,
      endpointType: "source",
      engineName: "sqlserver",

      // Connection info from DW2 secret
      serverName: "10.200.6.172",
      port: 1433,
      databaseName: "DW2",
      username: "SysAI",
      password: cdk.SecretValue.secretsManager(sourceSecret.secretArn, {
        jsonField: "password",
      }).unsafeUnwrap(),

      sslMode: "none",
    });

    // ===================
    // Target Endpoint (Aurora PostgreSQL)
    // ===================
    this.targetEndpoint = new dms.CfnEndpoint(this, "TargetEndpoint", {
      endpointIdentifier: targetEndpointId,
      endpointType: "target",
      engineName: "aurora-postgresql",

      serverName: auroraCluster.clusterEndpoint.hostname,
      port: auroraCluster.clusterEndpoint.port,
      databaseName: targetDatabaseName,
      username: "postgres",
      password: cdk.SecretValue.secretsManager(auroraSecret.secretArn, {
        jsonField: "password",
      }).unsafeUnwrap(),

      sslMode: "require",
    });

    // ===================
    // Allow DMS to connect to Aurora
    // ===================
    (auroraSecurityGroup as ec2.SecurityGroup).addIngressRule(
      this.securityGroup,
      ec2.Port.tcp(5432),
      "Allow DMS replication instance to connect to Aurora"
    );

    // ===================
    // Tags
    // ===================
    addStandardTags(this.securityGroup, naming.env, sgName);
    cdk.Tags.of(this.replicationInstance).add("Name", replInstanceId);
    cdk.Tags.of(this.sourceEndpoint).add("Name", sourceEndpointId);
    cdk.Tags.of(this.targetEndpoint).add("Name", targetEndpointId);
    cdk.Tags.of(subnetGroup).add("Name", subnetGroupName);
  }
}
