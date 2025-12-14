import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 8887,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3030",
  cognito: {
    userPoolId: process.env.AWS_COGNITO_USER_POOL_ID || "",
    clientId: process.env.AWS_COGNITO_CLIENT_ID || "",
    region: process.env.AWS_REGION || "us-east-1",
  },
  bedrock: {
    region: process.env.AWS_BEDROCK_REGION || "us-east-1",
  },
  mcp: {
    postgresConnectionString: process.env.DATABASE_URL || "",
  },
  // Telemetry is configured via OTEL_* env vars (ADOT SDK reads them directly)
  // These are only used by our logger wrapper for metadata
  telemetry: {
    serviceName: process.env.OTEL_SERVICE_NAME || "admin-panel-backend",
    serviceVersion: process.env.OTEL_SERVICE_VERSION || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  },
};
