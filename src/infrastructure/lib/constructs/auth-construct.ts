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
  /** Azure AD federation metadata URL for SAML IdP */
  azureAdMetadataUrl?: string;
  /** Set to true only for new User Pools. Existing pools have custom attributes added via CLI. */
  createCustomAttributes?: boolean;
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly azureAdProvider?: cognito.UserPoolIdentityProviderSaml;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    const { envName, frontendUrl, naming } = props;

    // Generate resource names (Cognito is global resource)
    const n = createNamingHelper(naming);
    const userPoolName = n.globalName(ResourceTypes.COGNITO, "main", "01");
    const clientName = n.globalName(ResourceTypes.COGNITO, "client", "01");
    const domainName = n.globalName(ResourceTypes.COGNITO, "domain", "01");
    const idpAdName = n.globalName(ResourceTypes.COGNITO, "idp-ad", "01");

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
      // Custom attributes are only declared for new User Pools.
      // Existing pools (dev/prod) have these added via CLI — re-declaring them
      // causes "attribute already exists with different properties" errors.
      ...(props.createCustomAttributes
        ? {
            customAttributes: {
              mail: new cognito.StringAttribute({ mutable: true }),
              idp: new cognito.StringAttribute({ mutable: true }),
              token_exp: new cognito.StringAttribute({ mutable: true }),
              object_id: new cognito.StringAttribute({ mutable: true }),
              groups: new cognito.StringAttribute({ mutable: true }),
              wids: new cognito.StringAttribute({ mutable: true }),
              auth_method: new cognito.StringAttribute({ mutable: true }),
              name_id: new cognito.StringAttribute({ mutable: true }),
              auth_instant: new cognito.StringAttribute({ mutable: true }),
              idp_email: new cognito.StringAttribute({ mutable: true }),
              openid2_id: new cognito.StringAttribute({ mutable: true }),
              groups_link: new cognito.StringAttribute({ mutable: true }),
              role: new cognito.StringAttribute({ mutable: true }),
            },
          }
        : {}),
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

    // Cognito Domain (Hosted UI) - required for federated sign-in
    const domainPrefix = isProd ? "ait" : `ait-${envName}`;
    this.userPoolDomain = this.userPool.addDomain("Domain", {
      cognitoDomain: {
        domainPrefix: domainPrefix,
      },
    });

    // Entra ID (Azure AD) SAML Identity Provider (if configured)
    // Provider name follows naming convention: ait-{env}-gbl-cog-idp-ad-01
    if (props.azureAdMetadataUrl) {
      this.azureAdProvider = new cognito.UserPoolIdentityProviderSaml(
        this,
        "AzureADProvider",
        {
          userPool: this.userPool,
          name: idpAdName,
          metadata: cognito.UserPoolIdentityProviderSamlMetadata.url(
            props.azureAdMetadataUrl
          ),
          // Identifiers for email domain hints (enables SSO discovery)
          identifiers: [
            "goldstarfoods.com",
            "gravesfoods.com",
            "gsfoodsgroup.com",
          ],
          attributeMapping: {
            // Standard attribute mappings
            // Note: name claim (UPN) used for email because emailaddress claim
            // is empty for users without Azure AD mail attribute
            email: cognito.ProviderAttribute.other(
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
            ),
            fullname: cognito.ProviderAttribute.other(
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
            ),
            givenName: cognito.ProviderAttribute.other(
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
            ),
            familyName: cognito.ProviderAttribute.other(
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
            ),
            preferredUsername: cognito.ProviderAttribute.other(
              "http://schemas.microsoft.com/identity/claims/displayname"
            ),
            nickname: cognito.ProviderAttribute.other(
              "http://schemas.microsoft.com/identity/claims/nickname"
            ),

            // Custom attribute mappings
            // Note: custom attributes must be added to User Pool schema via CLI first
            // (aws cognito-idp add-custom-attributes) since CDK cannot add them to existing pools
            // Keys must include "custom:" prefix — CDK does not add it automatically
            custom: {
              "custom:idp_email": cognito.ProviderAttribute.other(
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
              ),
              "custom:mail": cognito.ProviderAttribute.other(
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
              ),
              "custom:name_id": cognito.ProviderAttribute.other(
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
              ),
              "custom:auth_instant": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationinstant"
              ),
              "custom:auth_method": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationmethod"
              ),
              "custom:object_id": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/identity/claims/objectidentifier"
              ),
              "custom:idp": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/identity/claims/identityprovider"
              ),
              "custom:groups": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
              ),
              "custom:token_exp": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/expiration"
              ),
              "custom:openid2_id": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/identity/claims/openid2_id"
              ),
              "custom:groups_link": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/claims/groups.link"
              ),
              "custom:role": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
              ),
              "custom:wids": cognito.ProviderAttribute.other(
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/wids"
              ),
            },
          },
        }
      );
    }

    // Build list of supported identity providers
    const supportedIdentityProviders: cognito.UserPoolClientIdentityProvider[] =
      [cognito.UserPoolClientIdentityProvider.COGNITO];

    if (this.azureAdProvider) {
      supportedIdentityProviders.push(
        cognito.UserPoolClientIdentityProvider.custom(idpAdName)
      );
    }

    // App Client (public, no secret)
    this.userPoolClient = this.userPool.addClient("AppClient", {
      userPoolClientName: clientName,
      generateSecret: false, // SPA client, no secret
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      supportedIdentityProviders,
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
        callbackUrls: [
          frontendUrl,
          `${frontendUrl}/auth/callback`,
          // Only include localhost for non-production
          ...(isProd
            ? []
            : ["http://localhost:3030", "http://localhost:3030/auth/callback"]),
        ],
        logoutUrls: [
          frontendUrl,
          `${frontendUrl}/login`,
          `${frontendUrl}/login?sso_logout=1`,
          // Only include localhost for non-production
          ...(isProd
            ? []
            : [
                "http://localhost:3030",
                "http://localhost:3030/login",
                "http://localhost:3030/login?sso_logout=1",
              ]),
        ],
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Ensure IdP is created before the client references it
    if (this.azureAdProvider) {
      this.userPoolClient.node.addDependency(this.azureAdProvider);
    }

    // Tags
    addStandardTags(this.userPool, naming.env, userPoolName);
    addStandardTags(this.userPoolClient, naming.env, clientName);
    addStandardTags(this.userPoolDomain, naming.env, domainName);
    if (this.azureAdProvider) {
      addStandardTags(this.azureAdProvider, naming.env, idpAdName);
    }
  }
}
