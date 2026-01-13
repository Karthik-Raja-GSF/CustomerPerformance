// src/infrastructure/lib/constructs/eventbridge-construct.ts

import * as cdk from "aws-cdk-lib";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";
import { DmsSchedulerConfig } from "../config/environments";

export interface EventBridgeConstructProps {
  envName: string;
  naming: NamingConfig;
  dmsSchedulerConfig: DmsSchedulerConfig;
  replicationTaskArn: string;
}

/**
 * EventBridge construct for scheduled tasks.
 *
 * Currently supports:
 * - DMS replication task scheduling via Universal Target
 *
 * Default: 2am PST daily with reload-target task type.
 */
export class EventBridgeConstruct extends Construct {
  public readonly dmsSchedule: scheduler.CfnSchedule;
  public readonly dmsScheduleRole: iam.Role;
  public readonly scheduleGroup: scheduler.CfnScheduleGroup;
  public readonly dmsScheduleArn: string;

  constructor(scope: Construct, id: string, props: EventBridgeConstructProps) {
    super(scope, id);

    const { envName, naming, dmsSchedulerConfig, replicationTaskArn } = props;

    const n = createNamingHelper(naming);

    // Resource names following project naming convention
    const scheduleName = n.name(ResourceTypes.SCHEDULER, "dms", "01");
    const scheduleGroupName = n.name(
      ResourceTypes.SCHEDULER_GROUP,
      "dms",
      "01"
    );
    const roleName = n.name(ResourceTypes.IAM, "scheduler-dms", "01");

    // Schedule expression and timezone (with defaults)
    const scheduleExpression =
      dmsSchedulerConfig.scheduleExpression || "cron(0 2 * * ? *)"; // 2am daily
    const timezone = dmsSchedulerConfig.timezone || "America/Los_Angeles"; // PST/PDT

    // ===================
    // Schedule Group (for organization and management)
    // ===================
    this.scheduleGroup = new scheduler.CfnScheduleGroup(this, "ScheduleGroup", {
      name: scheduleGroupName,
    });

    // ===================
    // IAM Role for EventBridge Scheduler (DMS)
    // ===================
    this.dmsScheduleRole = new iam.Role(this, "DmsSchedulerRole", {
      roleName: roleName,
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      description: `IAM role for EventBridge Scheduler to trigger DMS replication task in ${envName}`,
    });

    // Grant permission to call DMS StartReplicationTask
    this.dmsScheduleRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowStartReplicationTask",
        effect: iam.Effect.ALLOW,
        actions: ["dms:StartReplicationTask"],
        resources: [replicationTaskArn],
      })
    );

    // ===================
    // EventBridge Schedule for DMS (Universal Target)
    // NOTE: Universal Target requires full AWS SDK service name "databasemigrationservice", not "dms"
    // ===================
    this.dmsSchedule = new scheduler.CfnSchedule(this, "DmsReloadSchedule", {
      name: scheduleName,
      groupName: this.scheduleGroup.name,
      description: `Daily ${timezone} trigger for DMS reload-target on ${envName}`,
      state: dmsSchedulerConfig.enabled ? "ENABLED" : "DISABLED",

      // Schedule expression with timezone (handles DST automatically)
      scheduleExpression: scheduleExpression,
      scheduleExpressionTimezone: timezone,

      flexibleTimeWindow: {
        mode: "OFF", // Execute at exact time
      },

      // Universal Target: Direct AWS API call to DMS
      // IMPORTANT: Use full service name "databasemigrationservice", not short alias "dms"
      target: {
        arn: "arn:aws:scheduler:::aws-sdk:databasemigration:startReplicationTask",
        roleArn: this.dmsScheduleRole.roleArn,
        input: JSON.stringify({
          ReplicationTaskArn: replicationTaskArn,
          StartReplicationTaskType: dmsSchedulerConfig.startTaskType,
        }),
        retryPolicy: {
          maximumEventAgeInSeconds: 3600, // 1 hour
          maximumRetryAttempts: 3,
        },
      },
    });

    // Ensure schedule is created after the group
    this.dmsSchedule.addDependency(this.scheduleGroup);

    // Construct ARN manually to avoid eventual consistency issues with attrArn
    // ARN format: arn:aws:scheduler:{region}:{account}:schedule/{group-name}/{schedule-name}
    this.dmsScheduleArn = `arn:aws:scheduler:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:schedule/${scheduleGroupName}/${scheduleName}`;

    // ===================
    // Tags
    // ===================
    cdk.Tags.of(this.scheduleGroup).add("Name", scheduleGroupName);
    cdk.Tags.of(this.dmsScheduleRole).add("Name", roleName);
    cdk.Tags.of(this.dmsSchedule).add("Name", scheduleName);
    addStandardTags(this, naming.env);
  }
}
