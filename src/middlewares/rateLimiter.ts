import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../config/redis";
import { HTTP_STATUS } from "../config/constants";
import { env } from "../config/env";
import { errorResponse } from "../utils/responseFormatter";

const sendCommandWithTimeout = async (...args: string[]) => {
	const timeoutPromise = new Promise((_, reject) =>
		setTimeout(() => reject(new Error("Redis request timeout")), 1500),
	);
	const redisPromise = redis.exec(args as [string, ...string[]]);
	return (await Promise.race([redisPromise, timeoutPromise])) as any;
};

const createStore = (prefix: string) => {
	return new RedisStore({
		sendCommand: sendCommandWithTimeout,
		prefix: `rate_limit:${prefix}:`,
	});
};

const makeLimiter = (options: any) => {
	return rateLimit(options);
};

export const globalRateLimiter = makeLimiter({
	windowMs: env.RATE_LIMIT_WINDOW_MS,
	max: env.RATE_LIMIT_MAX_REQUESTS,
	message: "Too many requests from this IP, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
	store: createStore("global"),
	passOnStoreError: true,
	handler: (_req: Request, res: Response) => {
		errorResponse(
			res,
			"Too many requests, please try again later",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

export const authRateLimiter = makeLimiter({
	windowMs: 15 * 60 * 1000,
	max: 5,
	message: "Too many authentication attempts, please try again later",
	skipSuccessfulRequests: true,
	store: createStore("auth"),
	passOnStoreError: true,
	handler: (_req: Request, res: Response) => {
		errorResponse(
			res,
			"Too many authentication attempts, please try again in 15 minutes",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

export const apiRateLimiter = makeLimiter({
	windowMs: 15 * 60 * 1000,
	max: 300,
	message: "Too many API requests, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
	store: createStore("api"),
	passOnStoreError: true,
	handler: (_req: Request, res: Response) => {
		errorResponse(
			res,
			"Too many requests, please slow down",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

export const aiRateLimiter = makeLimiter({
	windowMs: 60 * 60 * 1000,
	max: 200,
	message: "AI API rate limit exceeded, please try again later",
	store: createStore("ai"),
	passOnStoreError: true,
	handler: (_req: Request, res: Response) => {
		errorResponse(
			res,
			"AI API rate limit exceeded. Please try again in an hour",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

export const uploadRateLimiter = makeLimiter({
	windowMs: 15 * 60 * 1000,
	max: 30,
	message: "Too many file uploads, please try again later",
	store: createStore("upload"),
	passOnStoreError: true,
	handler: (_req: Request, res: Response) => {
		errorResponse(
			res,
			"Too many file uploads, please try again later",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

/**
 * Rate limiter for file edit/overwrite operations and proxy downloads.
 * Much more lenient than uploadRateLimiter since these happen frequently
 * during normal editing (autosave, file fetching, etc.)
 */
export const editFileLimiter = makeLimiter({
	windowMs: 15 * 60 * 1000,
	max: 500,
	message: "Too many edit requests, please try again later",
	store: createStore("edit"),
	passOnStoreError: true,
	handler: (_req: Request, res: Response) => {
		errorResponse(
			res,
			"Too many edit requests, please slow down",
			HTTP_STATUS.TOO_MANY_REQUESTS,
		);
	},
});
