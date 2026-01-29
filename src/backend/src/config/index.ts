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
    serviceName: process.env.OTEL_SERVICE_NAME || "ait-backend",
    serviceVersion: process.env.OTEL_SERVICE_VERSION || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  },
  // StockIQ API Configuration
  // Credentials are injected from AWS Secrets Manager at runtime
  stockiq: {
    baseUrl:
      process.env.STOCKIQ_BASE_URL || "https://goldstarfoods.stockiqtech.net",
    customReportId: process.env.STOCKIQ_CUSTOM_REPORT_ID || "1",
    username: process.env.STOCKIQ_USERNAME || "",
    password: process.env.STOCKIQ_PASSWORD || "",
    timeoutMs: parseInt(process.env.STOCKIQ_TIMEOUT_MS || "60000", 10),
    // Cron expression for scheduled sync (empty string disables scheduling)
    // Examples: "0 6 * * *" (6 AM daily), "0 */4 * * *" (every 4 hours)
    syncCronExpression: process.env.STOCKIQ_SYNC_CRON || "",
  },
  // Customer Bid Sync Configuration
  customerBid: {
    // Cron expression for scheduled sync (empty string disables scheduling)
    // Production: "0 13 * * *" (5 AM PST / 1 PM UTC) - syncs Current + Next school years
    syncCronExpression: process.env.CUSTOMER_BID_SYNC_CRON || "",
  },
};
