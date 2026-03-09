import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { AlbListenerTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface NlbStaticIpConstructProps {
  vpc: ec2.IVpc;
  alb: elbv2.IApplicationLoadBalancer;
  albListener: elbv2.ApplicationListener;
  naming: NamingConfig;
  staticIps?: string[]; // Optional static private IPs (one per AZ)
}

export class NlbStaticIpConstruct extends Construct {
  public readonly nlb: elbv2.NetworkLoadBalancer;

  constructor(scope: Construct, id: string, props: NlbStaticIpConstructProps) {
    super(scope, id);

    const { vpc, albListener, naming, staticIps } = props;

    const n = createNamingHelper(naming);
    const nlbName = n.name(ResourceTypes.NLB, "webapp", "01");
    const tgName = n.name(ResourceTypes.TARGET_GROUP, "nlb-alb", "01");
    const listenerName = n.name(ResourceTypes.NLB, "tcp-listener", "01");

    // Build subnet mappings with optional static private IPs
    const privateSubnets = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    }).subnets;

    const subnetMappings: elbv2.SubnetMapping[] = privateSubnets.map(
      (subnet, i) => ({
        subnet,
        ...(staticIps?.[i] ? { privateIpv4Address: staticIps[i] } : {}),
      })
    );

    // Internal Network Load Balancer
    this.nlb = new elbv2.NetworkLoadBalancer(this, "NLB", {
      vpc,
      loadBalancerName: nlbName,
      internetFacing: false,
      crossZoneEnabled: true,
      subnetMappings,
    });

    // Target Group — ALB as target
    const targetGroup = new elbv2.NetworkTargetGroup(this, "AlbTargetGroup", {
      vpc,
      targetGroupName: tgName,
      port: 80,
      protocol: elbv2.Protocol.TCP,
      targetType: elbv2.TargetType.ALB,
      targets: [new AlbListenerTarget(albListener)],
      healthCheck: {
        protocol: elbv2.Protocol.HTTP,
        path: "/health",
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        interval: cdk.Duration.seconds(30),
      },
    });

    // TCP Listener on port 80
    const listener = this.nlb.addListener("TCPListener", {
      port: 80,
      protocol: elbv2.Protocol.TCP,
      defaultTargetGroups: [targetGroup],
    });

    // Tags
    addStandardTags(this.nlb, naming.env, nlbName);
    addStandardTags(targetGroup, naming.env, tgName);
    addStandardTags(listener, naming.env, listenerName);
  }
}
