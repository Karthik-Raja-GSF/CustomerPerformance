import dotenv from "dotenv";
import { Role } from "@/contracts/rbac/role";
import { Feature } from "@/contracts/rbac/feature";
import type { RoleDefinition } from "@/contracts/rbac/role-config";

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
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : ["http://localhost:3030"],
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
  // Bid Export Processing Configuration
  bidExport: {
    // Cron expression for scheduled export processing (empty string disables scheduling)
    // Push method (API/FTP) is TBD — leave disabled until decided
    processCronExpression: process.env.BID_EXPORT_PROCESS_CRON || "",
  },
  // RBAC Configuration
  // When enabled=false (default), all authorization is bypassed — all users get full access.
  // Set RBAC_ENABLED=true and configure RBAC_GROUP_* env vars to enforce feature-based access.
  rbac: {
    enabled: process.env.RBAC_ENABLED === "true",
    roles: [
      {
        enumKey: Role.SALES,
        displayName: "Sales",
        groupId: process.env.RBAC_GROUP_SALES || "",
        features: [Feature.BACK_TO_SCHOOL],
      },
      {
        enumKey: Role.CATMAN,
        displayName: "Catman",
        groupId: process.env.RBAC_GROUP_CATMAN || "",
        features: [],
      },
      {
        enumKey: Role.DEMAND_PLANNER,
        displayName: "Demand Planning",
        groupId: process.env.RBAC_GROUP_DEMAND_PLANNER || "",
        features: [Feature.MONTHLY_FORECAST, Feature.CONFIRMED_BID_ITEMS],
      },
      {
        enumKey: Role.PURCHASING,
        displayName: "Purchasing",
        groupId: process.env.RBAC_GROUP_PURCHASING || "",
        features: [],
      },
      {
        enumKey: Role.EARLY_ADOPTER,
        displayName: "Early Adopters",
        groupId: process.env.RBAC_GROUP_EARLY_ADOPTER || "",
        features: [
          Feature.STARQ,
          Feature.BACK_TO_SCHOOL,
          Feature.MONTHLY_FORECAST,
          Feature.CONFIRMED_BID_ITEMS,
        ],
      },
      {
        enumKey: Role.ADMIN,
        displayName: "Admins",
        groupId: process.env.RBAC_GROUP_ADMIN || "",
        features: Object.values(Feature),
      },
    ] as RoleDefinition[],
  },
};
