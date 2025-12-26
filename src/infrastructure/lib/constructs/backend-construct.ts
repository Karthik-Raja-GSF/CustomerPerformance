import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EcsConfig } from "../config/environments";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface BackendConstructProps {
  envName: string;
  vpc: ec2.IVpc;
  ecrRepository: ecr.IRepository;
  backendSecret: secretsmanager.ISecret;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  domainName: string;
  frontendUrl: string;
  hostedZone: route53.IHostedZone;
  config: EcsConfig;
  naming: NamingConfig;
}

export class BackendConstruct extends Construct {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: BackendConstructProps) {
    super(scope, id);

    const {
      vpc,
      ecrRepository,
      backendSecret,
      cognitoUserPoolId,
      cognitoClientId,
      domainName,
      frontendUrl,
      hostedZone,
      config,
      naming,
    } = props;

    // Generate resource names
    const n = createNamingHelper(naming);
    const clusterName = n.name(ResourceTypes.ECS, "cluster", "01");
    const serviceName = n.name(ResourceTypes.ECS, "backend", "01");
    const taskFamily = n.name(ResourceTypes.ECS, "task", "01");
    const containerName = n.name(ResourceTypes.ECS, "container", "01");
    const logGroupName = n.logGroup("backend", "01");
    const otelServiceName = `ait-${naming.env}-backend`;
    const albName = n.name(ResourceTypes.ALB, "backend", "01");
    const tgName = n.name(ResourceTypes.TARGET_GROUP, "backend", "01");
    const albSgName = n.name(ResourceTypes.SECURITY_GROUP, "alb", "01");
    const ecsSgName = n.name(ResourceTypes.SECURITY_GROUP, "ecs", "01");
    const certName = n.name(ResourceTypes.ROUTE53, "cert-backend", "01");
    const httpsListenerName = n.name(ResourceTypes.ALB, "https-listener", "01");
    const httpListenerName = n.name(ResourceTypes.ALB, "http-listener", "01");

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName,
      containerInsights: true,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: config.cpu,
      memoryLimitMiB: config.memory,
      family: taskFamily,
    });

    // Grant Bedrock permissions
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*",
        ],
      })
    );

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Container
    const container = taskDefinition.addContainer("backend", {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, "latest"),
      containerName,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "backend",
        logGroup,
      }),
      environment: {
        PORT: "8887",
        NODE_ENV: "production",
        CORS_ORIGIN: frontendUrl,
        AWS_REGION: cdk.Aws.REGION,
        AWS_COGNITO_USER_POOL_ID: cognitoUserPoolId,
        AWS_COGNITO_CLIENT_ID: cognitoClientId,
        OTEL_SERVICE_NAME: otelServiceName,
        OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
        OTEL_METRICS_EXPORTER: "none",
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(
          backendSecret,
          "DATABASE_URL"
        ),
      },
      healthCheck: {
        command: [
          "CMD-SHELL",
          "curl -f http://localhost:8887/health || exit 1",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 8887,
      protocol: ecs.Protocol.TCP,
    });

    // Grant read access to the secret (explicit grant for proper IAM policy)
    backendSecret.grantRead(taskDefinition.executionRole!);

    // ACM Certificate
    this.certificate = new acm.Certificate(this, "Certificate", {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Security Group for ALB
    const albSecurityGroup = new ec2.SecurityGroup(this, "ALBSecurityGroup", {
      vpc,
      securityGroupName: albSgName,
      description: "Security group for ALB",
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS"
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP for redirect"
    );

    // Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc,
      loadBalancerName: albName,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      targetGroupName: tgName,
      port: 8887,
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

    // HTTPS Listener
    const httpsListener = this.loadBalancer.addListener("HTTPSListener", {
      port: 443,
      certificates: [this.certificate],
      defaultTargetGroups: [targetGroup],
    });

    // HTTP to HTTPS redirect
    const httpListener = this.loadBalancer.addListener("HTTPListener", {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    // Security Group for ECS Service
    const serviceSecurityGroup = new ec2.SecurityGroup(
      this,
      "ServiceSecurityGroup",
      {
        vpc,
        securityGroupName: ecsSgName,
        description: "Security group for ECS service",
        allowAllOutbound: true,
      }
    );
    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(8887),
      "Allow ALB to reach container"
    );

    // ECS Service - allows desiredCount: 0
    this.service = new ecs.FargateService(this, "Service", {
      cluster: this.cluster,
      taskDefinition,
      serviceName,
      desiredCount: config.desiredCount,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [serviceSecurityGroup],
      circuitBreaker: {
        rollback: true,
      },
      minHealthyPercent: config.desiredCount === 0 ? 0 : 100,
      maxHealthyPercent: 200,
    });

    // Register service with target group (only if desiredCount > 0)
    if (config.desiredCount > 0) {
      this.service.attachToApplicationTargetGroup(targetGroup);
    }

    // Route53 A record
    new route53.ARecord(this, "AliasRecord", {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(this.loadBalancer)
      ),
    });

    // Tags
    addStandardTags(this.cluster, naming.env, clusterName);
    addStandardTags(this.service, naming.env, serviceName);
    addStandardTags(taskDefinition, naming.env, taskFamily);
    addStandardTags(this.loadBalancer, naming.env, albName);
    addStandardTags(httpsListener, naming.env, httpsListenerName);
    addStandardTags(httpListener, naming.env, httpListenerName);
    addStandardTags(albSecurityGroup, naming.env, albSgName);
    addStandardTags(serviceSecurityGroup, naming.env, ecsSgName);
    addStandardTags(targetGroup, naming.env, tgName);
    addStandardTags(logGroup, naming.env, logGroupName);
    addStandardTags(this.certificate, naming.env, certName);
  }

  /**
   * Get the security group of the Fargate service
   */
  public getSecurityGroup(): ec2.ISecurityGroup {
    return this.service.connections.securityGroups[0];
  }
}
