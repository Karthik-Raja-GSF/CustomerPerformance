import path from "node:path";
import { defineConfig } from "prisma/config";

// DATABASE_URL is optional for `prisma generate`, required for migrations
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

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
