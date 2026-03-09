import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { EcsConfig } from "../config/environments";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface FrontendEcsConstructProps {
  envName: string;
  vpc: ec2.IVpc;
  cluster: ecs.ICluster;
  ecrRepository: ecr.IRepository;
  certificateArn?: string;
  config: EcsConfig;
  naming: NamingConfig;
  peerVpcCidr?: string;
}

export class FrontendEcsConstruct extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly httpListener: elbv2.ApplicationListener;
  public readonly certificate?: acm.ICertificate;

  constructor(scope: Construct, id: string, props: FrontendEcsConstructProps) {
    super(scope, id);

    const {
      vpc,
      cluster,
      ecrRepository,
      certificateArn,
      config,
      naming,
      peerVpcCidr,
    } = props;

    const n = createNamingHelper(naming);

    // Resource names
    const serviceName = n.name(ResourceTypes.ECS, "webapp", "01");
    const taskFamily = n.name(ResourceTypes.ECS, "webapp-task", "01");
    const containerName = n.name(ResourceTypes.ECS, "webapp-ctr", "01");
    const logGroupName = n.logGroup("webapp", "01");
    const albName = n.name(ResourceTypes.ALB, "webapp", "01");
    const tgName = n.name(ResourceTypes.TARGET_GROUP, "webapp", "01");
    const albSgName = n.name(ResourceTypes.SECURITY_GROUP, "webapp-alb", "01");
    const ecsSgName = n.name(ResourceTypes.SECURITY_GROUP, "webapp-ecs", "01");
    const httpsListenerName = n.name(ResourceTypes.ALB, "webapp-https", "01");
    const httpListenerName = n.name(ResourceTypes.ALB, "webapp-http", "01");

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName,
      retention:
        naming.env === "prd"
          ? logs.RetentionDays.ONE_MONTH
          : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Task Definition (lightweight -- nginx serving static files)
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: config.cpu,
      memoryLimitMiB: config.memory,
      family: taskFamily,
    });

    // Container
    const container = taskDefinition.addContainer("webapp", {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, "latest"),
      containerName,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "webapp",
        logGroup,
      }),
      healthCheck: {
        command: [
          "CMD-SHELL",
          "wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(15),
      },
    });

    container.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
    });

    // ACM Certificate for HTTPS on internal ALB (optional)
    // If no certificateArn provided, ALB runs HTTP-only.
    // Once the cert is validated, pass certificateArn to enable HTTPS.
    if (certificateArn) {
      this.certificate = acm.Certificate.fromCertificateArn(
        this,
        "Certificate",
        certificateArn
      );
    }

    // Security Group for Internal ALB
    const albSecurityGroup = new ec2.SecurityGroup(this, "ALBSecurityGroup", {
      vpc,
      securityGroupName: albSgName,
      description: "Security group for internal webapp ALB",
      allowAllOutbound: true,
    });

    // Allow HTTP from within VPC (always needed)
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(80),
      "Allow HTTP from VPC"
    );

    // Allow HTTPS from within VPC (only when certificate is configured)
    if (this.certificate) {
      albSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(vpc.vpcCidrBlock),
        ec2.Port.tcp(443),
        "Allow HTTPS from VPC"
      );
    }

    // Allow traffic from peered VPC
    if (peerVpcCidr) {
      albSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(peerVpcCidr),
        ec2.Port.tcp(80),
        "Allow HTTP from peered VPC"
      );
      if (this.certificate) {
        albSecurityGroup.addIngressRule(
          ec2.Peer.ipv4(peerVpcCidr),
          ec2.Port.tcp(443),
          "Allow HTTPS from peered VPC"
        );
      }
    }

    // Internal Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc,
      loadBalancerName: albName,
      internetFacing: false,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      targetGroupName: tgName,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/health",
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // Listeners: HTTPS + redirect when cert available, HTTP-only otherwise
    let httpsListener: elbv2.ApplicationListener | undefined;

    if (this.certificate) {
      // HTTPS Listener (primary)
      httpsListener = this.loadBalancer.addListener("HTTPSListener", {
        port: 443,
        certificates: [this.certificate],
        defaultTargetGroups: [targetGroup],
      });

      // HTTP → HTTPS redirect
      this.httpListener = this.loadBalancer.addListener("HTTPListener", {
        port: 80,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: "HTTPS",
          port: "443",
          permanent: true,
        }),
      });
    } else {
      // HTTP-only (no certificate)
      this.httpListener = this.loadBalancer.addListener("HTTPListener", {
        port: 80,
        defaultTargetGroups: [targetGroup],
      });
    }

    // Security Group for ECS Service
    const serviceSecurityGroup = new ec2.SecurityGroup(
      this,
      "ServiceSecurityGroup",
      {
        vpc,
        securityGroupName: ecsSgName,
        description: "Security group for webapp ECS service",
        allowAllOutbound: true,
      }
    );
    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(80),
      "Allow internal ALB to reach container"
    );

    // ECS Fargate Service
    this.service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      serviceName,
      desiredCount: config.desiredCount,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [serviceSecurityGroup],
      circuitBreaker: { rollback: true },
      minHealthyPercent: config.desiredCount === 0 ? 0 : 100,
      maxHealthyPercent: 200,
    });

    // Register service with target group
    if (config.desiredCount > 0) {
      this.service.attachToApplicationTargetGroup(targetGroup);
    }

    // Auto Scaling
    if (config.autoScaling && config.desiredCount > 0) {
      const scaling = this.service.autoScaleTaskCount({
        minCapacity: config.autoScaling.minCount,
        maxCapacity: config.autoScaling.maxCount,
      });

      scaling.scaleOnCpuUtilization("CpuScaling", {
        targetUtilizationPercent: config.autoScaling.cpuTargetPercent,
        scaleInCooldown: cdk.Duration.seconds(
          config.autoScaling.scaleInCooldown
        ),
        scaleOutCooldown: cdk.Duration.seconds(
          config.autoScaling.scaleOutCooldown
        ),
      });

      if (config.autoScaling.memoryTargetPercent) {
        scaling.scaleOnMemoryUtilization("MemoryScaling", {
          targetUtilizationPercent: config.autoScaling.memoryTargetPercent,
          scaleInCooldown: cdk.Duration.seconds(
            config.autoScaling.scaleInCooldown
          ),
          scaleOutCooldown: cdk.Duration.seconds(
            config.autoScaling.scaleOutCooldown
          ),
        });
      }
    }

    // Tags
    addStandardTags(this.service, naming.env, serviceName);
    addStandardTags(taskDefinition, naming.env, taskFamily);
    addStandardTags(this.loadBalancer, naming.env, albName);
    if (httpsListener) {
      addStandardTags(httpsListener, naming.env, httpsListenerName);
    }
    addStandardTags(this.httpListener, naming.env, httpListenerName);
    addStandardTags(albSecurityGroup, naming.env, albSgName);
    addStandardTags(serviceSecurityGroup, naming.env, ecsSgName);
    addStandardTags(targetGroup, naming.env, tgName);
    addStandardTags(logGroup, naming.env, logGroupName);
  }
}
