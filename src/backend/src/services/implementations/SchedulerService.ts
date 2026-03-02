import { injectable, inject } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import cron, { ScheduledTask } from "node-cron";
import { ISchedulerService } from "@/services/ISchedulerService";
import {
  IStockIqService,
  STOCKIQ_SERVICE_TOKEN,
} from "@/services/IStockIqService";
import {
  ICustomerBidService,
  CUSTOMER_BID_SERVICE_TOKEN,
} from "@/services/ICustomerBidService";
import {
  IBidExportService,
  BID_EXPORT_SERVICE_TOKEN,
} from "@/services/IBidExportService";
import { config } from "@/config/index";
import { createChildLogger } from "@/telemetry/logger";
import { getSchoolYearString } from "@/services/helpers/school-year";

const logger = createChildLogger("scheduler");

/**
 * Fixed lock ID for StockIQ sync (arbitrary unique number)
 * This ensures only one instance can run the sync at a time
 */
const STOCKIQ_SYNC_LOCK_ID = 7892341;

/**
 * Fixed lock ID for Customer Bid sync
 */
const CUSTOMER_BID_SYNC_LOCK_ID = 7892342;

/**
 * Fixed lock ID for Bid Export processing
 */
const BID_EXPORT_PROCESS_LOCK_ID = 7892343;

/**
 * Scheduler Service Implementation
 *
 * Manages scheduled tasks with distributed locking using PostgreSQL advisory locks.
 * Ensures only one instance runs scheduled syncs even in a multi-instance deployment.
 */
@injectable()
export class SchedulerService implements ISchedulerService {
  private stockIqCronTask: ScheduledTask | null = null;
  private customerBidCronTask: ScheduledTask | null = null;
  private bidExportCronTask: ScheduledTask | null = null;

  constructor(
    @inject("PrismaClient") private readonly prisma: PrismaClient,
    @inject(STOCKIQ_SERVICE_TOKEN)
    private readonly stockIqService: IStockIqService,
    @inject(CUSTOMER_BID_SERVICE_TOKEN)
    private readonly customerBidService: ICustomerBidService,
    @inject(BID_EXPORT_SERVICE_TOKEN)
    private readonly bidExportService: IBidExportService
  ) {}

  /**
   * Start the scheduler
   * Initializes cron jobs based on configuration
   */
  start(): void {
    this.startStockIqScheduler();
    this.startCustomerBidScheduler();
    this.startBidExportScheduler();
  }

  /**
   * Start the StockIQ sync scheduler
   */
  private startStockIqScheduler(): void {
    const cronExpression = config.stockiq.syncCronExpression;

    if (!cronExpression) {
      logger.info(
        { event: "scheduler.stockiq.disabled" },
        "StockIQ scheduler disabled (no cron expression configured)"
      );
      return;
    }

    if (!cron.validate(cronExpression)) {
      logger.error(
        { event: "scheduler.stockiq.invalid_cron", cronExpression },
        `Invalid StockIQ cron expression: ${cronExpression}`
      );
      return;
    }

    this.stockIqCronTask = cron.schedule(cronExpression, () => {
      void this.runStockIqSync();
    });

    logger.info(
      { event: "scheduler.stockiq.started", cronExpression },
      `StockIQ scheduler started with cron: ${cronExpression}`
    );
  }

  /**
   * Start the Customer Bid sync scheduler
   */
  private startCustomerBidScheduler(): void {
    const cronExpression = config.customerBid.syncCronExpression;

    if (!cronExpression) {
      logger.info(
        { event: "scheduler.customerbid.disabled" },
        "Customer Bid scheduler disabled (no cron expression configured)"
      );
      return;
    }

    if (!cron.validate(cronExpression)) {
      logger.error(
        { event: "scheduler.customerbid.invalid_cron", cronExpression },
        `Invalid Customer Bid cron expression: ${cronExpression}`
      );
      return;
    }

    this.customerBidCronTask = cron.schedule(cronExpression, () => {
      void this.runCustomerBidSync();
    });

    logger.info(
      { event: "scheduler.customerbid.started", cronExpression },
      `Customer Bid scheduler started with cron: ${cronExpression}`
    );
  }

  /**
   * Stop the scheduler
   * Cleans up cron jobs gracefully
   */
  stop(): void {
    if (this.stockIqCronTask) {
      void this.stockIqCronTask.stop();
      this.stockIqCronTask = null;
      logger.info(
        { event: "scheduler.stockiq.stopped" },
        "StockIQ scheduler stopped"
      );
    }
    if (this.customerBidCronTask) {
      void this.customerBidCronTask.stop();
      this.customerBidCronTask = null;
      logger.info(
        { event: "scheduler.customerbid.stopped" },
        "Customer Bid scheduler stopped"
      );
    }
    if (this.bidExportCronTask) {
      void this.bidExportCronTask.stop();
      this.bidExportCronTask = null;
      logger.info(
        { event: "scheduler.bidexport.stopped" },
        "Bid Export scheduler stopped"
      );
    }
  }

  /**
   * Run the scheduled StockIQ sync with distributed locking
   */
  private async runStockIqSync(): Promise<void> {
    const lockAcquired = await this.tryAcquireLock(STOCKIQ_SYNC_LOCK_ID);

    if (!lockAcquired) {
      logger.info(
        { event: "scheduler.stockiq.skipped" },
        "Skipping StockIQ sync - another instance is running"
      );
      return;
    }

    try {
      logger.info(
        { event: "scheduler.stockiq.start" },
        "Starting scheduled StockIQ sync"
      );

      const result = await this.stockIqService.upsertSync("scheduled");

      logger.info(
        {
          event: "scheduler.stockiq.complete",
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
          event: "scheduler.stockiq.error",
          error: error instanceof Error ? error.message : String(error),
        },
        "Scheduled StockIQ sync failed"
      );
    } finally {
      await this.releaseLock(STOCKIQ_SYNC_LOCK_ID);
    }
  }

  /**
   * Check if a school year has already been successfully synced.
   * Used to avoid re-syncing "previous" and "current" school years daily.
   */
  private async hasCompletedSync(schoolYearString: string): Promise<boolean> {
    const completed = await this.prisma.customerBidSyncLog.findFirst({
      where: {
        schoolYear: schoolYearString,
        status: "COMPLETED",
      },
      select: { id: true },
    });
    return completed !== null;
  }

  /**
   * Run the scheduled Customer Bid sync with distributed locking.
   *
   * - "previous" and "current" school years: synced once per school year
   *   (self-healing — retries daily until a COMPLETED sync exists)
   * - "next" school year: synced every run (daily)
   */
  private async runCustomerBidSync(): Promise<void> {
    const lockAcquired = await this.tryAcquireLock(CUSTOMER_BID_SYNC_LOCK_ID);

    if (!lockAcquired) {
      logger.info(
        { event: "scheduler.customerbid.skipped" },
        "Skipping Customer Bid sync - another instance is running"
      );
      return;
    }

    try {
      logger.info(
        { event: "scheduler.customerbid.start" },
        "Starting scheduled Customer Bid sync"
      );

      // Sync "previous" if never successfully synced (once per school year)
      const prevSchoolYear = getSchoolYearString("previous");
      if (!(await this.hasCompletedSync(prevSchoolYear))) {
        logger.info(
          {
            event: "scheduler.customerbid.previous.needed",
            schoolYear: prevSchoolYear,
          },
          "Previous school year has no completed sync — syncing now"
        );
        const prevResult = await this.customerBidService.sync(
          "previous",
          "scheduled"
        );
        logger.info(
          {
            event: "scheduler.customerbid.previous.complete",
            syncId: prevResult.syncId,
            schoolYear: prevResult.schoolYear,
            recordsTotal: prevResult.recordsTotal,
            durationMs: prevResult.durationMs,
          },
          "Scheduled Customer Bid sync (previous) completed"
        );
      } else {
        logger.info(
          {
            event: "scheduler.customerbid.previous.skipped",
            schoolYear: prevSchoolYear,
          },
          "Previous school year already synced — skipping"
        );
      }

      // Sync "current" if never successfully synced (once per school year)
      const currSchoolYear = getSchoolYearString("current");
      if (!(await this.hasCompletedSync(currSchoolYear))) {
        logger.info(
          {
            event: "scheduler.customerbid.current.needed",
            schoolYear: currSchoolYear,
          },
          "Current school year has no completed sync — syncing now"
        );
        const currentResult = await this.customerBidService.sync(
          "current",
          "scheduled"
        );
        logger.info(
          {
            event: "scheduler.customerbid.current.complete",
            syncId: currentResult.syncId,
            schoolYear: currentResult.schoolYear,
            recordsTotal: currentResult.recordsTotal,
            durationMs: currentResult.durationMs,
          },
          "Scheduled Customer Bid sync (current) completed"
        );
      } else {
        logger.info(
          {
            event: "scheduler.customerbid.current.skipped",
            schoolYear: currSchoolYear,
          },
          "Current school year already synced — skipping"
        );
      }

      // Always sync "next" school year (daily)
      const nextResult = await this.customerBidService.sync(
        "next",
        "scheduled"
      );
      logger.info(
        {
          event: "scheduler.customerbid.next.complete",
          syncId: nextResult.syncId,
          schoolYear: nextResult.schoolYear,
          recordsTotal: nextResult.recordsTotal,
          durationMs: nextResult.durationMs,
        },
        "Scheduled Customer Bid sync (next) completed"
      );

      logger.info(
        { event: "scheduler.customerbid.complete" },
        "Scheduled Customer Bid sync completed"
      );
    } catch (error) {
      logger.error(
        {
          event: "scheduler.customerbid.error",
          error: error instanceof Error ? error.message : String(error),
        },
        "Scheduled Customer Bid sync failed"
      );
    } finally {
      await this.releaseLock(CUSTOMER_BID_SYNC_LOCK_ID);
    }
  }

  /**
   * Start the Bid Export processing scheduler
   */
  private startBidExportScheduler(): void {
    const cronExpression = config.bidExport.processCronExpression;

    if (!cronExpression) {
      logger.info(
        { event: "scheduler.bidexport.disabled" },
        "Bid Export scheduler disabled (no cron expression configured)"
      );
      return;
    }

    if (!cron.validate(cronExpression)) {
      logger.error(
        { event: "scheduler.bidexport.invalid_cron", cronExpression },
        `Invalid Bid Export cron expression: ${cronExpression}`
      );
      return;
    }

    this.bidExportCronTask = cron.schedule(cronExpression, () => {
      void this.runBidExportProcess();
    });

    logger.info(
      { event: "scheduler.bidexport.started", cronExpression },
      `Bid Export scheduler started with cron: ${cronExpression}`
    );
  }

  /**
   * Run the scheduled Bid Export processing with distributed locking
   */
  private async runBidExportProcess(): Promise<void> {
    const lockAcquired = await this.tryAcquireLock(BID_EXPORT_PROCESS_LOCK_ID);

    if (!lockAcquired) {
      logger.info(
        { event: "scheduler.bidexport.skipped" },
        "Skipping Bid Export processing - another instance is running"
      );
      return;
    }

    try {
      logger.info(
        { event: "scheduler.bidexport.start" },
        "Starting scheduled Bid Export processing"
      );

      const result = await this.bidExportService.processPendingExports();

      logger.info(
        {
          event: "scheduler.bidexport.complete",
          runsCreated: result.runsCreated,
          totalProcessed: result.totalProcessed,
          failed: result.failed,
        },
        "Scheduled Bid Export processing completed"
      );
    } catch (error) {
      logger.error(
        {
          event: "scheduler.bidexport.error",
          error: error instanceof Error ? error.message : String(error),
        },
        "Scheduled Bid Export processing failed"
      );
    } finally {
      await this.releaseLock(BID_EXPORT_PROCESS_LOCK_ID);
    }
  }

  /**
   * Try to acquire the PostgreSQL advisory lock
   * Returns true if lock was acquired, false if already held by another instance
   */
  private async tryAcquireLock(lockId: number): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<
        [{ pg_try_advisory_lock: boolean }]
      >`SELECT pg_try_advisory_lock(${lockId})`;
      return result[0].pg_try_advisory_lock;
    } catch (error) {
      logger.error(
        {
          event: "scheduler.lock.error",
          lockId,
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
  private async releaseLock(lockId: number): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${lockId})`;
    } catch (error) {
      logger.error(
        {
          event: "scheduler.unlock.error",
          lockId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to release advisory lock"
      );
    }
  }
}
