/**
 * AWS Resource Tagging Strategy
 *
 * All resources must have these standard tags for:
 * - Cost allocation
 * - Resource identification
 * - Compliance and governance
 *
 * @see aws-naming.md for full documentation
 */

import { Tags } from "aws-cdk-lib";
import { Construct } from "constructs";
import type { Environment } from "./naming";

export interface StandardTags {
  Company: string;
  Project: string;
  ProjectAbbr: string;
  Environment: string;
  Owner: string;
  CostCenter: string;
  ManagedBy: string;
}

const TAG_VALUES: Omit<StandardTags, "Environment"> = {
  Company: "GSF",
  Project: "AI Transformation",
  ProjectAbbr: "AIT",
  Owner: "RKrishnan@GSFoodsGroup.com",
  CostCenter: "gsf",
  ManagedBy: "CDK",
};

/**
 * Maps environment code to full environment name
 */
function getEnvironmentName(env: Environment): string {
  const envNames: Record<Environment, string> = {
    dev: "development",
    prd: "production",
  };
  return envNames[env];
}

/**
 * Adds all standard tags to a construct and its children
 *
 * @example
 * addStandardTags(this, 'dev');
 */
export function addStandardTags(construct: Construct, env: Environment): void {
  Tags.of(construct).add("Company", TAG_VALUES.Company);
  Tags.of(construct).add("Project", TAG_VALUES.Project);
  Tags.of(construct).add("ProjectAbbr", TAG_VALUES.ProjectAbbr);
  Tags.of(construct).add("Environment", getEnvironmentName(env));
  Tags.of(construct).add("Owner", TAG_VALUES.Owner);
  Tags.of(construct).add("CostCenter", TAG_VALUES.CostCenter);
  Tags.of(construct).add("ManagedBy", TAG_VALUES.ManagedBy);
}

/**
 * Adds a custom tag in addition to standard tags
 */
export function addCustomTag(
  construct: Construct,
  key: string,
  value: string
): void {
  Tags.of(construct).add(key, value);
}

/**
 * Gets all standard tag values (useful for resources that need tags as props)
 */
export function getStandardTagsObject(env: Environment): StandardTags {
  return {
    ...TAG_VALUES,
    Environment: getEnvironmentName(env),
  };
}
