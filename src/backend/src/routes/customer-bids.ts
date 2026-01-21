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
  customerNo: z.string().optional(),
  salesRep: z.string().optional(),
  itemCode: z.string().optional(),
  wonLost: z.enum(["WON", "LOST"]).optional(),
  sourceDb: z.string().optional(),
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
 * - siteCode: Filter by site/location code
 * - customerNo: Filter by customer number
 * - salesRep: Filter by sales rep code
 * - itemCode: Filter by item code
 * - wonLost: Filter by WON or LOST status
 * - sourceDb: Filter by source database
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
