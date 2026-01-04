/**
 * Scheduler Service Interface
 *
 * Defines the contract for in-application scheduled tasks.
 * Uses PostgreSQL advisory locks for distributed coordination.
 */
export const SCHEDULER_SERVICE_TOKEN = Symbol.for("ISchedulerService");

export interface ISchedulerService {
  /**
   * Start the scheduler
   * Initializes cron jobs based on configuration
   */
  start(): void;

  /**
   * Stop the scheduler
   * Cleans up cron jobs gracefully
   */
  stop(): void;
}
