// src/infastructure/lib/config/environments.ts

import { WafConfig, defaultWafConfigs } from "./waf-config";

export interface AuroraConfig {
  minCapacity: number; // ACU (0.5 - 128)
  maxCapacity: number; // ACU
  deletionProtection: boolean;
  databaseName: string; // Database name created in the cluster
}

export interface EcsAutoScalingConfig {
  minCount: number;
  maxCount: number;
  cpuTargetPercent: number; // Target CPU utilization (e.g., 70)
  memoryTargetPercent?: number; // Optional memory target
  scaleInCooldown: number; // Seconds
  scaleOutCooldown: number; // Seconds
}

export interface EcsConfig {
  cpu: number;
  memory: number;
  desiredCount: number;
  autoScaling?: EcsAutoScalingConfig;
}

export interface VpcConfig {
  cidr: string;
  natGateways: number;
  maxAzs: number;
}

export interface VpcPeeringConfig {
  enabled: boolean;
  accepted: boolean; // Initially false, set to true after manual acceptance in peer account
  peeringConnectionId?: string; // The manually-created peering connection ID (pcx-xxx)
  peerAccountId: string;
  peerVpcId: string;
  peerVpcCidr: string;
  peerRegion: string;
}

/**
 * DMS configuration.
 * CS 1/6/26
 * NOTE:
 * - sourceSchemaName is the schema name as it exists on SQL Server (DW2/GUESTDATA)
 * - targetSchemaName is the schema name DMS should create/use on Aurora PostgreSQL
 * - startTaskOnDeploy will auto-run the replication task after CloudFormation creates it
 */
export interface DmsConfig {
  instanceClass: string; // e.g., "dms.t3.large"
  allocatedStorage: number; // GB
  multiAz: boolean;
  publiclyAccessible: boolean;

  // PATHS TO DMS MAPPINGS AND TASK CONFIG JSON FILES CS 1/5/26
  tableMappingsFile?: string;
  taskSettingsFile?: string;

  // SCHEMA FIX: target must be "dw2_nav" CS 1/6/26
  sourceSchemaName?: string; // default "nav"
  targetSchemaName?: string; // default "dw2_nav"

  // AUTO-START the replication task after deploy CS 1/6/26
  startTaskOnDeploy?: boolean; // default true
  startTaskType?: "start-replication" | "resume-processing" | "reload-target"; // default "start-replication"

  useGuestdataSourceEndpoint?: boolean; // default false
  guestdataDatabaseName?: string; // "GUESTDATA"

  replicationTaskOrdinal?: string; // e.g. "02"
  replicationTaskNumber?: string; // alias for replicationTaskOrdinal

  // EventBridge Scheduler for automated daily reload
  scheduler?: DmsSchedulerConfig;
}

/**
 * EventBridge Scheduler configuration for DMS replication tasks.
 * Triggers StartReplicationTask API on schedule.
 */
export interface DmsSchedulerConfig {
  enabled: boolean;
  startTaskType: "start-replication" | "resume-processing" | "reload-target";
  scheduleExpression?: string; // default: "cron(0 2 * * ? *)" = 2am daily
  timezone?: string; // default: "America/Los_Angeles" (PST/PDT)
}

export interface RbacConfig {
  enabled: boolean;
  groupAdmin: string;
  groupSales: string;
  groupCatman: string;
  groupDemandPlanner: string;
  groupPurchasing: string;
  groupEarlyAdopter: string;
}

export interface NlbConfig {
  enabled: boolean;
  staticIps?: string[]; // Optional static private IPs (one per AZ, must be within private subnet CIDRs)
}

export interface EnvironmentConfig {
  envName: string;
  domainPrefix: string; // 'dev', 'prod', 'staging', '' (empty for root)
  baseDomain: string; // 'tratin.com'
  privateCertificateArn?: string; // ACM certificate ARN for private ALB HTTPS
  aurora: AuroraConfig;
  ecs: EcsConfig;
  vpc: VpcConfig;
  vpcPeering?: VpcPeeringConfig;
  dms?: DmsConfig;
  waf?: WafConfig;
  rbac?: RbacConfig; // Azure AD group-to-role mapping
  frontendEcs?: EcsConfig; // Private frontend deployment via nginx + ECS
  privateFrontendUrl?: string; // Private frontend URL managed by other team (e.g., 'https://aitdev.goldstarfoods.com')
  backendPublicAlb?: boolean; // Create public-facing backend ALB (default: true)
  publicFrontend?: boolean; // Create CloudFront + S3 frontend (default: true)
  nlb?: NlbConfig; // Internal NLB with static IPs in front of internal ALB
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    envName: "dev",
    domainPrefix: "dev", // dev.tratin.com, dev-be.tratin.com
    baseDomain: "tratin.com",
    privateFrontendUrl: "https://aitdev.goldstarfoods.com",
    backendPublicAlb: true,
    publicFrontend: true,
    aurora: {
      minCapacity: 0.5, // Min 0.5 ACU (~$0.06/hour when active)
      maxCapacity: 2, // Max 2 ACU
      deletionProtection: false,
      databaseName: "admin_panel", // Existing cluster - can't change CDK property but we manually updated to "ait_procurement"
    },
    ecs: {
      cpu: 1024, // 1 vCPU
      memory: 2048, // 2 GB
      desiredCount: 1,
    },
    vpc: {
      cidr: "10.201.0.0/16",
      natGateways: 1,
      maxAzs: 2,
    },
    vpcPeering: {
      enabled: true,
      accepted: true, // Set to true after peering is accepted in AWS console
      peeringConnectionId: "pcx-0e31d0c0741877224", // ait-dev-ue1-pcx-manual-01
      peerAccountId: "453645557030",
      peerVpcId: "vpc-08f53d4e5b55a8e67",
      peerVpcCidr: "10.200.0.0/20",
      peerRegion: "us-west-2",
    },
    dms: {
      instanceClass: "dms.t3.large",
      allocatedStorage: 50,
      multiAz: false,
      publiclyAccessible: false,

      // GUESTDATA VIEWS POINTERS TO TABLE MAPPING AND TASK SETTING JSON CS 1/6/26
      tableMappingsFile:
        "lib/config/dms/table-mappings.full-load.guestdata_ait_views.json",
      taskSettingsFile: "lib/config/dms/task-settings.full-load.json",

      sourceSchemaName: "AIT",
      targetSchemaName: "dw2_nav",

      useGuestdataSourceEndpoint: true,
      guestdataDatabaseName: "GUESTDATA",

      // AUTO-RUN full load task after deploy CS 1/6/26
      startTaskOnDeploy: true,
      startTaskType: "start-replication",
      replicationTaskOrdinal: "02",

      // EventBridge Scheduler: 2am PST daily reload
      scheduler: {
        enabled: true,
        startTaskType: "reload-target",
      },
    },
    waf: defaultWafConfigs.dev,
    rbac: {
      enabled: true,
      groupAdmin: "f2e25746-a556-4e57-a31f-735e08ef5cb1",
      groupSales: "dcdcdc52-d022-44db-b411-dee01c883879",
      groupCatman: "ceb05fa2-1f3c-4cd8-95f3-a20f6ef984db",
      groupDemandPlanner: "a31185f0-c0a8-494c-8883-8dada64e9849",
      groupPurchasing: "2341154d-ffd2-4c66-9d43-a42737d63f6e",
      groupEarlyAdopter: "9c5aba67-2af0-4e42-b0ed-cab449333bc6",
    },
    frontendEcs: {
      cpu: 256, // 0.25 vCPU (nginx is lightweight)
      memory: 512, // 512 MB
      desiredCount: 1, // Start at 0 — no image in ECR yet. CI/CD will push image and update.
    },
    nlb: {
      enabled: true,
      staticIps: ["10.201.2.10", "10.201.3.10"], // Pinned in private subnets (10.201.2.0/24, 10.201.3.0/24)
    },
  },

  prd: {
    envName: "prd",
    domainPrefix: "", // ait.tratin.com (без префикса dev)
    baseDomain: "tratin.com",
    privateFrontendUrl: "https://ait.goldstarfoods.com",
    backendPublicAlb: false,
    publicFrontend: false,
    aurora: {
      minCapacity: 0.5, // Scales to 0.5 at idle
      maxCapacity: 8, // Max 8 ACU for load
      deletionProtection: true,
      databaseName: "ait_procurement",
    },
    ecs: {
      cpu: 2048, // 2 vCPU
      memory: 4096, // 4 GB
      desiredCount: 2, // Start with 2 tasks for HA
      autoScaling: {
        minCount: 2, // Always at least 2 tasks (high availability)
        maxCount: 4,
        cpuTargetPercent: 70,
        memoryTargetPercent: 80,
        scaleInCooldown: 300, // 5 minutes
        scaleOutCooldown: 60, // 1 minute
      },
    },
    vpc: {
      cidr: "10.202.0.0/16",
      natGateways: 2, // 2 NAT gateways for high availability
      maxAzs: 2,
    },
    vpcPeering: {
      enabled: true,
      accepted: true, // Set to true after peering is accepted in AWS console pcx-016dbf30103212f69
      peeringConnectionId: "pcx-016dbf30103212f69", // ait-prd-ue1-pcx-manual-01
      peerAccountId: "453645557030",
      peerVpcId: "vpc-08f53d4e5b55a8e67",
      peerVpcCidr: "10.200.0.0/20",
      peerRegion: "us-west-2",
    },
    dms: {
      instanceClass: "dms.t3.large",
      allocatedStorage: 100,
      multiAz: false, // Single AZ для экономии
      publiclyAccessible: false,

      tableMappingsFile:
        "lib/config/dms/table-mappings.full-load.guestdata_ait_views.json",
      taskSettingsFile: "lib/config/dms/task-settings.full-load.json",

      sourceSchemaName: "AIT",
      targetSchemaName: "dw2_nav",

      // Use Guestdata endpoint in prod as well
      useGuestdataSourceEndpoint: true,
      guestdataDatabaseName: "GUESTDATA",

      startTaskOnDeploy: true,
      // startTaskType: "start-replication", THIS IS FOR INIT LOAD ONLY
      startTaskType: "reload-target", // THIS IS FOR EVENTBRIDGE SCHEDULER

      // EventBridge Scheduler: 2am PST daily reload
      scheduler: {
        enabled: true,
        startTaskType: "reload-target",
      },
    },
    waf: defaultWafConfigs.prd,
    rbac: {
      enabled: true,
      groupAdmin: "f2e25746-a556-4e57-a31f-735e08ef5cb1",
      groupSales: "dcdcdc52-d022-44db-b411-dee01c883879",
      groupCatman: "ceb05fa2-1f3c-4cd8-95f3-a20f6ef984db",
      groupDemandPlanner: "a31185f0-c0a8-494c-8883-8dada64e9849",
      groupPurchasing: "2341154d-ffd2-4c66-9d43-a42737d63f6e",
      groupEarlyAdopter: "9c5aba67-2af0-4e42-b0ed-cab449333bc6",
    },
    frontendEcs: {
      cpu: 256,
      memory: 512,
      desiredCount: 2, // 2 for HA
      autoScaling: {
        minCount: 2,
        maxCount: 4,
        cpuTargetPercent: 70,
        scaleInCooldown: 300, // 5 minutes
        scaleOutCooldown: 60, // 1 minute
      },
    },
    nlb: {
      enabled: true,
      staticIps: ["10.202.2.10", "10.202.3.10"], // Pinned in private subnets (10.202.2.0/24, 10.202.3.0/24)
    },
  },
};

// Helper to get domain names
export function getDomainNames(config: EnvironmentConfig) {
  const prefix = config.domainPrefix ? `${config.domainPrefix}.` : "";
  const bePrefix = config.domainPrefix ? `${config.domainPrefix}-be.` : "api.";

  return {
    frontend: `${prefix}${config.baseDomain}`,
    backend: `${bePrefix}${config.baseDomain}`,
  };
}
