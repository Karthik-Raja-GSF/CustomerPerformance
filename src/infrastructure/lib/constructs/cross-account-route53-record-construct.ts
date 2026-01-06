import * as cdk from "aws-cdk-lib";
import * as cr from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

// CloudFront hosted zone ID is always Z2FDTNDATAQYW2 for all distributions
const CLOUDFRONT_HOSTED_ZONE_ID = "Z2FDTNDATAQYW2";

export interface CrossAccountRoute53RecordConstructProps {
  /**
   * The full domain name for the A record (e.g., "ait.tratin.com")
   */
  recordName: string;

  /**
   * The hosted zone ID in the target account (dev account)
   */
  hostedZoneId: string;

  /**
   * ARN of the IAM role in the target account that can manage Route53 records
   */
  delegationRoleArn: string;

  /**
   * The target for the A record - either CloudFront or ALB
   */
  target:
    | { type: "cloudfront"; distribution: cloudfront.IDistribution }
    | { type: "alb"; loadBalancer: elbv2.IApplicationLoadBalancer };
}

/**
 * Creates a Route53 A record (alias) in a cross-account hosted zone
 * by assuming a delegation role in the target account.
 *
 * This construct uses AwsCustomResource to call Route53 APIs
 * while assuming the cross-account delegation role.
 */
export class CrossAccountRoute53RecordConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: CrossAccountRoute53RecordConstructProps
  ) {
    super(scope, id);

    const { recordName, hostedZoneId, delegationRoleArn, target } = props;

    // Determine target DNS name and hosted zone ID based on target type
    let targetDnsName: string;
    let targetHostedZoneId: string;

    if (target.type === "cloudfront") {
      targetDnsName = target.distribution.distributionDomainName;
      targetHostedZoneId = CLOUDFRONT_HOSTED_ZONE_ID;
    } else {
      targetDnsName = target.loadBalancer.loadBalancerDnsName;
      targetHostedZoneId =
        target.loadBalancer.loadBalancerCanonicalHostedZoneId;
    }

    // Ensure recordName ends with a dot for Route53 API
    const fqdn = recordName.endsWith(".") ? recordName : `${recordName}.`;

    // Create an execution role that can assume the delegation role
    const customResourceRole = new iam.Role(this, "CustomResourceRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: `Role for cross-account Route53 record creation for ${recordName}`,
    });

    // Grant permission to assume the cross-account delegation role
    customResourceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["sts:AssumeRole"],
        resources: [delegationRoleArn],
      })
    );

    // Grant basic Lambda execution permissions
    customResourceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );

    // Create the A record using AwsCustomResource with role assumption
    const sdkCallParams = {
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Comment: `A record for ${recordName} (cross-account)`,
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: fqdn,
              Type: "A",
              AliasTarget: {
                HostedZoneId: targetHostedZoneId,
                DNSName: targetDnsName,
                EvaluateTargetHealth: false,
              },
            },
          },
        ],
      },
    };

    const deleteParams = {
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Comment: `Delete A record for ${recordName}`,
        Changes: [
          {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: fqdn,
              Type: "A",
              AliasTarget: {
                HostedZoneId: targetHostedZoneId,
                DNSName: targetDnsName,
                EvaluateTargetHealth: false,
              },
            },
          },
        ],
      },
    };

    new cr.AwsCustomResource(this, "Route53Record", {
      onCreate: {
        service: "Route53",
        action: "changeResourceRecordSets",
        parameters: sdkCallParams,
        physicalResourceId: cr.PhysicalResourceId.of(
          `${hostedZoneId}-${recordName}-A`
        ),
        assumedRoleArn: delegationRoleArn,
      },
      onUpdate: {
        service: "Route53",
        action: "changeResourceRecordSets",
        parameters: sdkCallParams,
        physicalResourceId: cr.PhysicalResourceId.of(
          `${hostedZoneId}-${recordName}-A`
        ),
        assumedRoleArn: delegationRoleArn,
      },
      onDelete: {
        service: "Route53",
        action: "changeResourceRecordSets",
        parameters: deleteParams,
        assumedRoleArn: delegationRoleArn,
      },
      role: customResourceRole,
      // Policy is handled by the role we created
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Output for confirmation
    new cdk.CfnOutput(this, "CrossAccountRecordCreated", {
      value: `${recordName} -> ${targetDnsName}`,
      description: "Cross-account A record created",
    });
  }
}
