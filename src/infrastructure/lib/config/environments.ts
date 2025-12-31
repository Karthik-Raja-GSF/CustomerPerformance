export interface AuroraConfig {
  minCapacity: number; // ACU (0.5 - 128)
  maxCapacity: number; // ACU
  deletionProtection: boolean;
}

export interface EcsConfig {
  cpu: number;
  memory: number;
  desiredCount: number;
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

export interface DmsConfig {
  instanceClass: string; // e.g., "dms.t3.large"
  allocatedStorage: number; // GB
  multiAz: boolean;
  publiclyAccessible: boolean;
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
    },
    ecs: {
      cpu: 512, // 0.5 vCPU
      memory: 1024, // 1 GB
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
    },
  },
  prd: {
    envName: "prd",
    domainPrefix: "", // Configure later: '', 'prod', 'app', etc.
    baseDomain: "tratin.com",
    aurora: {
      minCapacity: 0.5, // Scales to 0.5 at idle
      maxCapacity: 8, // Max 8 ACU for load
      deletionProtection: true,
    },
    ecs: {
      cpu: 1024, // 1 vCPU
      memory: 2048, // 2 GB
      desiredCount: 2,
    },
    vpc: {
      cidr: "10.202.0.0/16",
      natGateways: 2, // 2 NAT for HA
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
      multiAz: true,
      publiclyAccessible: false,
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
