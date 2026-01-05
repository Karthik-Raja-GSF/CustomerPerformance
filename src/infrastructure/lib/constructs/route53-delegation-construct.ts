import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface Route53DelegationConstructProps {
  hostedZoneId: string;
  trustedAccountId: string; // Prod account that can assume this role
  naming: NamingConfig;
}

/**
 * Creates an IAM Role that allows a trusted account to manage Route53 records
 * in a hosted zone. Used for cross-account DNS management.
 *
 * Deploy this in the account that owns the Route53 hosted zone (e.g., dev account).
 * The trusted account (e.g., prod account) can then assume this role to create
 * DNS records and ACM certificate validation records.
 */
export class Route53DelegationConstruct extends Construct {
  public readonly delegationRole: iam.Role;
  public readonly delegationRoleArn: string;

  constructor(
    scope: Construct,
    id: string,
    props: Route53DelegationConstructProps
  ) {
    super(scope, id);

    const { hostedZoneId, trustedAccountId, naming } = props;
    const n = createNamingHelper(naming);

    const roleName = n.name(ResourceTypes.IAM, "r53-delegate", "01");

    // IAM Role that prod account can assume
    this.delegationRole = new iam.Role(this, "DelegationRole", {
      roleName,
      assumedBy: new iam.AccountPrincipal(trustedAccountId),
      description: `Allows account ${trustedAccountId} to manage Route53 records in hosted zone ${hostedZoneId}`,
    });

    // Grant permissions to manage records in the hosted zone
    this.delegationRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ManageRoute53Records",
        effect: iam.Effect.ALLOW,
        actions: [
          "route53:ChangeResourceRecordSets",
          "route53:GetHostedZone",
          "route53:ListResourceRecordSets",
        ],
        resources: [`arn:aws:route53:::hostedzone/${hostedZoneId}`],
      })
    );

    // Grant permission to get change status (required for ACM DNS validation)
    this.delegationRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "GetChangeStatus",
        effect: iam.Effect.ALLOW,
        actions: ["route53:GetChange"],
        resources: ["arn:aws:route53:::change/*"],
      })
    );

    // Grant permission to list hosted zones (sometimes needed for lookups)
    this.delegationRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ListHostedZones",
        effect: iam.Effect.ALLOW,
        actions: ["route53:ListHostedZones", "route53:ListHostedZonesByName"],
        resources: ["*"],
      })
    );

    this.delegationRoleArn = this.delegationRole.roleArn;

    // Tags
    addStandardTags(this.delegationRole, naming.env, roleName);

    // Outputs
    new cdk.CfnOutput(this, "DelegationRoleArn", {
      value: this.delegationRoleArn,
      description: "IAM Role ARN for cross-account Route53 delegation",
      exportName: `ait-${naming.env}-route53-delegation-role-arn`,
    });

    new cdk.CfnOutput(this, "DelegationRoleName", {
      value: this.delegationRole.roleName,
      description: "IAM Role name for cross-account Route53 delegation",
    });
  }
}
