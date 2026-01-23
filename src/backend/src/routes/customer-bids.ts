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
  wonLost: z.enum(["WON", "LOST"]).optional(),
  sourceDb: z.string().optional(),
  schoolYear: z.enum(["current", "previous", "next"]).default("next"),
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
 * - wonLost: Filter by WON or LOST status (deprecated - returns "Coming Soon..")
 * - sourceDb: Filter by source database
 *
 * Response includes:
 * - dateRange: The date range used for querying based on schoolYear
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

export default router;
