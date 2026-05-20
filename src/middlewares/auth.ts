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

export const authenticate = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return unauthorizedResponse(res, "No token provided") as any;
		}

		const token = authHeader.substring(7);

		try {
			const decodedToken = await auth.verifyIdToken(token);

			const user =
				(await userRepository.findById(decodedToken.uid)) ||
				(await userRepository.findByLinkedUid(decodedToken.uid));

			if (!user) {
				return unauthorizedResponse(
					res,
					"User not found. Please complete registration.",
				) as any;
			}

			req.user = user;
			req.userId = user.userId;

			return next();
		} catch (firebaseError) {
			try {
				const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
				const user = await userRepository.findById(decoded.userId);

				if (!user) {
					return unauthorizedResponse(res, "User not found") as any;
				}

				req.user = user;
				req.userId = user.userId;

				return next();
			} catch (jwtError) {
				return unauthorizedResponse(res, "Invalid or expired token") as any;
			}
		}
	} catch (error) {
		return unauthorizedResponse(res, "Authentication failed") as any;
	}
};

export const authenticateFirebase = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return unauthorizedResponse(res, "No token provided") as any;
		}

		const token = authHeader.substring(7);

		try {
			const decodedToken = await auth.verifyIdToken(token);
			req.firebaseUid = decodedToken.uid;
			return next();
		} catch (error) {
			return unauthorizedResponse(res, "Invalid or expired Firebase token") as any;
		}
	} catch (error) {
		return unauthorizedResponse(res, "Authentication failed") as any;
	}
};

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
			const decodedToken = await auth.verifyIdToken(token);
			const user =
				(await userRepository.findById(decodedToken.uid)) ||
				(await userRepository.findByLinkedUid(decodedToken.uid));

			if (user) {
				req.user = user;
				req.userId = user.userId;
			}
		} catch {
			try {
				const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
				const user = await userRepository.findById(decoded.userId);

				if (user) {
					req.user = user;
					req.userId = user.userId;
				}
			} catch {
			}
		}

		next();
	} catch (error) {
		next();
	}
};

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

export const generateToken = (payload: JwtPayload): string => {
	return jwt.sign(payload, env.JWT_SECRET, {
		expiresIn: env.JWT_EXPIRES_IN,
	} as jwt.SignOptions);
};

export const generateRefreshToken = (payload: JwtPayload): string => {
	return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
		expiresIn: env.JWT_REFRESH_EXPIRES_IN,
	} as jwt.SignOptions);
};

export const verifyRefreshToken = (token: string): JwtPayload => {
	return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
};
