import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import type { Feature } from "@/contracts/rbac/feature";
import type { Role } from "@/contracts/rbac/role";
import { IRbacService, RBAC_SERVICE_TOKEN } from "@/services/IRbacService";

/**
 * Authorization Middleware Factories
 *
 * Must be used AFTER the `authenticate` middleware (requires `req.user`).
 * When RBAC is disabled, these middleware are effectively no-ops.
 */

/**
 * Require the user to have access to at least one of the specified features.
 * Features are resolved from the user's Azure AD groups via the RBAC service.
 *
 * @example
 * router.get('/chat', authenticate, requireFeature(Feature.STARQ), handler);
 */
export function requireFeature(...features: Feature[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: "AuthenticationError",
        message: "Authentication required",
      });
      return;
    }

    try {
      const rbacService = container.resolve<IRbacService>(RBAC_SERVICE_TOKEN);
      const userGroups = req.user.groups;
      const userFeatures = await rbacService.resolveFeatures(userGroups);
      const hasAny = features.some((f) => userFeatures.includes(f));

      if (!hasAny) {
        res.status(403).json({
          error: "ForbiddenError",
          message: "Insufficient permissions",
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require the user to have at least one of the specified roles.
 * Roles are resolved from the user's Azure AD groups via the RBAC service.
 *
 * @example
 * router.delete('/items/:id', authenticate, requireRole(Role.ADMIN), handler);
 */
export function requireRole(...roles: Role[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: "AuthenticationError",
        message: "Authentication required",
      });
      return;
    }

    try {
      const rbacService = container.resolve<IRbacService>(RBAC_SERVICE_TOKEN);
      const userGroups = req.user.groups;
      const userRoles = await rbacService.resolveRoles(userGroups);
      const hasAny = roles.some((r) =>
        userRoles.some((ur) => ur.enumKey === r)
      );

      if (!hasAny) {
        res.status(403).json({
          error: "ForbiddenError",
          message: "Insufficient permissions",
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
