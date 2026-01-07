import { injectable, inject } from "tsyringe";
import { PrismaClient, Prisma } from "@prisma/client";
import { IMcpClientService } from "@/services/IMcpClientService";
import { McpConnectionError } from "@/utils/errors/assistant-errors";

@injectable()
export class McpClientService implements IMcpClientService {
  private initialized = false;
  private prisma: PrismaClient;

  constructor(@inject("PrismaClient") prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    // Prisma is already connected via the injected client
    this.initialized = true;
  }

  // Convert BigInt values to numbers for JSON serialization
  private serializeBigInt(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === "bigint") {
      return Number(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.serializeBigInt(item));
    }
    if (typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.serializeBigInt(value);
      }
      return result;
    }
    return obj;
  }

  async executeQuery(sql: string): Promise<unknown> {
    try {
      const result = await this.prisma.$queryRawUnsafe(sql);
      // Convert BigInt to Number for JSON serialization
      return this.serializeBigInt(result);
    } catch (error) {
      throw new McpConnectionError(
        `Failed to execute query: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async getSchemaInfo(): Promise<string> {
    try {
      // Get table information from PostgreSQL (ait and dw2_nav schemas)
      const tables = await this.prisma.$queryRaw<
        Array<{ table_schema: string; table_name: string }>
      >`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema IN ('ait', 'dw2_nav', 'siq')
        AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `;

      const schemaInfo: Record<string, unknown[]> = {};

      for (const table of tables) {
        const columns = await this.prisma.$queryRaw<
          Array<{
            column_name: string;
            data_type: string;
            is_nullable: string;
          }>
        >(Prisma.sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = ${table.table_schema}
          AND table_name = ${table.table_name}
          ORDER BY ordinal_position
        `);

        // Use schema.table_name as the key (e.g., "ait.prompts", "dw2_nav.customer")
        const fullTableName = `${table.table_schema}.${table.table_name}`;
        schemaInfo[fullTableName] = columns.map((col) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === "YES",
        }));
      }

      return JSON.stringify(schemaInfo, null, 2);
    } catch (error) {
      throw new McpConnectionError(
        `Failed to get schema info: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async disconnect(): Promise<void> {
    // Prisma disconnect is handled elsewhere
    this.initialized = false;
  }
}
