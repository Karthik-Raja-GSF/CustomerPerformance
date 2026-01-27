/**
 * Cognito Configuration
 *
 * AWS Cognito User Pool configuration loaded from environment variables.
 */
export const cognitoConfig = {
  userPoolId:
    (import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined) ?? "",
  clientId:
    (import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined) ?? "",
  region:
    (import.meta.env.VITE_COGNITO_REGION as string | undefined) ?? "us-east-1",
  /** Cognito Hosted UI domain (without https://) for federated sign-in */
  domain: (import.meta.env.VITE_COGNITO_DOMAIN as string | undefined) ?? "",
  /** Azure AD (Entra ID) identity provider name in Cognito */
  azureAdIdpName:
    (import.meta.env.VITE_COGNITO_AZURE_AD_IDP_NAME as string | undefined) ??
    "",
  /** Azure AD (Entra ID) tenant ID for federated logout */
  azureAdTenantId:
    (import.meta.env.VITE_AZURE_AD_TENANT_ID as string | undefined) ??
    "7760617a-f510-47d2-acec-31e328b33785",
};
