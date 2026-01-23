/**
 * WAF Configuration for AIT Infrastructure
 *
 * Defines configuration for AWS WAFv2 WebACLs protecting
 * CloudFront (frontend) and ALB (backend API).
 */

export interface WafRateLimitConfig {
  /** Requests per 5-minute window per IP */
  requestsPerFiveMinutes: number;
  /** Action when limit exceeded: 'block' | 'count' */
  action: "block" | "count";
}

export interface WafManagedRuleConfig {
  /** AWS Managed Rule Group name */
  name: string;
  /** Vendor name (always 'AWS' for managed rules) */
  vendorName: string;
  /** Priority (lower = evaluated first) */
  priority: number;
  /** Override action: 'none' (use rule action) | 'count' (monitor only) */
  overrideAction: "none" | "count";
  /** Specific rules to exclude (rule action overrides) */
  excludedRules?: string[];
}

export interface WafConfig {
  /** Enable WAF protection */
  enabled: boolean;

  /** CloudFront WAF settings */
  cloudfront: {
    enabled: boolean;
    /** Rate limiting for frontend */
    rateLimit: WafRateLimitConfig;
    /** Use count mode for all rules (monitoring without blocking) */
    countModeOnly: boolean;
  };

  /** ALB WAF settings */
  alb: {
    enabled: boolean;
    /** Rate limiting for API */
    rateLimit: WafRateLimitConfig;
    /** Use count mode for all rules (monitoring without blocking) */
    countModeOnly: boolean;
  };

  /** Enable CloudWatch metrics */
  enableMetrics: boolean;

  /** Enable WAF logging to CloudWatch Logs */
  enableLogging: boolean;

  /** Log retention in days */
  logRetentionDays: number;
}

/**
 * Default WAF configurations per environment
 * Both environments use active blocking mode with same rate limits
 */
export const defaultWafConfigs: Record<"dev" | "prd", WafConfig> = {
  dev: {
    enabled: true,
    cloudfront: {
      enabled: true,
      rateLimit: {
        requestsPerFiveMinutes: 1000,
        action: "block",
      },
      countModeOnly: false,
    },
    alb: {
      enabled: true,
      rateLimit: {
        requestsPerFiveMinutes: 500,
        action: "block",
      },
      countModeOnly: false,
    },
    enableMetrics: true,
    enableLogging: true,
    logRetentionDays: 7,
  },

  prd: {
    enabled: true,
    cloudfront: {
      enabled: true,
      rateLimit: {
        requestsPerFiveMinutes: 1000,
        action: "block",
      },
      countModeOnly: false,
    },
    alb: {
      enabled: true,
      rateLimit: {
        requestsPerFiveMinutes: 500,
        action: "block",
      },
      countModeOnly: false,
    },
    enableMetrics: true,
    enableLogging: true,
    logRetentionDays: 30,
  },
};

/**
 * AWS Managed Rule Groups to apply
 * Priority values determine evaluation order (lower = first)
 */
export const managedRuleGroups: WafManagedRuleConfig[] = [
  {
    name: "AWSManagedRulesAmazonIpReputationList",
    vendorName: "AWS",
    priority: 10,
    overrideAction: "none",
  },
  {
    name: "AWSManagedRulesCommonRuleSet",
    vendorName: "AWS",
    priority: 20,
    overrideAction: "none",
    // Exclude rules that may cause false positives for SPAs
    excludedRules: [
      "SizeRestrictions_BODY", // May block large JSON payloads
    ],
  },
  {
    name: "AWSManagedRulesKnownBadInputsRuleSet",
    vendorName: "AWS",
    priority: 30,
    overrideAction: "none",
  },
  {
    name: "AWSManagedRulesSQLiRuleSet",
    vendorName: "AWS",
    priority: 40,
    overrideAction: "none",
  },
];
