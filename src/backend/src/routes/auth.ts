import { Router, Request, Response, NextFunction, IRouter } from "express";
import { container } from "tsyringe";
import { authenticate } from "@/middleware/authenticate";
import { IRbacService, RBAC_SERVICE_TOKEN } from "@/services/IRbacService";

const router: IRouter = Router();

/**
 * GET /auth/access
 *
 * Returns the authenticated user's resolved roles and features.
 * Used by the frontend to conditionally render UI based on permissions.
 */
router.get(
  "/access",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rbacService = container.resolve<IRbacService>(RBAC_SERVICE_TOKEN);
      const userAccess = await rbacService.getUserAccess(req.user!.groups);
      res.json(userAccess);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
