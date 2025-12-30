// ADOT auto-instrumentation is loaded via --require flag in package.json scripts
import { createChildLogger } from "./telemetry/logger";

import "reflect-metadata"; // Must be imported for DI to work
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "./config";
import { setupContainer } from "./config/container";
import { errorHandler } from "./middleware/error-handler";
import { telemetryMiddleware } from "./middleware/telemetry";
import promptsRouter from "./routes/prompts";
// TODO: SIQ Import temporarily disabled - will be reformed with new architecture
// import siqImportRouter from "./routes/siq-import";
import assistantRouter from "./routes/assistant";

const serverLogger = createChildLogger("server");

// Create Prisma client with pg adapter for Prisma v7
const pool = new Pool({ connectionString: config.databaseUrl });
const adapter = new PrismaPg(pool);

class Server {
  private app: Application;
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    this.app = express();
    this.pool = pool;
    this.prisma = new PrismaClient({ adapter });
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS configuration
    this.app.use(
      cors({
        origin: config.corsOrigin,
        credentials: true,
      })
    );

    // Compression middleware (disabled for SSE endpoints)
    this.app.use(
      compression({
        filter: (req, res) => {
          // Disable compression for SSE endpoints
          if (req.headers.accept === "text/event-stream") {
            return false;
          }
          if (req.path.includes("/chat/stream")) {
            return false;
          }
          // Default filter
          return compression.filter(req, res);
        },
      })
    );

    // Body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Telemetry middleware (replaces morgan)
    this.app.use(telemetryMiddleware);
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Setup DI container with application dependencies
    setupContainer(this.prisma);

    // Register routes
    this.app.use("/prompts", promptsRouter);
    // TODO: SIQ Import temporarily disabled - will be reformed with new architecture
    // this.app.use("/siq-import", siqImportRouter);
    this.app.use("/assistant", assistantRouter);
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.prisma.$connect();
      serverLogger.info(
        { event: "database.connected" },
        "Database connected successfully"
      );

      // Start server
      this.app.listen(config.port, () => {
        serverLogger.info(
          {
            event: "server.started",
            port: config.port,
            environment: config.nodeEnv,
          },
          `Server is running on port ${String(config.port)}`
        );
      });
    } catch (error) {
      serverLogger.error(
        { event: "server.start.failed", error },
        "Failed to start server"
      );
      await this.prisma.$disconnect();
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    serverLogger.info({ event: "server.stopped" }, "Server stopped");
  }
}

// Start the server
const server = new Server();
void server.start();

// Graceful shutdown
process.on("SIGINT", () => {
  serverLogger.info(
    { event: "shutdown.signal", signal: "SIGINT" },
    "Received SIGINT, shutting down gracefully..."
  );
  void server.stop().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  serverLogger.info(
    { event: "shutdown.signal", signal: "SIGTERM" },
    "Received SIGTERM, shutting down gracefully..."
  );
  void server.stop().then(() => process.exit(0));
});
