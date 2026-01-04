import { injectable, inject } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import cron, { ScheduledTask } from "node-cron";
import { ISchedulerService } from "@/services/ISchedulerService";
import {
  IStockIqService,
  STOCKIQ_SERVICE_TOKEN,
} from "@/services/IStockIqService";
import { config } from "@/config/index";
import { createChildLogger } from "@/telemetry/logger";

const logger = createChildLogger("scheduler");

/**
 * Fixed lock ID for StockIQ sync (arbitrary unique number)
 * This ensures only one instance can run the sync at a time
 */
const STOCKIQ_SYNC_LOCK_ID = 7892341;

/**
 * Scheduler Service Implementation
 *
 * Manages scheduled tasks with distributed locking using PostgreSQL advisory locks.
 * Ensures only one instance runs scheduled syncs even in a multi-instance deployment.
 */
@injectable()
export class SchedulerService implements ISchedulerService {
  private cronTask: ScheduledTask | null = null;

  constructor(
    @inject("PrismaClient") private readonly prisma: PrismaClient,
    @inject(STOCKIQ_SERVICE_TOKEN)
    private readonly stockIqService: IStockIqService
  ) {}

  /**
   * Start the scheduler
   * Initializes cron jobs based on configuration
   */
  start(): void {
    const cronExpression = config.stockiq.syncCronExpression;

    if (!cronExpression) {
      logger.info(
        { event: "scheduler.disabled" },
        "StockIQ scheduler disabled (no cron expression configured)"
      );
      return;
    }

    if (!cron.validate(cronExpression)) {
      logger.error(
        { event: "scheduler.invalid_cron", cronExpression },
        `Invalid cron expression: ${cronExpression}`
      );
      return;
    }

    this.cronTask = cron.schedule(cronExpression, () => {
      void this.runScheduledSync();
    });

    logger.info(
      { event: "scheduler.started", cronExpression },
      `StockIQ scheduler started with cron: ${cronExpression}`
    );
  }

  /**
   * Stop the scheduler
   * Cleans up cron jobs gracefully
   */
  stop(): void {
    if (this.cronTask) {
      // Fire-and-forget: stop() is non-blocking to avoid delaying shutdown
      void this.cronTask.stop();
      this.cronTask = null;
      logger.info({ event: "scheduler.stopped" }, "StockIQ scheduler stopped");
    }
  }

  /**
   * Run the scheduled sync with distributed locking
   * Only one instance will execute the sync at a time
   */
  private async runScheduledSync(): Promise<void> {
    const lockAcquired = await this.tryAcquireLock();

    if (!lockAcquired) {
      logger.info(
        { event: "scheduler.skipped" },
        "Skipping scheduled sync - another instance is running"
      );
      return;
    }

    try {
      logger.info(
        { event: "scheduler.sync.start" },
        "Starting scheduled StockIQ sync"
      );

      const result = await this.stockIqService.upsertSync("scheduled");

      logger.info(
        {
          event: "scheduler.sync.complete",
          syncId: result.syncId,
          recordsTotal: result.recordsTotal,
          recordsInserted: result.recordsInserted,
          recordsUpdated: result.recordsUpdated,
          durationMs: result.durationMs,
        },
        "Scheduled StockIQ sync completed"
      );
    } catch (error) {
      logger.error(
        {
          event: "scheduler.sync.error",
          error: error instanceof Error ? error.message : String(error),
        },
        "Scheduled StockIQ sync failed"
      );
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Try to acquire the PostgreSQL advisory lock
   * Returns true if lock was acquired, false if already held by another instance
   */
  private async tryAcquireLock(): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<
        [{ pg_try_advisory_lock: boolean }]
      >`SELECT pg_try_advisory_lock(${STOCKIQ_SYNC_LOCK_ID})`;
      return result[0].pg_try_advisory_lock;
    } catch (error) {
      logger.error(
        {
          event: "scheduler.lock.error",
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to acquire advisory lock"
      );
      return false;
    }
  }

  /**
   * Release the PostgreSQL advisory lock
   */
  private async releaseLock(): Promise<void> {
    try {
      await this.prisma
        .$queryRaw`SELECT pg_advisory_unlock(${STOCKIQ_SYNC_LOCK_ID})`;
    } catch (error) {
      logger.error(
        {
          event: "scheduler.unlock.error",
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to release advisory lock"
      );
    }
  }
}
