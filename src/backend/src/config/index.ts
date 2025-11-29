import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 8887,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3030',
  cognito: {
    userPoolId: process.env.AWS_COGNITO_USER_POOL_ID || '',
    clientId: process.env.AWS_COGNITO_CLIENT_ID || '',
    region: process.env.AWS_REGION || 'us-east-1',
  },
  bedrock: {
    region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
  },
  mcp: {
    postgresConnectionString: process.env.DATABASE_URL || '',
  },
};
