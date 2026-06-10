import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

jest.mock("../../config/redis", () => ({
	redis: {
		exec: jest.fn(),
	},
}));

import { redis } from "../../config/redis";
import {
	aiRateLimiter,
	apiRateLimiter,
	authRateLimiter,
	globalRateLimiter,
	uploadRateLimiter,
} from "../../middlewares/rateLimiter";

const mockRedisImplementation = (hits: number, shouldThrow = false) => {
	return async (args: any) => {
		const command = args[0]?.toUpperCase();
		if (command === "SCRIPT" && args[1]?.toUpperCase() === "LOAD") {
			return "mocked-sha-hash";
		}
		if (shouldThrow) {
			throw new Error("Redis connection timed out");
		}
		return [hits, 60000];
	};
};

describe("Rate Limiter Middleware", () => {
	let req: any;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		next = jest.fn() as NextFunction;
		res = {
			setHeader: jest.fn() as any,
			status: jest.fn().mockReturnThis() as any,
			json: jest.fn().mockReturnThis() as any,
			once: jest.fn() as any,
		};
		req = {
			ip: "127.0.0.1",
			socket: {},
			headers: {},
			app: {
				get: () => false,
			},
		};

		(jest.mocked(redis.exec) as any).mockImplementation(
			mockRedisImplementation(1),
		);
	});

	describe("globalRateLimiter", () => {
		it("should allow request if under the limit", async () => {
			await globalRateLimiter(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith();
			expect(res.status).not.toHaveBeenCalled();
		});

		it("should block request (400 Bad Request) if limit is exceeded", async () => {
			(jest.mocked(redis.exec) as any).mockImplementation(
				mockRedisImplementation(200),
			);

			await globalRateLimiter(req as Request, res as Response, next);

			expect(next).not.toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalled();
		});

		it("should fail-open and allow request if Redis store throws an error", async () => {
			(jest.mocked(redis.exec) as any).mockImplementation(
				mockRedisImplementation(1, true),
			);

			await globalRateLimiter(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith();
			expect(res.status).not.toHaveBeenCalled();
		});
	});

	describe.each([
		["authRateLimiter", authRateLimiter],
		["apiRateLimiter", apiRateLimiter],
		["aiRateLimiter", aiRateLimiter],
		["uploadRateLimiter", uploadRateLimiter],
	])("%s", (_name, limiter) => {
		it("should allow requests below limit", async () => {
			jest.mocked(redis.exec).mockResolvedValue([1, 60000] as any);
			await limiter(req as Request, res as Response, next);
			expect(next).toHaveBeenCalledWith();
		});
	});
});
