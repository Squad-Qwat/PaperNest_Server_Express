import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errorTypes';
import { errorResponse } from '../utils/responseFormatter';
import { HTTP_STATUS } from '../config/constants';
import logger from '../utils/logger';
import { env } from '../config/env';

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.userId,
  });

  // Handle operational errors
  if (err instanceof AppError && err.isOperational) {
    errorResponse(
      res,
      err.message,
      err.statusCode,
      (err as any).errors
    );
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    errorResponse(res, 'Invalid token', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    errorResponse(res, 'Token expired', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  // Handle Joi validation errors
  if (err.name === 'ValidationError') {
    errorResponse(res, err.message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    return;
  }

  // Handle Firebase errors
  if (err.message.includes('Firebase')) {
    logger.error('Firebase error:', err);
    errorResponse(res, 'Database operation failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    return;
  }

  // Handle programming or unknown errors
  logger.error('Unhandled error:', {
    error: err,
    stack: err.stack,
  });

  // Don't leak error details in production
  const message =
    env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Something went wrong';

  errorResponse(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
};

/**
 * Handle 404 errors
 */
export const notFound = (req: Request, res: Response, _next: NextFunction): void => {
  errorResponse(
    res,
    `Route ${req.method} ${req.url} not found`,
    HTTP_STATUS.NOT_FOUND
  );
};

/**
 * Async handler wrapper to catch errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
