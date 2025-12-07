import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { validationErrorResponse } from '../utils/responseFormatter';

/**
 * Validate request using Joi schema
 */
export const validate = (schema: {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: any[] = [];

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(
          ...error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: 'body',
          }))
        );
      }
    }

    // Validate params
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(
          ...error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: 'params',
          }))
        );
      }
    }

    // Validate query
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(
          ...error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: 'query',
          }))
        );
      }
    }

    // Return validation errors if any
    if (errors.length > 0) {
      return validationErrorResponse(res, errors) as any;
    }

    next();
  };
};

/**
 * Sanitize request data
 */
export const sanitize = (req: Request, _res: Response, next: NextFunction): void => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Recursively sanitize object
 */
const sanitizeObject = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized: any = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        // Basic XSS prevention
        sanitized[key] = value.trim();
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
};
