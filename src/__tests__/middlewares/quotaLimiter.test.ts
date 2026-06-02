import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

jest.mock("../../config/redis", () => ({
	redis: {
		incr: jest.fn(),
		expire: jest.fn(),
	},
}));

jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
}));

jest.mock("../../repositories/documentRepository");

import { redis } from "../../config/redis";
import { checkQuota } from "../../middlewares/quotaLimiter";
import documentRepository from "../../repositories/documentRepository";
import { ForbiddenError } from "../../utils/errorTypes";

describe("QuotaLimiter Middleware", () => {
	let req: any;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		next = jest.fn() as NextFunction;
		res = {};
	});

	it("should bypass quota checks if user is on pro tier", async () => {
		req = {
			userId: "user-pro",
			user: {
				userId: "user-pro",
				subscriptionPlan: "pro",
			} as any,
		};

		const middleware = checkQuota("documents");
		await middleware(req as Request, res as Response, next);

		expect(next).toHaveBeenCalledWith();
		expect(documentRepository.findByCreator).not.toHaveBeenCalled();
	});

	describe("documents resource", () => {
		it("should allow document creation if under free limit (3)", async () => {
			req = {
				userId: "user-free",
				user: {
					userId: "user-free",
					subscriptionPlan: "free",
				} as any,
			};

			jest
				.mocked(documentRepository.findByCreator)
				.mockResolvedValue([
					{ documentId: "doc-1" },
					{ documentId: "doc-2" },
				] as any);

			const middleware = checkQuota("documents");
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith();
		});

		it("should block document creation if limit reached (3)", async () => {
			req = {
				userId: "user-free",
				user: {
					userId: "user-free",
					subscriptionPlan: "free",
				} as any,
			};

			jest
				.mocked(documentRepository.findByCreator)
				.mockResolvedValue([
					{ documentId: "doc-1" },
					{ documentId: "doc-2" },
					{ documentId: "doc-3" },
				] as any);

			const middleware = checkQuota("documents");
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
		});
	});

	describe("latex resource", () => {
		it("should allow latex compilation if under free limit (5)", async () => {
			req = {
				userId: "user-free",
				user: {
					userId: "user-free",
					subscriptionPlan: "free",
				} as any,
			};

			jest.mocked(redis.incr).mockResolvedValue(4);

			const middleware = checkQuota("latex");
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith();
		});

		it("should block latex compilation if limit exceeded", async () => {
			req = {
				userId: "user-free",
				user: {
					userId: "user-free",
					subscriptionPlan: "free",
				} as any,
			};

			jest.mocked(redis.incr).mockResolvedValue(6);

			const middleware = checkQuota("latex");
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
		});

		it("should set expiry on first compile key", async () => {
			req = {
				userId: "user-free",
				user: {
					userId: "user-free",
					subscriptionPlan: "free",
				} as any,
			};

			jest.mocked(redis.incr).mockResolvedValue(1);

			const middleware = checkQuota("latex");
			await middleware(req as Request, res as Response, next);

			expect(redis.expire).toHaveBeenCalled();
			expect(next).toHaveBeenCalledWith();
		});
	});

	describe("ai resource", () => {
		it("should allow AI request if under daily limit (10)", async () => {
			req = {
				userId: "user-free",
				user: {
					userId: "user-free",
					subscriptionPlan: "free",
				} as any,
			};

			jest.mocked(redis.incr).mockResolvedValue(9);

			const middleware = checkQuota("ai");
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith();
		});

		it("should block AI request if daily limit exceeded", async () => {
			req = {
				userId: "user-free",
				user: {
					userId: "user-free",
					subscriptionPlan: "free",
				} as any,
			};

			jest.mocked(redis.incr).mockResolvedValue(11);

			const middleware = checkQuota("ai");
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
		});
	});
});
