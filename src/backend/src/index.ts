import "reflect-metadata"; // Must be first import for DI to work
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import { config } from "./config";
import { setupContainer } from "./config/container";
import { errorHandler } from "./middleware/error-handler";
import promptsRouter from "./routes/prompts";
import siqImportRouter from "./routes/siq-import";
import assistantRouter from "./routes/assistant";

class Server {
  private app: Application;
  private prisma: PrismaClient;

  constructor() {
    this.app = express();
    this.prisma = new PrismaClient();
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

    // Logging middleware
    if (config.nodeEnv === "development") {
      this.app.use(morgan("dev"));
    }
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
    this.app.use("/siq-import", siqImportRouter);
    this.app.use("/assistant", assistantRouter);
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.prisma.$connect();
      console.log("Database connected successfully");

      // Start server
      this.app.listen(config.port, () => {
        console.log(`Server is running on port ${String(config.port)}`);
        console.log(`Environment: ${String(config.nodeEnv)}`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      await this.prisma.$disconnect();
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    await this.prisma.$disconnect();
    console.log("Server stopped");
  }
}

// Start the server
const server = new Server();
void server.start();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully...");
  void server.stop().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  void server.stop().then(() => process.exit(0));
});
