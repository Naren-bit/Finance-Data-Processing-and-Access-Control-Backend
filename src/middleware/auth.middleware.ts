import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import { Role } from '../types/roles';

interface JwtPayload {
  id: string;
  email: string;
  role: Role;
}

/**
 * JWT authentication middleware.
 * Verifies the access token from the Authorization header,
 * checks user existence and active status in the database,
 * and attaches the user object to the request.
 *
 * Error handling follows security best practices:
 * - No token → 401 "No token provided"
 * - Bad format → 401 "Invalid token format"
 * - Tampered → 401 "Invalid token"
 * - Expired → 401 "Token expired"
 * - User deleted → 401 "User not found"
 * - Account disabled → 401 "Account deactivated"
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new ApiError(401, 'No token provided');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new ApiError(401, 'Invalid token format');
    }

    const token = parts[1];

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid token');
      }
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    if (!user.isActive) {
      throw new ApiError(401, 'Account deactivated');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as Role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    next(error);
  }
};
