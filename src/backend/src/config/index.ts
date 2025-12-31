import dotenv from "dotenv";

dotenv.config();

// Build DATABASE_URL from components if not provided directly
// This is needed for Aurora Serverless which provides credentials as separate values
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "5432";
  const dbname = process.env.DB_NAME || "ait_procurement";

  if (username && password && host) {
    return `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbname}`;
  }

  return "";
}

const databaseUrl = getDatabaseUrl();

export const config = {
  port: process.env.PORT || 8887,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl,
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
    postgresConnectionString: databaseUrl,
  },
  // Telemetry is configured via OTEL_* env vars (ADOT SDK reads them directly)
  // These are only used by our logger wrapper for metadata
  telemetry: {
    serviceName: process.env.OTEL_SERVICE_NAME || "admin-panel-backend",
    serviceVersion: process.env.OTEL_SERVICE_VERSION || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  },
};
