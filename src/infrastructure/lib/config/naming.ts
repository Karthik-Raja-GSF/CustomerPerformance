/**
 * AWS Resource Naming Convention
 *
 * Pattern: [project]-[environment]-[region]-[resource-type]-[scope]-[id]
 * Example: ait-dev-ue1a-sg-public-01
 *
 * @see aws-naming.md for full documentation
 */

export type Environment = "dev" | "prd";
export type Region = "ue1" | "gbl";

export interface ResourceNameParams {
  env: Environment;
  region: Region;
  resourceType: string;
  scope?: string;
  id?: string;
}

const PROJECT = "ait";

/**
 * Resource type codes per aws-naming.md
 */
export const ResourceTypes = {
  // Compute
  EC2: "ec2",
  ECS: "ecs",
  EKS: "eks",
  LAMBDA: "lam",
  ASG: "asg",

  // Networking
  VPC: "vpc",
  VPC_PEERING: "pcx",
  SUBNET: "sn",
  SECURITY_GROUP: "sg",
  IGW: "igw",
  NAT: "nat",
  ROUTE_TABLE: "rt",
  EIP: "eip",
  KEY_PAIR: "kp",
  ALB: "alb",
  NLB: "nlb",
  TARGET_GROUP: "tg",

  // Database
  RDS: "rds",
  EFS: "efs",

  // Storage
  S3: "s3",
  ECR: "ecr",

  // CDN & DNS
  CLOUDFRONT: "cf",
  ROUTE53: "r53",

  // Auth
  COGNITO: "cog",

  // Messaging
  SQS: "sqs",
  SNS: "sns",

  // Security & Secrets
  IAM: "iam",
  KMS: "kms",
  SECRETS_MANAGER: "sm",

  // Monitoring
  CLOUDWATCH: "cw",
  CLOUDWATCH_ALARM: "cw-alarm",

  // Scheduling
  SCHEDULER: "scheduler",
  SCHEDULER_GROUP: "scheduler-grp",
} as const;

/**
 * Creates a resource name following the naming convention
 *
 * @example
 * createResourceName({ env: 'dev', region: 'ue1', resourceType: 'vpc', scope: 'main', id: '01' })
 * // => 'ait-dev-ue1-vpc-main-01'
 *
 * @example
 * createResourceName({ env: 'dev', region: 'gbl', resourceType: 's3', scope: 'webapp', id: '01' })
 * // => 'ait-dev-gbl-s3-webapp-01'
 */
export function createResourceName(params: ResourceNameParams): string {
  const { env, region, resourceType, scope, id = "01" } = params;

  const parts = [PROJECT, env, region, resourceType];

  if (scope) {
    parts.push(scope);
  }

  parts.push(id);

  return parts.join("-");
}

/**
 * Creates a resource name with environment-specific suffix for uniqueness
 * Useful for globally unique resources like S3 buckets
 */
export function createGlobalResourceName(
  params: ResourceNameParams,
  accountId: string
): string {
  const baseName = createResourceName(params);
  return `${baseName}-${accountId}`;
}

/**
 * Creates a CloudWatch log group name
 *
 * @example
 * createLogGroupName('dev', 'ue1', 'backend', '01')
 * // => '/ecs/ait-dev-ue1-backend-01'
 */
export function createLogGroupName(
  env: Environment,
  region: Region,
  scope: string,
  id: string = "01"
): string {
  return `/ecs/${PROJECT}-${env}-${region}-${scope}-${id}`;
}

/**
 * Helper to determine if a resource should use 'gbl' or regional code
 */
export function isGlobalResource(resourceType: string): boolean {
  const globalTypes = [
    ResourceTypes.S3,
    ResourceTypes.CLOUDFRONT,
    ResourceTypes.COGNITO,
    ResourceTypes.IAM,
    ResourceTypes.ROUTE53,
    ResourceTypes.ECR,
  ];
  return globalTypes.includes(resourceType as (typeof globalTypes)[number]);
}

/**
 * Naming config for constructs
 */
export interface NamingConfig {
  env: Environment;
  region: Region;
  accountId: string;
}

/**
 * Creates a naming helper bound to specific environment
 */
export function createNamingHelper(config: NamingConfig) {
  return {
    name: (
      resourceType: string,
      scope?: string,
      id?: string,
      region?: Region
    ) =>
      createResourceName({
        env: config.env,
        region: region ?? config.region,
        resourceType,
        scope,
        id,
      }),

    globalName: (resourceType: string, scope?: string, id?: string) =>
      createResourceName({
        env: config.env,
        region: "gbl",
        resourceType,
        scope,
        id,
      }),

    uniqueName: (resourceType: string, scope?: string, id?: string) =>
      createGlobalResourceName(
        {
          env: config.env,
          region: "gbl",
          resourceType,
          scope,
          id,
        },
        config.accountId
      ),

    logGroup: (scope: string, id?: string) =>
      createLogGroupName(config.env, config.region, scope, id),
  };
}
