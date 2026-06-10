import type { NextFunction, Request, Response } from "express";
import { redis } from "../config/redis";
import documentRepository from "../repositories/documentRepository";
import { ForbiddenError } from "../utils/errorTypes";
import logger from "../utils/logger";

export const TIER_LIMITS = {
	free: {
		documents: 3,
		latexCompilations: Infinity,
		aiRequests: 200,
	},
	pro: {
		documents: Infinity,
		latexCompilations: Infinity,
		aiRequests: Infinity,
	},
	enterprise: {
		documents: Infinity,
		latexCompilations: Infinity,
		aiRequests: Infinity,
	},
} as const;

/**
 * Middleware factory to check and enforce resource quotas
 */
export const checkQuota = (resource: "documents" | "latex" | "ai") => {
	return async (
		req: Request,
		_res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const user = req.user;
			const userId = req.userId;

			if (!user || !userId) {
				return next();
			}

			const plan = user.subscriptionPlan || "free";
			const limits = TIER_LIMITS[plan];

			// Pro and Enterprise tier bypasses all limits
			if (plan === "pro" || plan === "enterprise") {
				return next();
			}

			const todayDate = new Date().toISOString().split("T")[0];

			if (resource === "documents") {
				// Count documents created by user
				const docs = await documentRepository.findByCreator(userId);
				if (docs.length >= limits.documents) {
					logger.warn(
						`[QuotaLimiter] User ${userId} exceeded document limit (${docs.length}/${limits.documents})`,
					);
					throw new ForbiddenError(
						`You have reached your Free tier document limit of ${limits.documents}. Please upgrade to Pro for unlimited documents.`,
					);
				}
			} else if (resource === "latex") {
				const key = `quota:latex:${userId}:${todayDate}`;
				const current = await redis.incr(key);

				if (current === 1) {
					await redis.expire(key, 86400); // 24 hours expiry
				}

				if (current > limits.latexCompilations) {
					logger.warn(
						`[QuotaLimiter] User ${userId} exceeded daily LaTeX compilation limit (${current}/${limits.latexCompilations})`,
					);
					throw new ForbiddenError(
						`You have reached your Free tier daily LaTeX compilation limit of ${limits.latexCompilations}. Please upgrade to Pro for unlimited compilations.`,
					);
				}
			} else if (resource === "ai") {
				const key = `quota:ai:${userId}:${todayDate}`;
				const current = await redis.incr(key);

				if (current === 1) {
					await redis.expire(key, 86400); // 24 hours expiry
				}

				if (current > limits.aiRequests) {
					logger.warn(
						`[QuotaLimiter] User ${userId} exceeded daily AI request limit (${current}/${limits.aiRequests})`,
					);
					throw new ForbiddenError(
						`You have reached your Free tier daily AI request limit of ${limits.aiRequests}. Please upgrade to Pro for unlimited AI access.`,
					);
				}
			}

			return next();
		} catch (error) {
			next(error);
		}
	};
};
