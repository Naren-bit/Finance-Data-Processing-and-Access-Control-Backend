import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { Prisma } from '@prisma/client';

/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain and must have 4 arguments
 * for Express to recognize it as an error handler.
 *
 * Handles:
 * - ApiError (operational) → return statusCode with message
 * - Prisma P2002 (unique constraint) → 409 Conflict
 * - Prisma P2025 (record not found) → 404 Not Found
 * - All other errors → 500 with generic message in production
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Log error for debugging (always log, even in production)
  console.error(`[ERROR] ${new Date().toISOString()}:`, err.message);

  // Handle operational API errors
  if (err instanceof ApiError && err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Handle Prisma unique constraint violation (e.g., duplicate email)
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    const target = (err.meta?.target as string[])?.join(', ') || 'field';
    res.status(409).json({
      success: false,
      message: `A record with this ${target} already exists`,
    });
    return;
  }

  // Handle Prisma record not found
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2025'
  ) {
    res.status(404).json({
      success: false,
      message: 'Record not found',
    });
    return;
  }

  // Handle Zod validation errors (fallback if not caught in controller)
  if (err.name === 'ZodError') {
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      details: (err as unknown as { errors: Array<{ path: string[]; message: string }> }).errors.map(
        (e: { path: string[]; message: string }) => ({
          field: e.path.join('.'),
          message: e.message,
        }),
      ),
    });
    return;
  }

  // Unknown/unexpected errors — never expose internal details in production
  const isDev = process.env.NODE_ENV === 'development';

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(isDev && { error: err.message, stack: err.stack }),
  });
};
