import { Request, Response, NextFunction } from "express";

/**
 * Authorization Middleware Factories
 *
 * Must be used AFTER the `authenticate` middleware (requires `req.user`).
 * Returns 403 Forbidden if the user lacks the required group or role.
 */

/**
 * Require the user to belong to at least one of the specified groups.
 * Groups are matched against `req.user.groups` (Azure AD groups from custom:groups).
 *
 * @example
 * router.get('/admin', authenticate, requireGroups('Admins', 'SuperAdmins'), handler);
 */
export function requireGroups(...requiredGroups: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "AuthenticationError",
        message: "Authentication required",
      });
      return;
    }

    const userGroups = req.user.groups;
    const hasGroup = requiredGroups.some((g) => userGroups.includes(g));

    if (!hasGroup) {
      res.status(403).json({
        error: "ForbiddenError",
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}

/**
 * Require the user to have the specified role.
 * Role is matched against `req.user.role` (Azure AD app role from custom:role).
 *
 * @example
 * router.delete('/items/:id', authenticate, requireRole('admin'), handler);
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "AuthenticationError",
        message: "Authentication required",
      });
      return;
    }

    const userRole = req.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: "ForbiddenError",
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}
