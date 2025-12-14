import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ===================
    // Existing Resources
    // ===================

    // Import existing VPC
    const vpc = ec2.Vpc.fromLookup(this, "Vpc", {
      vpcId: "vpc-0d88dfb6203eecdbc",
    });

    // Import existing ECR repository
    const ecrRepository = ecr.Repository.fromRepositoryName(
      this,
      "EcrRepo",
      "gsf-backend-apis"
    );

    // Import existing ACM certificate
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "Certificate",
      "arn:aws:acm:us-east-1:201002506909:certificate/3779fdb3-6ec6-4104-b7ba-ff5e12693c49"
    );

    // Import existing Route53 hosted zone
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: "Z069970017BSYGUAVXEZK",
        zoneName: "tratin.com",
      }
    );

    // Import existing secrets
    const secrets = secretsmanager.Secret.fromSecretNameV2(
      this,
      "BackendSecrets",
      "gsf-backend-secrets"
    );

    // Import existing RDS security group
    const rdsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      "RdsSecurityGroup",
      "sg-09d40ae48f444bcfc"
    );

    // ===================
    // ECS Cluster
    // ===================

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: "gsf-backend",
      containerInsights: true,
    });

    // ===================
    // Task Definition
    // ===================

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 512, // 0.5 vCPU
      memoryLimitMiB: 1024, // 1 GB
      family: "gsf-backend",
    });

    // Grant Bedrock permissions to task role
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          // Allow all Bedrock models (use * for region as API returns regionless ARNs)
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*",
        ],
      })
    );

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: "/ecs/gsf-backend",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Container
    const container = taskDefinition.addContainer("backend", {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, "latest"),
      containerName: "gsf-backend",
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "backend",
        logGroup,
      }),
      environment: {
        PORT: "8887",
        NODE_ENV: "production",
        CORS_ORIGIN: "https://dev.tratin.com",
        AWS_REGION: "us-east-1",
        OTEL_SERVICE_NAME: "admin-panel-backend",
        OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
          "https://xray.us-east-1.amazonaws.com/v1/traces",
        OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:
          "https://logs.us-east-1.amazonaws.com/v1/logs",
        OTEL_EXPORTER_OTLP_LOGS_HEADERS:
          "x-aws-log-group=/app/admin-panel,x-aws-log-stream=backend",
        OTEL_METRICS_EXPORTER: "none",
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(secrets, "DATABASE_URL"),
        AWS_COGNITO_USER_POOL_ID: ecs.Secret.fromSecretsManager(
          secrets,
          "AWS_COGNITO_USER_POOL_ID"
        ),
        AWS_COGNITO_CLIENT_ID: ecs.Secret.fromSecretsManager(
          secrets,
          "AWS_COGNITO_CLIENT_ID"
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

    // ===================
    // ALB + Fargate Service
    // ===================

    const fargateService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(this, "Service", {
        cluster,
        taskDefinition,
        serviceName: "gsf-backend",
        desiredCount: 1,
        publicLoadBalancer: true,
        assignPublicIp: true,
        listenerPort: 443,
        certificate,
        domainName: "dev-be.tratin.com",
        domainZone: hostedZone,
        redirectHTTP: true,
        taskSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
        circuitBreaker: {
          rollback: true,
        },
      });

    // Configure health check
    fargateService.targetGroup.configureHealthCheck({
      path: "/health",
      healthyHttpCodes: "200",
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Allow inbound from ALB security group to container port
    fargateService.service.connections.allowFrom(
      fargateService.loadBalancer,
      ec2.Port.tcp(8887),
      "Allow ALB to reach container"
    );

    // Allow Fargate to connect to RDS
    rdsSecurityGroup.addIngressRule(
      fargateService.service.connections.securityGroups[0],
      ec2.Port.tcp(5432),
      "Allow Fargate to connect to RDS"
    );

    // Allow outbound HTTPS for AWS services (Secrets Manager, ECR, etc.)
    fargateService.service.connections.allowToAnyIpv4(
      ec2.Port.tcp(443),
      "Allow outbound HTTPS"
    );

    // ===================
    // Outputs
    // ===================

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: "ALB DNS Name",
    });

    new cdk.CfnOutput(this, "ServiceURL", {
      value: "https://dev-be.tratin.com",
      description: "Backend Service URL",
    });

    new cdk.CfnOutput(this, "ClusterName", {
      value: cluster.clusterName,
      description: "ECS Cluster Name",
    });

    new cdk.CfnOutput(this, "ServiceName", {
      value: fargateService.service.serviceName,
      description: "ECS Service Name",
    });
  }
}
