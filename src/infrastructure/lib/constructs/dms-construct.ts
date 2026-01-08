// src/infastructure/lib/constructs/dms-construct.ts

import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as dms from "aws-cdk-lib/aws-dms";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import * as fs from "fs";
import * as path from "path";
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

// Adds a schema rename transformation rule to DMS mappings if missing.
function ensureSchemaRenameRule(
  mappingsObj: any,
  sourceSchema: string,
  targetSchema: string
): any {
  if (!mappingsObj || typeof mappingsObj !== "object") return mappingsObj;
  if (!sourceSchema || !targetSchema) return mappingsObj;
  if (sourceSchema === targetSchema) return mappingsObj;

  if (!Array.isArray(mappingsObj.rules)) mappingsObj.rules = [];
  const rules = mappingsObj.rules;

  const exists = rules.some((r: any) => {
    return (
      r?.["rule-type"] === "transformation" &&
      r?.["rule-target"] === "schema" &&
      r?.["rule-action"] === "rename" &&
      r?.["object-locator"]?.["schema-name"] === sourceSchema &&
      r?.["value"] === targetSchema
    );
  });

  if (exists) return mappingsObj;

  const usedIds = new Set(
    rules
      .map((r: any) => String(r?.["rule-id"] ?? ""))
      .filter((x: string) => x.length > 0)
  );

  let ruleId = 9000;
  while (usedIds.has(String(ruleId))) ruleId++;

  const safeName = `rename_schema_${sourceSchema}_to_${targetSchema}`.replace(
    /[^a-zA-Z0-9_]/g,
    "_"
  );

  const schemaRenameRule = {
    "rule-type": "transformation",
    "rule-id": String(ruleId),
    "rule-name": safeName,
    "rule-target": "schema",
    "object-locator": { "schema-name": sourceSchema },
    "rule-action": "rename",
    value: targetSchema,
  };

  rules.unshift(schemaRenameRule);
  return mappingsObj;
}

export class DmsConstruct extends Construct {
  public readonly replicationInstance: dms.CfnReplicationInstance;

  // Keep BOTH endpoints so neither gets destroyed CS 1/7/26
  public readonly dw2SourceEndpoint: dms.CfnEndpoint; // src-01 (retained)
  public readonly guestdataSourceEndpoint: dms.CfnEndpoint; // src-02 (active)

  public readonly sourceEndpoint: dms.CfnEndpoint;

  public readonly targetEndpoint: dms.CfnEndpoint;

  public readonly replicationTask: dms.CfnReplicationTask;

  public readonly legacyReplicationTask?: dms.CfnReplicationTask;

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

    // Defaults
    const sourceSchemaName = config.sourceSchemaName ?? "nav";
    const targetSchemaName = config.targetSchemaName ?? "dw2_nav";
    const startTaskOnDeploy = config.startTaskOnDeploy ?? true;
    const startTaskType = config.startTaskType ?? "start-replication";

    // Generate resource names
    const n = createNamingHelper(naming);
    const sgName = n.name(ResourceTypes.SECURITY_GROUP, "dms", "01");
    const subnetGroupName = n.name("dms", "subnet", "01");
    const replInstanceId = n.name("dms", "repl", "01");

    // IMPORTANT: keep existing endpoint identifiers stable CS 1/7/26
    const dw2SourceEndpointId = n.name("dms", "src", "01"); // ait-dev-ue1-dms-src-01
    const guestdataSourceEndpointId = n.name("dms", "src", "02"); // ait-dev-ue1-dms-src-02

    const targetEndpointId = n.name("dms", "tgt", "01");
    // const replTaskId = n.name("dms", "task", "01"); // Temporarily disabled

    // -----------------------
    // Replication task ordinals
    // -----------------------
    const cfgAny: any = config;

    const normalizeOrdinal = (v: any, fallback: string) => {
      const s = String(v ?? "").trim();
      if (!s) return fallback;
      if (s.length === 1) return `0${s}`;
      return s;
    };

    const legacyTaskOrdinal = "01";
    const legacyReplTaskId = n.name("dms", "task", legacyTaskOrdinal);

    const activeTaskOrdinal = normalizeOrdinal(
      cfgAny.replicationTaskOrdinal ?? cfgAny.replicationTaskNumber,
      legacyTaskOrdinal
    );
    const activeReplTaskId = n.name("dms", "task", activeTaskOrdinal);

    const createTaskV2 = activeTaskOrdinal !== legacyTaskOrdinal;

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
      subnetIds,
    });

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

    this.replicationInstance.addDependency(subnetGroup);

    // ===================
    // Source Endpoint #1 (DW2) - KEEP (do not delete)
    // ===================
    this.dw2SourceEndpoint = new dms.CfnEndpoint(this, "SourceEndpoint", {
      endpointIdentifier: dw2SourceEndpointId,
      endpointType: "source",
      engineName: "sqlserver",
      serverName: cdk.SecretValue.secretsManager(sourceSecret.secretArn, {
        jsonField: "host",
      }).unsafeUnwrap(),
      port: 1433,
      databaseName: cdk.SecretValue.secretsManager(sourceSecret.secretArn, {
        jsonField: "database",
      }).unsafeUnwrap(),
      username: cdk.SecretValue.secretsManager(sourceSecret.secretArn, {
        jsonField: "username",
      }).unsafeUnwrap(),
      password: cdk.SecretValue.secretsManager(sourceSecret.secretArn, {
        jsonField: "password",
      }).unsafeUnwrap(),
      sslMode: "none",
    });

    // ===================
    // Source Endpoint #2 (Guestdata) - ACTIVE
    // ===================
    this.guestdataSourceEndpoint = new dms.CfnEndpoint(
      this,
      "GuestdataSourceEndpoint",
      {
        endpointIdentifier: guestdataSourceEndpointId,
        endpointType: "source",
        engineName: "sqlserver",

        serverName: cdk.SecretValue.secretsManager(sourceSecret.secretArn, {
          jsonField: "host",
        }).unsafeUnwrap(),
        port: 1433,

        databaseName: "GUESTDATA",

        username: cdk.SecretValue.secretsManager(sourceSecret.secretArn, {
          jsonField: "username",
        }).unsafeUnwrap(),
        password: cdk.SecretValue.secretsManager(sourceSecret.secretArn, {
          jsonField: "password",
        }).unsafeUnwrap(),

        sslMode: "none",
      }
    );

    this.sourceEndpoint = this.guestdataSourceEndpoint;

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
      username: cdk.SecretValue.secretsManager(auroraSecret.secretArn, {
        jsonField: "username",
      }).unsafeUnwrap(),
      password: cdk.SecretValue.secretsManager(auroraSecret.secretArn, {
        jsonField: "password",
      }).unsafeUnwrap(),
      sslMode: "require",
    });

    // Allow DMS to connect to Aurora
    (auroraSecurityGroup as ec2.SecurityGroup).addIngressRule(
      this.securityGroup,
      ec2.Port.tcp(5432),
      "Allow DMS replication instance to connect to Aurora"
    );

    // ===================
    // Replication Task (FULL LOAD)
    // ===================
    const tableMappingsPath = path.resolve(
      process.cwd(),
      config.tableMappingsFile ?? "lib/config/dms/table-mappings.full-load.json"
    );

    const taskSettingsPath = path.resolve(
      process.cwd(),
      config.taskSettingsFile ?? "lib/config/dms/task-settings.full-load.json"
    );

    const mappingsObj = JSON.parse(fs.readFileSync(tableMappingsPath, "utf8"));
    const patchedMappingsObj = ensureSchemaRenameRule(
      mappingsObj,
      sourceSchemaName,
      targetSchemaName
    );

    const tableMappings = JSON.stringify(patchedMappingsObj);
    const replicationTaskSettings = JSON.stringify(
      JSON.parse(fs.readFileSync(taskSettingsPath, "utf8"))
    );

    const legacyTask = new dms.CfnReplicationTask(
      this,
      "GuestdataReplicationTask",
      {
        replicationTaskIdentifier: legacyReplTaskId,
        migrationType: "full-load",
        replicationInstanceArn: this.replicationInstance.ref,
        sourceEndpointArn: this.sourceEndpoint.ref,
        targetEndpointArn: this.targetEndpoint.ref,
        tableMappings,
        replicationTaskSettings,
      }
    );

    legacyTask.addDependency(this.replicationInstance);
    legacyTask.addDependency(this.sourceEndpoint);
    legacyTask.addDependency(this.targetEndpoint);
    legacyTask.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.legacyReplicationTask = legacyTask;

    let activeTask: dms.CfnReplicationTask = legacyTask;

    if (createTaskV2) {
      const taskV2 = new dms.CfnReplicationTask(
        this,
        "GuestdataReplicationTaskV2",
        {
          replicationTaskIdentifier: activeReplTaskId,
          migrationType: "full-load",
          replicationInstanceArn: this.replicationInstance.ref,
          sourceEndpointArn: this.sourceEndpoint.ref,
          targetEndpointArn: this.targetEndpoint.ref,
          tableMappings,
          replicationTaskSettings,
        }
      );

      taskV2.addDependency(this.replicationInstance);
      taskV2.addDependency(this.sourceEndpoint);
      taskV2.addDependency(this.targetEndpoint);

      activeTask = taskV2;
    }

    this.replicationTask = activeTask;

    // ===================
    // AUTO-START 
    // ===================
    if (startTaskOnDeploy) {
      const taskArn = this.replicationTask.ref;
      const activeTaskIdForResourceIds = activeReplTaskId;

      const startTask = new cr.AwsCustomResource(this, "StartReplicationTaskV2", {
        onCreate: {
          service: "DMS",
          action: "startReplicationTask",
          parameters: {
            ReplicationTaskArn: taskArn,
            StartReplicationTaskType: startTaskType,
          },
          outputPaths: [],
          ignoreErrorCodesMatching: "InvalidResourceStateFault",
          physicalResourceId: cr.PhysicalResourceId.of(
            `${activeTaskIdForResourceIds}-start-${envName}-v2`
          ),
        },

        onUpdate: {
          service: "DMS",
          action: "startReplicationTask",
          parameters: {
            ReplicationTaskArn: taskArn,
            StartReplicationTaskType: startTaskType,
          },
          outputPaths: [],
          ignoreErrorCodesMatching: "InvalidResourceStateFault",
          physicalResourceId: cr.PhysicalResourceId.of(
            `${activeTaskIdForResourceIds}-start-${envName}-v2`
          ),
        },

        onDelete: {
          service: "DMS",
          action: "stopReplicationTask",
          parameters: {
            ReplicationTaskArn: taskArn,
          },
          outputPaths: [],
          ignoreErrorCodesMatching:
            "InvalidResourceStateFault|ResourceNotFoundFault",
          physicalResourceId: cr.PhysicalResourceId.of(
            `${activeTaskIdForResourceIds}-stop-${envName}-v2`
          ),
        },

        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
          resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      });

      startTask.node.addDependency(this.replicationTask);
    }

    // ===================
    // Tags
    // ===================
    addStandardTags(this.securityGroup, naming.env, sgName);
    cdk.Tags.of(this.replicationInstance).add("Name", replInstanceId);

    cdk.Tags.of(this.dw2SourceEndpoint).add("Name", dw2SourceEndpointId);
    cdk.Tags.of(this.guestdataSourceEndpoint).add(
      "Name",
      guestdataSourceEndpointId
    );

    cdk.Tags.of(this.targetEndpoint).add("Name", targetEndpointId);

    // Tag both tasks if V2 exists
    cdk.Tags.of(legacyTask).add("Name", legacyReplTaskId);
    if (createTaskV2) {
      cdk.Tags.of(this.replicationTask).add("Name", activeReplTaskId);
    }

    cdk.Tags.of(subnetGroup).add("Name", subnetGroupName);
  }
}
