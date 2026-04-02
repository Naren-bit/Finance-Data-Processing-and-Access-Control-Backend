import { Request, Response, NextFunction } from 'express';

/**
 * Wraps async route handlers to catch rejected promises
 * and pass them to Express's error handling middleware via next().
 * Eliminates the need for try/catch blocks in every controller method.
 */
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
