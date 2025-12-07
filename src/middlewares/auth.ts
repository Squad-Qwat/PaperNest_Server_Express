import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorizedResponse } from '../utils/responseFormatter';
import userRepository from '../repositories/userRepository';
import '../types/express'; // Import type augmentation

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Verify JWT token middleware
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(res, 'No token provided') as any;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Get user from database
    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      return unauthorizedResponse(res, 'User not found') as any;
    }

    // Attach user to request
    req.user = user;
    req.userId = user.userId;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return unauthorizedResponse(res, 'Invalid token') as any;
    }

    if (error instanceof jwt.TokenExpiredError) {
      return unauthorizedResponse(res, 'Token expired') as any;
    }

    return unauthorizedResponse(res, 'Authentication failed') as any;
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await userRepository.findById(decoded.userId);

    if (user) {
      req.user = user;
      req.userId = user.userId;
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Check if user has specific role
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorizedResponse(res, 'Authentication required');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      unauthorizedResponse(
        res,
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      );
      return;
    }

    next();
  };
};

/**
 * Generate JWT token
 */
export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
};
