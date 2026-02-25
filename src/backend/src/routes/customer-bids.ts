import { Router, Request, Response, NextFunction, IRouter } from "express";
import { z } from "zod";
import { container } from "tsyringe";
import {
  ICustomerBidService,
  CUSTOMER_BID_SERVICE_TOKEN,
} from "@/services/ICustomerBidService";
import { authenticate } from "@/middleware/authenticate";
import {
  CustomerBidQueryError,
  CustomerBidDatabaseError,
  CustomerBidNotFoundError,
  CustomerBidSyncInProgressError,
} from "@/utils/errors/customer-bid-errors";

const router: IRouter = Router();

/**
 * Query parameters validation schema
 */
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  siteCode: z.string().optional(),
  customerBillTo: z.string().optional(),
  customerName: z.string().optional(),
  salesRep: z.string().optional(),
  itemCode: z.string().optional(),
  erpStatus: z.string().optional(),
  isLost: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  confirmed: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  exported: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  queued: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  coOpCode: z.string().optional(),
  sourceDb: z.string().optional(),
  excludeItemPrefixes: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined
    ),
  schoolYear: z.enum(["current", "previous", "next"]).default("next"),
});

/**
 * Path parameters schema for single record operations
 */
const pathParamsSchema = z.object({
  sourceDb: z.string().min(1),
  siteCode: z.string().min(1),
  customerBillTo: z.string().min(1),
  itemNo: z.string().min(1),
  schoolYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "School year must be in format YYYY-YYYY"),
});

/**
 * Update DTO schema for PATCH requests
 */
const updateBidSchema = z.object({
  yearAround: z.boolean().optional(),
  // Monthly estimates
  estimateJan: z.number().nullable().optional(),
  estimateFeb: z.number().nullable().optional(),
  estimateMar: z.number().nullable().optional(),
  estimateApr: z.number().nullable().optional(),
  estimateMay: z.number().nullable().optional(),
  estimateJun: z.number().nullable().optional(),
  estimateJul: z.number().nullable().optional(),
  estimateAug: z.number().nullable().optional(),
  estimateSep: z.number().nullable().optional(),
  estimateOct: z.number().nullable().optional(),
  estimateNov: z.number().nullable().optional(),
  estimateDec: z.number().nullable().optional(),
});

/**
 * Bulk update schema
 */
const bulkUpdateSchema = z.object({
  records: z
    .array(
      z.object({
        sourceDb: z.string().min(1),
        siteCode: z.string().min(1),
        customerBillTo: z.string().min(1),
        itemNo: z.string().min(1),
        schoolYear: z.string().regex(/^\d{4}-\d{4}$/),
        yearAround: z.boolean().optional(),
        // Monthly estimates
        estimateJan: z.number().nullable().optional(),
        estimateFeb: z.number().nullable().optional(),
        estimateMar: z.number().nullable().optional(),
        estimateApr: z.number().nullable().optional(),
        estimateMay: z.number().nullable().optional(),
        estimateJun: z.number().nullable().optional(),
        estimateJul: z.number().nullable().optional(),
        estimateAug: z.number().nullable().optional(),
        estimateSep: z.number().nullable().optional(),
        estimateOct: z.number().nullable().optional(),
        estimateNov: z.number().nullable().optional(),
        estimateDec: z.number().nullable().optional(),
        // Virtual confirmed flag: true → confirmBid(), false → unconfirmBid()
        confirmed: z.boolean().optional(),
      })
    )
    .min(1)
    .max(1000),
});

/**
 * Sync request schema
 */
const syncRequestSchema = z.object({
  schoolYear: z.enum(["current", "previous", "next"]).default("next"),
});

/**
 * Sync history query schema
 */
const syncHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * Helper to handle customer bid specific errors
 */
function handleCustomerBidError(
  error: unknown,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof CustomerBidQueryError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (error instanceof CustomerBidDatabaseError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (error instanceof CustomerBidNotFoundError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (error instanceof CustomerBidSyncInProgressError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  next(error);
}

/**
 * GET /customer-bids
 * Get paginated customer bid records with optional filters
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Records per page (default: 50, max: 200)
 * - schoolYear: School year filter - "previous", "current", or "next" (default: "next")
 * - siteCode: Filter by site/location code (matches customer location_code)
 * - customerBillTo: Filter by customer number (partial match, case-insensitive)
 * - customerName: Filter by customer name (partial match, case-insensitive)
 * - salesRep: Filter by sales rep code
 * - itemCode: Filter by item code
 * - erpStatus: Filter by ERP status (partial match, case-insensitive)
 * - isLost: Filter by lost status (true = items in previous year but not current)
 * - confirmed: Filter by user confirmation status
 * - sourceDb: Filter by source database
 *
 * Response includes:
 * - dateRange: The date range used for querying based on schoolYear
 * - Pre-calculated fields: lastYearBidQty, lastYearActual, lyAugust-lyJuly (all 12 months), isLost
 * - User-editable fields: confirmed, augustDemand, septemberDemand, octoberDemand
 */
router.get(
  "/",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate query parameters
      const parsed = querySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new CustomerBidQueryError(
          `Invalid query parameters: ${parsed.error.errors.map((e) => e.message).join(", ")}`
        );
      }

      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const result = await customerBidService.getCustomerBids(parsed.data);

      res.json({
        status: "success",
        ...result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

/**
 * GET /customer-bids/filter-options
 * Get distinct filter option values for autocomplete suggestions
 */
router.get(
  "/filter-options",
  authenticate,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const result = await customerBidService.getFilterOptions();

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

/**
 * PATCH /customer-bids/:sourceDb/:siteCode/:customerBillTo/:itemNo/:schoolYear
 * Update user-editable fields on a customer bid record
 *
 * Path Parameters:
 * - sourceDb: Source database identifier
 * - siteCode: Site/location code
 * - customerBillTo: Customer bill-to number
 * - itemNo: Item number
 * - schoolYear: School year in format YYYY-YYYY (e.g., "2025-2026")
 *
 * Request Body:
 * - augustDemand?: number | null - August demand forecast
 * - septemberDemand?: number | null - September demand forecast
 * - octoberDemand?: number | null - October demand forecast
 */
router.patch(
  "/:sourceDb/:siteCode/:customerBillTo/:itemNo/:schoolYear",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate path parameters
      const pathParsed = pathParamsSchema.safeParse(req.params);
      if (!pathParsed.success) {
        throw new CustomerBidQueryError(
          `Invalid path parameters: ${pathParsed.error.errors.map((e) => e.message).join(", ")}`
        );
      }

      // Validate request body
      const bodyParsed = updateBidSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        throw new CustomerBidQueryError(
          `Invalid request body: ${bodyParsed.error.errors.map((e) => e.message).join(", ")}`
        );
      }

      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const userEmail = req.user?.email || "unknown";
      const result = await customerBidService.updateBid(
        pathParsed.data,
        bodyParsed.data,
        userEmail
      );

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

/**
 * POST /customer-bids/bulk-update/preview
 * Preview which records would actually change in a bulk update (read-only)
 *
 * Request Body: Same as /bulk-update
 * Response:
 * - changed: Number of records that would be updated
 * - unchanged: Number of records with no changes
 * - changedKeys: Array of composite key strings for changed records
 */
router.post(
  "/bulk-update/preview",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new CustomerBidQueryError(
          `Invalid request body: ${parsed.error.errors.map((e) => e.message).join(", ")}`
        );
      }

      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const result = await customerBidService.previewBulkUpdate(parsed.data);

      res.json({
        status: "success",
        ...result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

/**
 * POST /customer-bids/bulk-update
 * Bulk update multiple customer bid records
 *
 * Request Body:
 * - records: Array of objects containing:
 *   - sourceDb, siteCode, customerBillTo, itemNo, schoolYear (required)
 *   - augustDemand, septemberDemand, octoberDemand (optional)
 *
 * Response:
 * - updated: Number of successfully updated records
 * - failed: Number of failed updates
 * - errors: Array of error details for failed records
 */
router.post(
  "/bulk-update",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new CustomerBidQueryError(
          `Invalid request body: ${parsed.error.errors.map((e) => e.message).join(", ")}`
        );
      }

      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const userEmail = req.user?.email || "unknown";
      const result = await customerBidService.bulkUpdateBids(
        parsed.data,
        userEmail
      );

      res.json({
        status: "success",
        ...result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

/**
 * POST /customer-bids/:sourceDb/:siteCode/:customerBillTo/:itemNo/:schoolYear/confirm
 * Confirm a customer bid record
 *
 * Sets confirmed_at to current UTC timestamp and confirmed_by to the
 * authenticated user's email. Creates the record if it doesn't exist.
 */
router.post(
  "/:sourceDb/:siteCode/:customerBillTo/:itemNo/:schoolYear/confirm",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pathParsed = pathParamsSchema.safeParse(req.params);
      if (!pathParsed.success) {
        throw new CustomerBidQueryError(
          `Invalid path parameters: ${pathParsed.error.errors.map((e) => e.message).join(", ")}`
        );
      }

      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const userEmail = req.user?.email || "unknown";

      const result = await customerBidService.confirmBid(
        pathParsed.data,
        userEmail
      );

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

/**
 * POST /customer-bids/:sourceDb/:siteCode/:customerBillTo/:itemNo/:schoolYear/unconfirm
 * Unconfirm a customer bid record
 *
 * Clears confirmed_at and confirmed_by fields (sets to null).
 */
router.post(
  "/:sourceDb/:siteCode/:customerBillTo/:itemNo/:schoolYear/unconfirm",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pathParsed = pathParamsSchema.safeParse(req.params);
      if (!pathParsed.success) {
        throw new CustomerBidQueryError(
          `Invalid path parameters: ${pathParsed.error.errors.map((e) => e.message).join(", ")}`
        );
      }

      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const result = await customerBidService.unconfirmBid(pathParsed.data);

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

/**
 * POST /customer-bids/sync
 * Trigger a sync operation to populate/refresh calculated fields
 *
 * Request Body:
 * - schoolYear: "current" | "previous" | "next" (default: "next")
 *
 * Response:
 * - syncId: Unique identifier for the sync operation
 * - status: "COMPLETED" | "FAILED"
 * - schoolYear: The school year that was synced (e.g., "2025-2026")
 * - recordsTotal: Total records processed
 * - recordsInserted: New records created
 * - recordsUpdated: Existing records updated
 * - durationMs: Time taken in milliseconds
 */
router.post(
  "/sync",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const parsed = syncRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new CustomerBidQueryError(
          `Invalid request body: ${parsed.error.errors.map((e) => e.message).join(", ")}`
        );
      }

      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const result = await customerBidService.sync(
        parsed.data.schoolYear,
        "manual"
      );

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

/**
 * GET /customer-bids/sync/status
 * Get the latest sync status
 *
 * Response:
 * - Latest sync log entry or null if no syncs have run
 */
router.get(
  "/sync/status",
  authenticate,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const result = await customerBidService.getSyncStatus();

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

/**
 * GET /customer-bids/sync/history
 * Get sync history
 *
 * Query Parameters:
 * - limit: Maximum number of entries to return (default: 10, max: 100)
 *
 * Response:
 * - Array of sync log entries
 */
router.get(
  "/sync/history",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate query parameters
      const parsed = syncHistoryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new CustomerBidQueryError(
          `Invalid query parameters: ${parsed.error.errors.map((e) => e.message).join(", ")}`
        );
      }

      const customerBidService = container.resolve<ICustomerBidService>(
        CUSTOMER_BID_SERVICE_TOKEN
      );

      const result = await customerBidService.getSyncHistory(parsed.data.limit);

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleCustomerBidError(error, res, next);
    }
  }
);

export default router;
