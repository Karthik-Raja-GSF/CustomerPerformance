import * as cdk from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";
import {
  WafConfig,
  managedRuleGroups,
  WafManagedRuleConfig,
} from "../config/waf-config";

export type WafScope = "CLOUDFRONT" | "REGIONAL";

export interface WafConstructProps {
  naming: NamingConfig;
  config: WafConfig;
  /** Scope for WebACL: CLOUDFRONT for CloudFront, REGIONAL for ALB */
  scope: WafScope;
  /** Identifier for this WAF instance (e.g., 'frontend', 'backend') */
  scopeId: string;
}

/**
 * WAF Construct - Creates AWS WAFv2 WebACL with managed rules
 *
 * Features:
 * - AWS Managed Rule Groups (OWASP Top 10, SQL injection, bad inputs, IP reputation)
 * - Rate limiting
 * - CloudWatch metrics
 * - Optional CloudWatch Logs logging
 *
 * Usage:
 * - CLOUDFRONT scope: Pass webAclArn to CloudFront distribution
 * - REGIONAL scope: Use associateWithAlb() method
 */
export class WafConstruct extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;
  public readonly logGroup?: logs.LogGroup;

  constructor(scope: Construct, id: string, props: WafConstructProps) {
    super(scope, id);

    const { naming, config, scope: wafScope, scopeId } = props;

    // Determine if we should use count mode
    const countModeOnly =
      wafScope === "CLOUDFRONT"
        ? config.cloudfront.countModeOnly
        : config.alb.countModeOnly;

    const rateLimitConfig =
      wafScope === "CLOUDFRONT"
        ? config.cloudfront.rateLimit
        : config.alb.rateLimit;

    // Generate resource names
    const n = createNamingHelper(naming);
    const webAclName =
      wafScope === "CLOUDFRONT"
        ? n.globalName(ResourceTypes.WAF, scopeId, "01")
        : n.name(ResourceTypes.WAF, scopeId, "01");

    // Build rules array
    const rules: wafv2.CfnWebACL.RuleProperty[] = [];
    let priorityCounter = 1;

    // 1. Rate Limiting Rule (highest priority)
    rules.push(
      this.createRateLimitRule(
        priorityCounter++,
        rateLimitConfig.requestsPerFiveMinutes,
        rateLimitConfig.action === "count" || countModeOnly,
        `${webAclName}-rate-limit`
      )
    );

    // 2. AWS Managed Rule Groups
    for (const managedRule of managedRuleGroups) {
      rules.push(
        this.createManagedRuleGroup(
          managedRule,
          priorityCounter++ * 10, // Space out priorities
          countModeOnly
        )
      );
    }

    // Create WebACL
    this.webAcl = new wafv2.CfnWebACL(this, "WebACL", {
      name: webAclName,
      description: `WAF WebACL for AIT ${naming.env} ${scopeId}`,
      scope: wafScope,
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: config.enableMetrics,
        metricName: webAclName,
        sampledRequestsEnabled: true,
      },
      rules,
    });

    // Create CloudWatch Log Group for WAF logging
    if (config.enableLogging) {
      // WAF log group names must start with "aws-waf-logs-"
      const logGroupName = `aws-waf-logs-${webAclName}`;
      this.logGroup = new logs.LogGroup(this, "LogGroup", {
        logGroupName,
        retention: this.getRetentionDays(config.logRetentionDays),
        removalPolicy:
          naming.env === "prd"
            ? cdk.RemovalPolicy.RETAIN
            : cdk.RemovalPolicy.DESTROY,
      });

      // WAF logging configuration
      new wafv2.CfnLoggingConfiguration(this, "LoggingConfig", {
        resourceArn: this.webAcl.attrArn,
        logDestinationConfigs: [this.logGroup.logGroupArn],
        loggingFilter: {
          DefaultBehavior: "DROP",
          Filters: [
            {
              Behavior: "KEEP",
              Conditions: [
                {
                  ActionCondition: { Action: "BLOCK" },
                },
              ],
              Requirement: "MEETS_ANY",
            },
            {
              Behavior: "KEEP",
              Conditions: [
                {
                  ActionCondition: { Action: "COUNT" },
                },
              ],
              Requirement: "MEETS_ANY",
            },
          ],
        },
      });

      addStandardTags(this.logGroup, naming.env, logGroupName);
    }

    // Tags
    addStandardTags(this.webAcl, naming.env, webAclName);
  }

  /**
   * Creates a rate-based rule for limiting requests per IP
   */
  private createRateLimitRule(
    priority: number,
    limit: number,
    countOnly: boolean,
    name: string
  ): wafv2.CfnWebACL.RuleProperty {
    return {
      name,
      priority,
      action: countOnly ? { count: {} } : { block: {} },
      statement: {
        rateBasedStatement: {
          aggregateKeyType: "IP",
          limit,
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: name,
        sampledRequestsEnabled: true,
      },
    };
  }

  /**
   * Creates a managed rule group statement
   */
  private createManagedRuleGroup(
    config: WafManagedRuleConfig,
    priority: number,
    countModeOnly: boolean
  ): wafv2.CfnWebACL.RuleProperty {
    // Build excluded rules array if specified
    const excludedRules = config.excludedRules?.map((ruleName) => ({
      name: ruleName,
    }));

    // Determine override action
    const overrideAction =
      countModeOnly || config.overrideAction === "count"
        ? { count: {} }
        : { none: {} };

    return {
      name: config.name,
      priority,
      overrideAction,
      statement: {
        managedRuleGroupStatement: {
          vendorName: config.vendorName,
          name: config.name,
          excludedRules,
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: config.name,
        sampledRequestsEnabled: true,
      },
    };
  }

  /**
   * Maps retention days to LogRetentionDays enum
   */
  private getRetentionDays(days: number): logs.RetentionDays {
    const mapping: Record<number, logs.RetentionDays> = {
      1: logs.RetentionDays.ONE_DAY,
      3: logs.RetentionDays.THREE_DAYS,
      5: logs.RetentionDays.FIVE_DAYS,
      7: logs.RetentionDays.ONE_WEEK,
      14: logs.RetentionDays.TWO_WEEKS,
      30: logs.RetentionDays.ONE_MONTH,
      60: logs.RetentionDays.TWO_MONTHS,
      90: logs.RetentionDays.THREE_MONTHS,
      365: logs.RetentionDays.ONE_YEAR,
    };
    return mapping[days] || logs.RetentionDays.ONE_MONTH;
  }

  /**
   * Associate this WebACL with an ALB (REGIONAL scope only)
   */
  public associateWithAlb(
    alb: elbv2.IApplicationLoadBalancer
  ): wafv2.CfnWebACLAssociation {
    return new wafv2.CfnWebACLAssociation(this, "AlbAssociation", {
      resourceArn: alb.loadBalancerArn,
      webAclArn: this.webAcl.attrArn,
    });
  }

  /**
   * Get the WebACL ARN for CloudFront association
   */
  public getWebAclArn(): string {
    return this.webAcl.attrArn;
  }
}
