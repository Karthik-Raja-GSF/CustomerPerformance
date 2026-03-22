// OpenTelemetry instrumentation MUST be imported first, before any other imports
import "./telemetry/instrumentation";

import { createChildLogger } from "./telemetry/logger";

import "reflect-metadata"; // Must be imported for DI to work
import express, { Application, Router } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "./config";
import { container, setupContainer } from "./config/container";
import { errorHandler } from "./middleware/error-handler";
import {
  ISchedulerService,
  SCHEDULER_SERVICE_TOKEN,
} from "./services/ISchedulerService";
import { telemetryMiddleware } from "./middleware/telemetry";
import promptsRouter from "./routes/prompts";
import assistantRouter from "./routes/assistant";
import stockiqRouter from "./routes/stockiq";
import customerBidsRouter from "./routes/customer-bids";
import bidExportsRouter from "./routes/bid-exports";
import authRouter from "./routes/auth";
import eoRiskReviewRouter from "./routes/eo-risk-review";
import issueReportsRouter from "./routes/issue-reports";
import rbacAdminRouter from "./routes/rbac-admin";

const serverLogger = createChildLogger("server");

// Create Prisma client with pg adapter for Prisma v7
const pool = new Pool({ connectionString: config.databaseUrl });
const adapter = new PrismaPg(pool);

class Server {
  private app: Application;
  private prisma: PrismaClient;
  private pool: Pool;
  private scheduler: ISchedulerService | null = null;

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
    // Setup DI container with application dependencies
    setupContainer(this.prisma);

    // Create a shared API router for all routes
    const apiRouter = Router();

    // Health check endpoint
    apiRouter.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Register routes
    apiRouter.use("/auth", authRouter);
    apiRouter.use("/prompts", promptsRouter);
    apiRouter.use("/assistant", assistantRouter);
    apiRouter.use("/stockiq", stockiqRouter);
    apiRouter.use("/customer-bids", customerBidsRouter);
    apiRouter.use("/bid-exports", bidExportsRouter);
    apiRouter.use("/eo-risk-review", eoRiskReviewRouter);
    apiRouter.use("/issue-reports", issueReportsRouter);
    apiRouter.use("/rbac", rbacAdminRouter);

    // Mount at root (existing public ALB, container health check)
    this.app.use("/", apiRouter);
    // Mount at /api (shared ALB path-based routing for private flow)
    this.app.use("/api", apiRouter);
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

      // Start scheduled tasks (after DI container is ready)
      this.scheduler = container.resolve<ISchedulerService>(
        SCHEDULER_SERVICE_TOKEN
      );
      this.scheduler.start();
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
    // Stop scheduled tasks
    if (this.scheduler) {
      this.scheduler.stop();
    }
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
