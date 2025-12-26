import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface AuthConstructProps {
  envName: string;
  frontendUrl: string;
  naming: NamingConfig;
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    const { envName, frontendUrl, naming } = props;

    // Generate resource names (Cognito is global resource)
    const n = createNamingHelper(naming);
    const userPoolName = n.globalName(ResourceTypes.COGNITO, "main", "01");
    const clientName = n.globalName(ResourceTypes.COGNITO, "client", "01");

    const isProd = envName === "prod" || envName === "prd";

    // User Pool (V2 - email-only sign-in)
    this.userPool = new cognito.UserPool(this, "UserPoolV2", {
      userPoolName,
      selfSignUpEnabled: false, // Admin-only user creation
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // App Client (public, no secret)
    this.userPoolClient = this.userPool.addClient("AppClient", {
      userPoolClientName: clientName,
      generateSecret: false, // SPA client, no secret
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [frontendUrl, "http://localhost:3030"],
        logoutUrls: [frontendUrl, "http://localhost:3030"],
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Tags
    addStandardTags(this.userPool, naming.env, userPoolName);
    addStandardTags(this.userPoolClient, naming.env, clientName);
  }
}
