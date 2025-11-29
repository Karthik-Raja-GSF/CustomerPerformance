/**
 * Cognito Configuration
 *
 * AWS Cognito User Pool configuration loaded from environment variables.
 */
export const cognitoConfig = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  region: import.meta.env.VITE_COGNITO_REGION || 'us-east-1',
};
