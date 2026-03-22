import { Router, Request, Response, NextFunction, IRouter } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { authenticate } from "@/middleware/authenticate";
import { requireRole } from "@/middleware/authorize";
import { validateRequest } from "@/middleware/validate-request";
import { Role } from "@/contracts/rbac/role";
import {
  IRbacAdminService,
  RBAC_ADMIN_SERVICE_TOKEN,
} from "@/services/IRbacAdminService";

const router: IRouter = Router();

// All RBAC admin routes require ADMIN role
router.use(authenticate, requireRole(Role.ADMIN));

// --- Validation Schemas ---

const createGroupSchema = z.object({
  key: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  azureAdGroupId: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

const updateGroupSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  azureAdGroupId: z.string().max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

const setFeaturesSchema = z.object({
  featureKeys: z.array(z.string().min(1)),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});
type IdParams = z.infer<typeof idParamSchema>;

// --- Routes ---

/**
 * GET /rbac/groups
 * List all groups with their feature mappings.
 */
router.get(
  "/groups",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const service = container.resolve<IRbacAdminService>(
        RBAC_ADMIN_SERVICE_TOKEN
      );
      const groups = await service.findAllGroups();
      res.json({ status: "success", data: groups });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /rbac/groups
 * Create a new group.
 */
router.post(
  "/groups",
  validateRequest(createGroupSchema, "body"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = container.resolve<IRbacAdminService>(
        RBAC_ADMIN_SERVICE_TOKEN
      );
      const group = await service.createGroup(req.body);
      res.status(201).json({ status: "success", data: group });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /rbac/groups/:id
 * Get a single group by ID.
 */
router.get(
  "/groups/:id",
  validateRequest(idParamSchema, "params"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as IdParams;
      const service = container.resolve<IRbacAdminService>(
        RBAC_ADMIN_SERVICE_TOKEN
      );
      const group = await service.findGroupById(id);
      res.json({ status: "success", data: group });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /rbac/groups/:id
 * Update a group.
 */
router.put(
  "/groups/:id",
  validateRequest(idParamSchema, "params"),
  validateRequest(updateGroupSchema, "body"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as IdParams;
      const service = container.resolve<IRbacAdminService>(
        RBAC_ADMIN_SERVICE_TOKEN
      );
      const group = await service.updateGroup(id, req.body);
      res.json({ status: "success", data: group });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /rbac/groups/:id
 * Delete a group and its feature mappings.
 */
router.delete(
  "/groups/:id",
  validateRequest(idParamSchema, "params"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as IdParams;
      const service = container.resolve<IRbacAdminService>(
        RBAC_ADMIN_SERVICE_TOKEN
      );
      await service.deleteGroup(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /rbac/groups/:id/features
 * Set (replace) all feature mappings for a group.
 */
router.put(
  "/groups/:id/features",
  validateRequest(idParamSchema, "params"),
  validateRequest(setFeaturesSchema, "body"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as IdParams;
      const service = container.resolve<IRbacAdminService>(
        RBAC_ADMIN_SERVICE_TOKEN
      );
      const group = await service.setGroupFeatures(id, req.body.featureKeys);
      res.json({ status: "success", data: group });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
