import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { auth } from "../config/firebase";
import userRepository from "../repositories/userRepository";
import logger from "../utils/logger";
import { unauthorizedResponse } from "../utils/responseFormatter";

export interface JwtPayload {
	userId: string;
	email: string;
	role: string;
}

/**
 * Verify Firebase Auth token middleware
 * This is the PRIMARY authentication method - uses Firebase Auth tokens from frontend
 */
export const authenticate = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		// Get token from header
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return unauthorizedResponse(res, "No token provided") as any;
		}

		const token = authHeader.substring(7); // Remove 'Bearer ' prefix

		try {
			// First, try to verify as Firebase Auth token
			const decodedToken = await auth.verifyIdToken(token);

			// Get user from our database using Firebase UID (check both primary and linked UIDs)
			const user =
				(await userRepository.findById(decodedToken.uid)) ||
				(await userRepository.findByLinkedUid(decodedToken.uid));

			if (!user) {
				// User authenticated with Firebase but not in our database
				logger.warn(
					`User ${decodedToken.uid} authenticated with Firebase but not found in database`,
				);
				return unauthorizedResponse(
					res,
					"User not found. Please complete registration.",
				) as any;
			}

			// Attach user to request
			req.user = user;
			req.userId = user.userId;

			logger.info(`User ${user.userId} authenticated via Firebase Auth`);
			return next();
		} catch (firebaseError) {
			// If Firebase Auth verification fails, try custom JWT (for backward compatibility)
			try {
				const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
				const user = await userRepository.findById(decoded.userId);

				if (!user) {
					return unauthorizedResponse(res, "User not found") as any;
				}

				req.user = user;
				req.userId = user.userId;

				logger.info(`User ${user.userId} authenticated via custom JWT`);
				return next();
			} catch (jwtError) {
				logger.error(
					"Authentication failed for both Firebase Auth and custom JWT",
					{
						firebaseError:
							firebaseError instanceof Error
								? firebaseError.message
								: firebaseError,
						jwtError: jwtError instanceof Error ? jwtError.message : jwtError,
					},
				);
				return unauthorizedResponse(res, "Invalid or expired token") as any;
			}
		}
	} catch (error) {
		logger.error("Authentication error:", error);
		return unauthorizedResponse(res, "Authentication failed") as any;
	}
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 * Supports both Firebase Auth and custom JWT
 */
export const optionalAuthenticate = async (
	req: Request,
	_res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return next();
		}

		const token = authHeader.substring(7);

		try {
			// Try Firebase Auth first (check both primary and linked UIDs)
			const decodedToken = await auth.verifyIdToken(token);
			const user =
				(await userRepository.findById(decodedToken.uid)) ||
				(await userRepository.findByLinkedUid(decodedToken.uid));

			if (user) {
				req.user = user;
				req.userId = user.userId;
			}
		} catch {
			// Try custom JWT
			try {
				const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
				const user = await userRepository.findById(decoded.userId);

				if (user) {
					req.user = user;
					req.userId = user.userId;
				}
			} catch {
				// Ignore errors in optional authentication
			}
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
			unauthorizedResponse(res, "Authentication required");
			return;
		}

		if (!allowedRoles.includes(req.user.role)) {
			unauthorizedResponse(
				res,
				`Access denied. Required roles: ${allowedRoles.join(", ")}`,
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
