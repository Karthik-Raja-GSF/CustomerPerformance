import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { VpcConfig } from "../config/environments";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface VpcConstructProps {
  envName: string;
  config: VpcConfig;
  naming?: NamingConfig;
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    const { envName, config, naming } = props;

    // Use new naming if config provided, otherwise fall back to legacy naming
    const vpcName = naming
      ? createNamingHelper(naming).name(ResourceTypes.VPC, "main", "01")
      : `gsf-${envName}-vpc`;

    this.vpc = new ec2.Vpc(this, "Vpc", {
      vpcName,
      maxAzs: config.maxAzs,
      natGateways: config.natGateways,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: "isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Add VPC Flow Logs for debugging (optional, can be removed for cost savings)
    this.vpc.addFlowLog("FlowLog", {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
      trafficType: ec2.FlowLogTrafficType.REJECT,
    });

    // Tags - use standard tags if naming config provided
    if (naming) {
      addStandardTags(this.vpc, naming.env);

      // Add Name tags to subnets
      const n = createNamingHelper(naming);
      this.vpc.publicSubnets.forEach((subnet, i) => {
        cdk.Tags.of(subnet).add(
          "Name",
          n.name(ResourceTypes.SUBNET, "public", `0${i + 1}`)
        );
      });
      this.vpc.privateSubnets.forEach((subnet, i) => {
        cdk.Tags.of(subnet).add(
          "Name",
          n.name(ResourceTypes.SUBNET, "private", `0${i + 1}`)
        );
      });
      this.vpc.isolatedSubnets.forEach((subnet, i) => {
        cdk.Tags.of(subnet).add(
          "Name",
          n.name(ResourceTypes.SUBNET, "isolated", `0${i + 1}`)
        );
      });
    } else {
      cdk.Tags.of(this.vpc).add("Environment", envName);
      cdk.Tags.of(this.vpc).add("ManagedBy", "CDK");
    }
  }
}
