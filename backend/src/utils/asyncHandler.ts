import { Request, Response, NextFunction } from 'express';

/**
 * Async handler wrapper for Express routes
 * Automatically catches errors and passes them to error middleware
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};