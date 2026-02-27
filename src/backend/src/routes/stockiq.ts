import { Router, Request, Response, NextFunction, IRouter } from "express";
import { z } from "zod";
import { container } from "tsyringe";
import {
  IStockIqService,
  STOCKIQ_SERVICE_TOKEN,
} from "@/services/IStockIqService";
import { authenticate } from "@/middleware/authenticate";
import { requireFeature } from "@/middleware/authorize";
import { Feature } from "@/contracts/rbac/feature";
import {
  StockIqApiError,
  StockIqAuthError,
  StockIqConfigError,
  StockIqSyncInProgressError,
} from "@/utils/errors/stockiq-errors";

const router: IRouter = Router();

// Validation schemas
const syncHistoryQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * Helper to handle StockIQ-specific errors
 */
function handleStockIqError(
  error: unknown,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof StockIqApiError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
      apiStatusCode: error.apiStatusCode,
      apiErrorMessage: error.apiErrorMessage,
    });
    return;
  }

  if (error instanceof StockIqAuthError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (error instanceof StockIqConfigError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (error instanceof StockIqSyncInProgressError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  next(error);
}

/**
 * POST /stockiq/sync
 * Trigger a manual upsert sync from StockIQ API
 */
router.post(
  "/sync",
  authenticate,
  requireFeature(Feature.STOCKIQ_SYNC),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stockIqService = container.resolve<IStockIqService>(
        STOCKIQ_SERVICE_TOKEN
      );
      const result = await stockIqService.upsertSync("manual");

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleStockIqError(error, res, next);
    }
  }
);

/**
 * GET /stockiq/sync/status
 * Get the latest sync status
 */
router.get(
  "/sync/status",
  authenticate,
  requireFeature(Feature.STOCKIQ_SYNC),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stockIqService = container.resolve<IStockIqService>(
        STOCKIQ_SERVICE_TOKEN
      );
      const status = await stockIqService.getLatestSyncStatus();

      res.json({
        status: "success",
        data: status,
      });
    } catch (error) {
      handleStockIqError(error, res, next);
    }
  }
);

/**
 * GET /stockiq/sync/history
 * Get sync history
 */
router.get(
  "/sync/history",
  authenticate,
  requireFeature(Feature.STOCKIQ_SYNC),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = syncHistoryQuerySchema.safeParse(req.query);
      const limit = parsed.success ? parsed.data.limit : 20;

      const stockIqService = container.resolve<IStockIqService>(
        STOCKIQ_SERVICE_TOKEN
      );
      const history = await stockIqService.getSyncHistory(limit);

      res.json({
        status: "success",
        data: history,
      });
    } catch (error) {
      handleStockIqError(error, res, next);
    }
  }
);

/**
 * GET /stockiq/orphans
 * List orphaned records (in DB but not in API)
 */
router.get(
  "/orphans",
  authenticate,
  requireFeature(Feature.STOCKIQ_SYNC),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stockIqService = container.resolve<IStockIqService>(
        STOCKIQ_SERVICE_TOKEN
      );
      const orphans = await stockIqService.getOrphanedRecords();

      res.json({
        status: "success",
        data: orphans,
        count: orphans.length,
      });
    } catch (error) {
      handleStockIqError(error, res, next);
    }
  }
);

/**
 * DELETE /stockiq/orphans
 * Delete orphaned records (manual cleanup)
 */
router.delete(
  "/orphans",
  authenticate,
  requireFeature(Feature.STOCKIQ_SYNC),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stockIqService = container.resolve<IStockIqService>(
        STOCKIQ_SERVICE_TOKEN
      );
      const result = await stockIqService.deleteOrphanedRecords();

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleStockIqError(error, res, next);
    }
  }
);

export default router;
