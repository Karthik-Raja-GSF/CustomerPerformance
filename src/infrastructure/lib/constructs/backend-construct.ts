import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as fs from "fs";
import * as path from "path";
import { EcsConfig } from "../config/environments";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";
import { CrossAccountRoute53RecordConstruct } from "./cross-account-route53-record-construct";
import { CrossAccountRoute53Config } from "./frontend-construct";

export interface BackendConstructProps {
  envName: string;
  vpc: ec2.IVpc;
  ecrRepository: ecr.IRepository;
  databaseSecret: secretsmanager.ISecret;
  siqSecret: secretsmanager.ISecret;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  domainName: string;
  frontendUrl: string;
  hostedZone?: route53.IHostedZone; // Optional for cross-account
  certificateArn?: string; // Use existing cert if hostedZone not available
  config: EcsConfig;
  naming: NamingConfig;
  crossAccountRoute53?: CrossAccountRoute53Config; // For cross-account DNS
}

export class BackendConstruct extends Construct {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: BackendConstructProps) {
    super(scope, id);

    const {
      vpc,
      ecrRepository,
      databaseSecret,
      siqSecret,
      cognitoUserPoolId,
      cognitoClientId,
      domainName,
      frontendUrl,
      hostedZone,
      certificateArn,
      config,
      naming,
      crossAccountRoute53,
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

    // Read OTEL collector config from infrastructure config directory
    const otelConfigPath = path.join(
      __dirname,
      "../config/otel-collector-config.yaml"
    );
    const otelConfigContent = fs.readFileSync(otelConfigPath, "utf-8");

    // Store OTEL config in SSM Parameter Store
    // OTEL Contrib reads from OTEL_CONFIG env var via startup command
    const otelConfigParam = new ssm.StringParameter(
      this,
      "OtelCollectorConfig",
      {
        parameterName: `/ait/${naming.env}/otel-collector-config`,
        stringValue: otelConfigContent,
        description: `OTEL Collector Contrib configuration for AIT ${naming.env} backend`,
        tier: ssm.ParameterTier.ADVANCED, // Required for configs > 4KB
      }
    );

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: config.cpu,
      memoryLimitMiB: config.memory,
      family: taskFamily,
    });

    // Grant Bedrock permissions (including cross-region inference profile access)
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:GetInferenceProfile",
          "bedrock:ListInferenceProfiles",
        ],
        resources: [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*",
        ],
      })
    );

    // Grant AWS Marketplace permissions for Bedrock model access
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "aws-marketplace:ViewSubscriptions",
          "aws-marketplace:Subscribe",
        ],
        resources: ["*"],
      })
    );

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName,
      retention:
        naming.env === "prd"
          ? logs.RetentionDays.ONE_MONTH
          : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Container
    const container = taskDefinition.addContainer("backend", {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, "latest"),
      containerName,
      environment: {
        PORT: "8887",
        NODE_ENV: "production",
        CORS_ORIGIN: frontendUrl,
        AWS_REGION: cdk.Aws.REGION,
        AWS_COGNITO_USER_POOL_ID: cognitoUserPoolId,
        AWS_COGNITO_CLIENT_ID: cognitoClientId,
        // OpenTelemetry config - sends to ADOT Collector sidecar
        OTEL_SERVICE_NAME: otelServiceName,
        OTEL_SERVICE_VERSION: "1.0.0",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4317",
        // StockIQ scheduled sync - daily at 3:30 AM PST (11:30 UTC)
        STOCKIQ_SYNC_CRON: "30 11 * * *",
        // Customer Bid scheduled sync - daily at 5:00 AM PST (13:00 UTC)
        CUSTOMER_BID_SYNC_CRON: "0 13 * * *",
      },
      secrets: {
        // Pass Aurora secret fields individually - backend builds DATABASE_URL from these
        DB_USERNAME: ecs.Secret.fromSecretsManager(databaseSecret, "username"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(databaseSecret, "password"),
        DB_HOST: ecs.Secret.fromSecretsManager(databaseSecret, "host"),
        DB_PORT: ecs.Secret.fromSecretsManager(databaseSecret, "port"),
        DB_NAME: ecs.Secret.fromSecretsManager(databaseSecret, "dbname"),
        // StockIQ API credentials
        STOCKIQ_USERNAME: ecs.Secret.fromSecretsManager(siqSecret, "username"),
        STOCKIQ_PASSWORD: ecs.Secret.fromSecretsManager(siqSecret, "password"),
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

    // OTEL Collector Contrib Sidecar for OpenTelemetry export to AWS
    // Uses OTEL Contrib for transform processor support (flattens logs for CloudWatch)
    const otelCollector = taskDefinition.addContainer("otel-collector", {
      image: ecs.ContainerImage.fromRegistry(
        "otel/opentelemetry-collector-contrib:0.140.0"
      ),
      containerName: `${containerName}-otel`,
      essential: false, // Allow task to continue if collector fails
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "otel-collector",
        logGroup,
      }),
      environment: {
        AWS_REGION: cdk.Aws.REGION,
        ENVIRONMENT: naming.env,
        OTEL_SERVICE_NAME: otelServiceName,
      },
      secrets: {
        // Load config from SSM - passed directly to collector via --config=env:
        OTEL_CONFIG: ecs.Secret.fromSsmParameter(otelConfigParam),
      },
      // Read config directly from OTEL_CONFIG env var (no shell needed)
      // The collector supports env: URI scheme for config
      command: ["--config=env:OTEL_CONFIG"],
      cpu: 256,
      memoryLimitMiB: 512,
      // Note: Container health check removed - distroless image has no shell/wget
      // ECS service deployment circuit breaker handles unhealthy task detection
    });

    otelCollector.addPortMappings(
      { containerPort: 4317, protocol: ecs.Protocol.TCP }, // gRPC
      { containerPort: 4318, protocol: ecs.Protocol.TCP }, // HTTP
      { containerPort: 13133, protocol: ecs.Protocol.TCP } // Health check
    );

    // Grant execution role permission to read SSM parameter for OTEL config
    otelConfigParam.grantRead(taskDefinition.executionRole!);

    // Grant OTEL Collector permissions for X-Ray, CloudWatch Logs, and CloudWatch Metrics
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          // X-Ray permissions (PutSpans for OTLP, PutTraceSegments for legacy)
          "xray:PutSpans",
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries",
          // CloudWatch Logs permissions
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          // CloudWatch Metrics permissions
          "cloudwatch:PutMetricData",
        ],
        resources: ["*"],
      })
    );

    // Grant read access to the database secret (explicit grant for proper IAM policy)
    databaseSecret.grantRead(taskDefinition.executionRole!);
    siqSecret.grantRead(taskDefinition.executionRole!);

    // ACM Certificate
    // Import existing cert if ARN provided, otherwise create with DNS validation
    if (certificateArn) {
      this.certificate = acm.Certificate.fromCertificateArn(
        this,
        "Certificate",
        certificateArn
      );
    } else if (hostedZone) {
      this.certificate = new acm.Certificate(this, "Certificate", {
        domainName: domainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    } else {
      // No hosted zone and no cert ARN - create cert with DNS validation
      // User will need to manually add DNS validation records
      this.certificate = new acm.Certificate(this, "Certificate", {
        domainName: domainName,
        validation: acm.CertificateValidation.fromDns(),
      });
    }

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
    if (hostedZone) {
      // Same-account: use native Route53 construct
      new route53.ARecord(this, "AliasRecord", {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.LoadBalancerTarget(this.loadBalancer)
        ),
      });
    } else if (crossAccountRoute53) {
      // Cross-account: use custom resource with role assumption
      new CrossAccountRoute53RecordConstruct(this, "CrossAccountRecord", {
        recordName: domainName,
        hostedZoneId: crossAccountRoute53.hostedZoneId,
        delegationRoleArn: crossAccountRoute53.roleArn,
        target: {
          type: "alb",
          loadBalancer: this.loadBalancer,
        },
      });
    } else {
      // Output ALB DNS for manual DNS setup if no hosted zone
      new cdk.CfnOutput(this, "ALBDnsName", {
        value: this.loadBalancer.loadBalancerDnsName,
        description: `ALB DNS - create CNAME ${domainName} -> this value`,
      });
    }

    // ===================
    // Auto Scaling
    // ===================
    if (config.autoScaling && config.desiredCount > 0) {
      const scaling = this.service.autoScaleTaskCount({
        minCapacity: config.autoScaling.minCount,
        maxCapacity: config.autoScaling.maxCount,
      });

      // CPU-based scaling
      scaling.scaleOnCpuUtilization("CpuScaling", {
        targetUtilizationPercent: config.autoScaling.cpuTargetPercent,
        scaleInCooldown: cdk.Duration.seconds(
          config.autoScaling.scaleInCooldown
        ),
        scaleOutCooldown: cdk.Duration.seconds(
          config.autoScaling.scaleOutCooldown
        ),
      });

      // Memory-based scaling (optional)
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

    // ===================
    // CloudWatch Alarms (Production only)
    // ===================
    if (naming.env === "prd" && config.autoScaling) {
      // High CPU Utilization Alarm
      new cloudwatch.Alarm(this, "HighCpuAlarm", {
        alarmName: n.name(ResourceTypes.CLOUDWATCH_ALARM, "high-cpu", "01"),
        metric: this.service.metricCpuUtilization({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 80,
        evaluationPeriods: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription:
          "Alert when CPU utilization exceeds 80% for 10 minutes",
      });

      // High Memory Utilization Alarm
      new cloudwatch.Alarm(this, "HighMemoryAlarm", {
        alarmName: n.name(ResourceTypes.CLOUDWATCH_ALARM, "high-memory", "01"),
        metric: this.service.metricMemoryUtilization({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 80,
        evaluationPeriods: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription:
          "Alert when memory utilization exceeds 80% for 10 minutes",
      });

      // HTTP 5xx Errors Alarm
      const http5xxMetric = targetGroup.metrics.httpCodeTarget(
        elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
        {
          period: cdk.Duration.minutes(1),
          statistic: "Sum",
        }
      );

      new cloudwatch.Alarm(this, "High5xxErrorsAlarm", {
        alarmName: n.name(ResourceTypes.CLOUDWATCH_ALARM, "high-5xx", "01"),
        metric: http5xxMetric,
        threshold: 10,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: "Alert when 5xx errors exceed 10 per minute",
      });

      // Unhealthy Target Count Alarm
      const unhealthyHostMetric = targetGroup.metrics.unhealthyHostCount({
        period: cdk.Duration.minutes(2),
      });

      new cloudwatch.Alarm(this, "UnhealthyTargetsAlarm", {
        alarmName: n.name(
          ResourceTypes.CLOUDWATCH_ALARM,
          "unhealthy-targets",
          "01"
        ),
        metric: unhealthyHostMetric,
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: "Alert when any target is unhealthy",
      });

      // Failed Task Count Alarm (tasks that stopped unexpectedly)
      // Note: This is approximated using running task count dropping below minimum
      const runningTaskMetric = new cloudwatch.Metric({
        namespace: "AWS/ECS",
        metricName: "CPUUtilization",
        dimensionsMap: {
          ServiceName: this.service.serviceName,
          ClusterName: this.cluster.clusterName,
        },
        period: cdk.Duration.minutes(1),
        statistic: "SampleCount",
      });

      new cloudwatch.Alarm(this, "LowTaskCountAlarm", {
        alarmName: n.name(
          ResourceTypes.CLOUDWATCH_ALARM,
          "low-task-count",
          "01"
        ),
        metric: runningTaskMetric,
        threshold: config.autoScaling.minCount,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        alarmDescription: `Alert when running tasks drop below ${config.autoScaling.minCount}`,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      });
    }

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
    // Only tag certificate if it was created (not imported)
    if (!certificateArn) {
      addStandardTags(
        this.certificate as acm.Certificate,
        naming.env,
        certName
      );
    }
  }

  /**
   * Get the security group of the Fargate service
   */
  public getSecurityGroup(): ec2.ISecurityGroup {
    return this.service.connections.securityGroups[0];
  }
}
