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
  natGateways: number;
  maxAzs: number;
}

export interface EnvironmentConfig {
  envName: string;
  domainPrefix: string; // 'dev', 'prod', 'staging', '' (empty for root)
  baseDomain: string; // 'tratin.com'
  aurora: AuroraConfig;
  ecs: EcsConfig;
  vpc: VpcConfig;
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
      natGateways: 1,
      maxAzs: 2,
    },
  },
  prod: {
    envName: "prod",
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
      natGateways: 2, // 2 NAT for HA
      maxAzs: 2,
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
