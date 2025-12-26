import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
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
  naming: NamingConfig;
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    const { config, naming } = props;

    // Generate resource names
    const n = createNamingHelper(naming);
    const vpcName = n.name(ResourceTypes.VPC, "main", "01");

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
    const flowLogGroupName = `/vpc/${n.name(ResourceTypes.VPC, "flow", "01")}`;
    const flowLogName = n.name(ResourceTypes.VPC, "flowlog", "01");

    const flowLogGroup = new logs.LogGroup(this, "FlowLogGroup", {
      logGroupName: flowLogGroupName,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const flowLog = this.vpc.addFlowLog("FlowLog", {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
      trafficType: ec2.FlowLogTrafficType.REJECT,
    });

    // Tags
    addStandardTags(this.vpc, naming.env, vpcName);
    addStandardTags(flowLogGroup, naming.env, flowLogGroupName);
    addStandardTags(flowLog, naming.env, flowLogName);

    // Add Name tags to subnets
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

    // Add Name tag to Internet Gateway
    const cfnIgw = this.vpc.node.findChild("IGW") as ec2.CfnInternetGateway;
    cdk.Tags.of(cfnIgw).add("Name", n.name(ResourceTypes.IGW, "main", "01"));

    // Add Name tags to Route Tables
    this.vpc.publicSubnets.forEach((subnet, i) => {
      const routeTable = subnet.node.findChild(
        "RouteTable"
      ) as ec2.CfnRouteTable;
      cdk.Tags.of(routeTable).add(
        "Name",
        n.name(ResourceTypes.ROUTE_TABLE, "public", `0${i + 1}`)
      );
    });
    this.vpc.privateSubnets.forEach((subnet, i) => {
      const routeTable = subnet.node.findChild(
        "RouteTable"
      ) as ec2.CfnRouteTable;
      cdk.Tags.of(routeTable).add(
        "Name",
        n.name(ResourceTypes.ROUTE_TABLE, "private", `0${i + 1}`)
      );
    });
    this.vpc.isolatedSubnets.forEach((subnet, i) => {
      const routeTable = subnet.node.findChild(
        "RouteTable"
      ) as ec2.CfnRouteTable;
      cdk.Tags.of(routeTable).add(
        "Name",
        n.name(ResourceTypes.ROUTE_TABLE, "isolated", `0${i + 1}`)
      );
    });

    // Add Name tags to NAT Gateways and their Elastic IPs
    this.vpc.publicSubnets.forEach((subnet, i) => {
      const natGateway = subnet.node.tryFindChild("NATGateway") as
        | ec2.CfnNatGateway
        | undefined;
      if (natGateway) {
        cdk.Tags.of(natGateway).add(
          "Name",
          n.name(ResourceTypes.NAT, "public", `0${i + 1}`)
        );
      }

      const eip = subnet.node.tryFindChild("EIP") as ec2.CfnEIP | undefined;
      if (eip) {
        cdk.Tags.of(eip).add(
          "Name",
          n.name(ResourceTypes.EIP, "nat", `0${i + 1}`)
        );
      }
    });
  }
}
