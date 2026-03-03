import { Router, Request, Response, NextFunction, IRouter } from "express";
import { z } from "zod";
import { container } from "tsyringe";
import {
  IEoRiskReviewService,
  EO_RISK_REVIEW_SERVICE_TOKEN,
} from "@/services/IEoRiskReviewService";
import { authenticate } from "@/middleware/authenticate";
import { requireFeature } from "@/middleware/authorize";
import { Feature } from "@/contracts/rbac/feature";
import { validateRequest } from "@/middleware/validate-request";

const router: IRouter = Router();

// Validation schemas
const riskReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  location: z.string().optional(),
  itemNo: z.string().optional(),
  sourceDb: z.string().optional(),
  agingDays: z.coerce.number().int().min(1).max(365).default(30),
  lookbackDays: z.coerce.number().int().min(1).max(365).default(45),
  excessDays: z.coerce.number().int().min(1).max(365).default(60),
});

/**
 * GET /eo-risk-review
 * List items meeting at least one E&O risk criteria
 */
router.get(
  "/",
  authenticate,
  requireFeature(Feature.EO_RISK_REVIEW),
  validateRequest(riskReviewQuerySchema, "query"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = container.resolve<IEoRiskReviewService>(
        EO_RISK_REVIEW_SERVICE_TOKEN
      );
      const result = await service.getRiskItems(req.query as never);

      res.json({
        status: "success",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /eo-risk-review/filter-options
 * Get distinct values for filter dropdowns
 */
router.get(
  "/filter-options",
  authenticate,
  requireFeature(Feature.EO_RISK_REVIEW),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const service = container.resolve<IEoRiskReviewService>(
        EO_RISK_REVIEW_SERVICE_TOKEN
      );
      const options = await service.getFilterOptions();

      res.json({
        status: "success",
        data: options,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
