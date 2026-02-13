import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface PrivateHostedZoneConstructProps {
  envName: string;
  zoneName: string; // e.g., 'stg-ait.goldstarfoods.com'
  vpc: ec2.IVpc;
  naming: NamingConfig;
}

export class PrivateHostedZoneConstruct extends Construct {
  public readonly hostedZone: route53.PrivateHostedZone;

  constructor(
    scope: Construct,
    id: string,
    props: PrivateHostedZoneConstructProps
  ) {
    super(scope, id);

    const { zoneName, vpc, naming } = props;
    const n = createNamingHelper(naming);

    const resourceName = n.globalName(ResourceTypes.ROUTE53, "private", "01");

    this.hostedZone = new route53.PrivateHostedZone(this, "PrivateZone", {
      zoneName,
      vpc,
      comment: `Private hosted zone for ${zoneName}`,
    });

    addStandardTags(this.hostedZone, naming.env, resourceName);
  }
}
