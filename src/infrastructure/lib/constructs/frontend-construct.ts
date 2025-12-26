import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface FrontendConstructProps {
  envName: string;
  domainName: string;
  hostedZone: route53.IHostedZone;
  naming: NamingConfig;
}

export class FrontendConstruct extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: FrontendConstructProps) {
    super(scope, id);

    const { envName, domainName, hostedZone, naming } = props;

    // Generate resource names (S3, CloudFront are global resources)
    const n = createNamingHelper(naming);
    const bucketName = n.uniqueName(ResourceTypes.S3, "webapp", "01");
    const oacName = n.globalName(ResourceTypes.CLOUDFRONT, "oac", "01");
    const distributionName = n.globalName(
      ResourceTypes.CLOUDFRONT,
      "webapp",
      "01"
    );
    const certName = n.globalName(ResourceTypes.ROUTE53, "cert-webapp", "01");

    const isProd = envName === "prod" || envName === "prd";

    // S3 bucket for static assets
    this.bucket = new s3.Bucket(this, "Bucket", {
      bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // ACM Certificate (must be in us-east-1 for CloudFront)
    this.certificate = new acm.Certificate(this, "Certificate", {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Origin Access Control for S3
    const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
      originAccessControlName: oacName,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `AIT ${envName} Webapp`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      domainNames: [domainName],
      certificate: this.certificate,
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // Route53 A record
    new route53.ARecord(this, "AliasRecord", {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(this.distribution)
      ),
    });

    // Tags
    addStandardTags(this.bucket, naming.env, bucketName);
    addStandardTags(this.distribution, naming.env, distributionName);
    addStandardTags(oac, naming.env, oacName);
    addStandardTags(this.certificate, naming.env, certName);
  }
}
