import { Router, Request, Response, NextFunction, IRouter } from "express";
import { z } from "zod";
import { container } from "tsyringe";
import {
  IBidExportService,
  BID_EXPORT_SERVICE_TOKEN,
} from "@/services/IBidExportService";
import { authenticate } from "@/middleware/authenticate";
import { requireFeature } from "@/middleware/authorize";
import { Feature } from "@/contracts/rbac/feature";

const router: IRouter = Router();

// === Zod Schemas ===

const queueExportSchema = z.object({
  exportType: z.enum(["WH", "NAV"]),
  schoolYear: z.string().min(1),
  filters: z.record(z.unknown()).default({}),
});

const markExportedSchema = z.object({
  exportType: z.enum(["WH", "NAV"]),
});

const exportTypeQuerySchema = z.object({
  exportType: z.enum(["WH", "NAV"]),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const queueByKeysSchema = z.object({
  exportType: z.enum(["WH", "NAV"]),
  keys: z
    .array(
      z.object({
        sourceDb: z.string().min(1),
        siteCode: z.string().min(1),
        customerBillTo: z.string().min(1),
        itemNo: z.string().min(1),
        schoolYear: z.string().min(1),
      })
    )
    .min(1)
    .max(5000),
});

const exportSchema = z.object({
  exportType: z.enum(["WH", "NAV"]),
});

const cancelSchema = z.object({
  exportType: z.enum(["WH", "NAV"]).optional(),
});

const cancelByKeysSchema = z.object({
  exportType: z.enum(["WH", "NAV"]).optional(),
  keys: z
    .array(
      z.object({
        sourceDb: z.string().min(1),
        siteCode: z.string().min(1),
        customerBillTo: z.string().min(1),
        itemNo: z.string().min(1),
        schoolYear: z.string().min(1),
      })
    )
    .min(1)
    .max(5000),
});

// === Routes ===

/**
 * POST /bid-exports/queue
 * Queue bid items for export based on filter criteria
 */
router.post(
  "/queue",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = queueExportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          message: `Invalid request: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
        });
        return;
      }

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const userEmail = req.user?.email || "unknown";
      const result = await service.queueExport(parsed.data, userEmail);

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /bid-exports/queued-data?exportType=NAV
 * Get full CustomerBidDto data for all QUEUED items of a given type
 */
router.get(
  "/queued-data",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = exportTypeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          message: "exportType query parameter is required (WH or NAV)",
        });
        return;
      }

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const result = await service.getQueuedBidData(parsed.data.exportType);

      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /bid-exports/queue-summary
 * Get count of QUEUED items by export type
 */
router.get(
  "/queue-summary",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const result = await service.getQueueSummary();

      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bid-exports/mark-exported
 * Mark all QUEUED items of a given type as EXPORTED, create a run
 */
router.post(
  "/mark-exported",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = markExportedSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          message: "exportType is required (WH or NAV)",
        });
        return;
      }

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const userEmail = req.user?.email || "unknown";
      const result = await service.markExported(parsed.data, userEmail);

      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bid-exports/queue-by-keys
 * Queue bid items for export using explicit composite keys
 */
router.post(
  "/queue-by-keys",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = queueByKeysSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          message: `Invalid request: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
        });
        return;
      }

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const userEmail = req.user?.email || "unknown";
      const result = await service.queueExportByKeys(parsed.data, userEmail);

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bid-exports/export
 * Atomically mark QUEUED items as EXPORTED and return full bid data
 */
router.post(
  "/export",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = exportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          message: "exportType is required (WH or NAV)",
        });
        return;
      }

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const userEmail = req.user?.email || "unknown";
      const result = await service.exportAndReturn(
        parsed.data.exportType,
        userEmail
      );

      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bid-exports/cancel
 * Cancel all QUEUED items, optionally filtered by export type
 */
router.post(
  "/cancel",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = cancelSchema.safeParse(req.body);
      const exportType = parsed.success ? parsed.data.exportType : undefined;

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const cancelled = await service.cancelQueuedItems(exportType);

      res.json({ status: "success", data: { cancelled } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bid-exports/cancel-by-keys
 * Cancel QUEUED items by explicit composite keys
 */
router.post(
  "/cancel-by-keys",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = cancelByKeysSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          message: `Invalid request: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
        });
        return;
      }

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const cancelled = await service.cancelByKeys(parsed.data);

      res.json({ status: "success", data: { cancelled } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bid-exports/clear-export-by-keys
 * Clear export tracking (last_exported_at/by) on customer_bid_data by composite keys
 */
router.post(
  "/clear-export-by-keys",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = cancelByKeysSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          message: `Invalid request: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
        });
        return;
      }

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const cleared = await service.clearExportByKeys(parsed.data.keys);

      res.json({ status: "success", data: { cleared } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /bid-exports/runs?limit=20
 * Get export run history
 */
router.get(
  "/runs",
  authenticate,
  requireFeature(Feature.BID_EXPORT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = historyQuerySchema.safeParse(req.query);
      const limit = parsed.success ? parsed.data.limit : 20;

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const result = await service.getExportRuns(limit);

      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /bid-exports/webhook/nav
 * Prepare a webhook export — returns all QUEUED NAV items with a runId.
 * Idempotent: returns existing IN_PROGRESS run if one exists.
 */
router.get(
  "/webhook/nav",
  authenticate,
  requireFeature(Feature.BID_EXPORT_WEBHOOK),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const userEmail = req.user?.email || "unknown";
      const result = await service.prepareWebhookExport(userEmail);

      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bid-exports/webhook/nav/:runId/complete
 * Confirm a webhook export was successfully processed.
 * Marks items as EXPORTED and the run as COMPLETED.
 */
router.post(
  "/webhook/nav/:runId/complete",
  authenticate,
  requireFeature(Feature.BID_EXPORT_WEBHOOK),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { runId } = req.params;

      if (!runId) {
        res.status(400).json({
          status: "error",
          message: "runId is required",
        });
        return;
      }

      const service = container.resolve<IBidExportService>(
        BID_EXPORT_SERVICE_TOKEN
      );
      const userEmail = req.user?.email || "unknown";
      const result = await service.completeWebhookExport(runId, userEmail);

      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
