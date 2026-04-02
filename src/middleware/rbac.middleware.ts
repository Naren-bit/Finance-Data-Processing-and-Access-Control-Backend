import { Request, Response, NextFunction } from 'express';
import { Role } from '../types/roles';
import { ApiError } from '../utils/ApiError';

/**
 * Role-Based Access Control (RBAC) middleware factory.
 * Returns a middleware function that checks if the authenticated user
 * has one of the specified roles.
 *
 * Usage: router.get('/admin-only', authenticate, requireRole(Role.ADMIN), handler)
 *
 * @param roles - One or more Role enum values that are allowed access
 * @returns Express middleware function
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    next();
  };
};
