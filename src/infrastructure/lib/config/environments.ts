// src/infastructure/lib/config/environments.ts

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
}

export interface EnvironmentConfig {
  envName: string;
  domainPrefix: string; // 'dev', 'prod', 'staging', '' (empty for root)
  baseDomain: string; // 'tratin.com'
  aurora: AuroraConfig;
  ecs: EcsConfig;
  vpc: VpcConfig;
  vpcPeering?: VpcPeeringConfig;
  dms?: DmsConfig;
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    envName: "dev",
    domainPrefix: "dev", // dev.tratin.com, dev-be.tratin.com
    baseDomain: "tratin.com",
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
      tableMappingsFile: "lib/config/dms/table-mappings.full-load.guestdata_ait_views.json",
      taskSettingsFile: "lib/config/dms/task-settings.full-load.json",

      sourceSchemaName: "AIT",
      targetSchemaName: "dw2_nav",

      useGuestdataSourceEndpoint: true,
      guestdataDatabaseName: "GUESTDATA",

      // AUTO-RUN full load task after deploy CS 1/6/26
      startTaskOnDeploy: true,
      startTaskType: "start-replication",
      replicationTaskOrdinal: "02",
    },
  },

  prd: {
    envName: "prd",
    domainPrefix: "", // ait.tratin.com (без префикса dev)
    baseDomain: "tratin.com",
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
      accepted: false, // Set to true after peering is accepted in AWS console
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

      tableMappingsFile: "lib/config/dms/table-mappings.full-load.guestdata_ait_views.json",
      taskSettingsFile: "lib/config/dms/task-settings.full-load.json",

      sourceSchemaName: "AIT",
      targetSchemaName: "dw2_nav",

      // Use Guestdata endpoint in prod as well
      useGuestdataSourceEndpoint: true,
      guestdataDatabaseName: "GUESTDATA",

      startTaskOnDeploy: true,
      startTaskType: "start-replication",
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
