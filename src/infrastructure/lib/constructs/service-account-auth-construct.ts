import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface ServiceAccountAuthConstructProps {
  envName: string;
  naming: NamingConfig;
}

/**
 * Dedicated Cognito User Pool for service accounts (M2M).
 *
 * Separate from the main AuthConstruct to allow API key-style usernames
 * (the main pool enforces email-format usernames via signInAliases).
 *
 * Service account tokens are verified alongside main pool tokens by
 * the backend TokenService using aws-jwt-verify multi-pool support.
 */
export class ServiceAccountAuthConstruct extends Construct {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;

  constructor(
    scope: Construct,
    id: string,
    props: ServiceAccountAuthConstructProps
  ) {
    super(scope, id);

    const { envName, naming } = props;
    const n = createNamingHelper(naming);

    const isProd = envName === "prod" || envName === "prd";

    const userPoolName = n.globalName(ResourceTypes.COGNITO, "svc", "01");
    const clientName = n.globalName(ResourceTypes.COGNITO, "svc-client", "01");

    // Minimal User Pool — username-based sign-in (allows API key-style usernames)
    this.userPool = new cognito.UserPool(this, "ServiceAccountPool", {
      userPoolName,
      selfSignUpEnabled: false,
      signInAliases: {
        username: true,
      },
      customAttributes: {
        groups: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // App client with secret (M2M best practice)
    this.userPoolClient = this.userPool.addClient("ServiceAccountClient", {
      userPoolClientName: clientName,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    addStandardTags(this.userPool, naming.env, userPoolName);
    addStandardTags(this.userPoolClient, naming.env, clientName);
  }
}
