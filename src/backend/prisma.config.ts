import path from "node:path";
import { defineConfig } from "prisma/config";

// Build DATABASE_URL from components if not provided directly
// This matches the logic in src/config/index.ts for Aurora Serverless compatibility
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "5432";
  const dbname = process.env.DB_NAME || "admin_panel";

  if (username && password && host) {
    return `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbname}`;
  }

  // Fallback for local development / prisma generate
  return "postgresql://placeholder:placeholder@localhost:5432/placeholder";
}

const databaseUrl = getDatabaseUrl();

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),

  // Required for prisma migrate deploy
  datasource: {
    url: databaseUrl,
  },

  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: databaseUrl });
      return new PrismaPg(pool);
    },
  },
});
