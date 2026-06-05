import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../config/redis";
import { HTTP_STATUS } from "../config/constants";
import { env } from "../config/env";
import { errorResponse } from "../utils/responseFormatter";

const createStore = (prefix: string) => new RedisStore({
	sendCommand: async (...args: string[]) => {
		return await redis.exec(args as [string, ...string[]]);
	},
	prefix: `rate_limit:${prefix}:`,
});

export const globalRateLimiter = rateLimit({
	windowMs: env.RATE_LIMIT_WINDOW_MS,
	max: env.RATE_LIMIT_MAX_REQUESTS,
	message: "Too many requests from this IP, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
	store: createStore("global"),
	passOnStoreError: true,
	handler: (_req, res) => {
		errorResponse(
			res,
			"Too many requests, please try again later",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

export const authRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	message: "Too many authentication attempts, please try again later",
	skipSuccessfulRequests: true,
	store: createStore("auth"),
	passOnStoreError: true,
	handler: (_req, res) => {
		errorResponse(
			res,
			"Too many authentication attempts, please try again in 15 minutes",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

export const apiRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message: "Too many API requests, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
	store: createStore("api"),
	passOnStoreError: true,
	handler: (_req, res) => {
		errorResponse(
			res,
			"Too many requests, please slow down",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

export const aiRateLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 20,
	message: "AI API rate limit exceeded, please try again later",
	store: createStore("ai"),
	passOnStoreError: true,
	handler: (_req, res) => {
		errorResponse(
			res,
			"AI API rate limit exceeded. Please try again in an hour",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});

export const uploadRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: "Too many file uploads, please try again later",
	store: createStore("upload"),
	passOnStoreError: true,
	handler: (_req, res) => {
		errorResponse(
			res,
			"Too many file uploads, please try again later",
			HTTP_STATUS.BAD_REQUEST,
		);
	},
});
