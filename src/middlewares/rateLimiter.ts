import rateLimit from "express-rate-limit";
import { HTTP_STATUS } from "../config/constants";
import { env } from "../config/env";
import { errorResponse } from "../utils/responseFormatter";

/**
 * Global rate limiter
 */
export const globalRateLimiter = rateLimit({
	windowMs: env.RATE_LIMIT_WINDOW_MS,
	max: env.RATE_LIMIT_MAX_REQUESTS,
	message: "Too many requests from this IP, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
	handler: (_req, res) => {
		errorResponse(
			res,
			"Too many requests, please try again later",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

/**
 * Auth rate limiter (stricter for authentication endpoints)
 */
export const authRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // 5 requests per windowMs
	message: "Too many authentication attempts, please try again later",
	skipSuccessfulRequests: true,
	handler: (_req, res) => {
		errorResponse(
			res,
			"Too many authentication attempts, please try again in 15 minutes",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

/**
 * API rate limiter (for general API endpoints)
 */
export const apiRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // 100 requests per windowMs
	message: "Too many API requests, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
	handler: (_req, res) => {
		errorResponse(
			res,
			"Too many requests, please slow down",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

/**
 * AI rate limiter (stricter for AI endpoints due to cost)
 */
export const aiRateLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 20, // 20 requests per hour
	message: "AI API rate limit exceeded, please try again later",
	handler: (_req, res) => {
		errorResponse(
			res,
			"AI API rate limit exceeded. Please try again in an hour",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

/**
 * File upload rate limiter
 */
export const uploadRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // 10 uploads per windowMs
	message: "Too many file uploads, please try again later",
	handler: (_req, res) => {
		errorResponse(
			res,
			"Too many file uploads, please try again later",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});
