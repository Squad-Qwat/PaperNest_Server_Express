import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

const mockSecret = require("crypto").randomBytes(16).toString("hex");

jest.mock("../../config/env", () => ({
	env: {
		LEMONSQUEEZY_WEBHOOK_SECRET: mockSecret,
		LEMONSQUEEZY_API_KEY: "test_api_key",
		LEMONSQUEEZY_STORE_ID: "test_store_id",
		LEMONSQUEEZY_VARIANT_ID_PRO: "111",
		LEMONSQUEEZY_VARIANT_ID_ENTERPRISE: "999",
		LIVEBLOCKS_USER_LEFT_WEBHOOK_SECRET: "whsec_test_liveblocks_secret",
	},
}));
jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
}));
jest.mock("../../repositories/userRepository");

import crypto from "node:crypto";
import { handleLemonSqueezyWebhook } from "../../controllers/webhookController";
import userRepository from "../../repositories/userRepository";
import {
	mockNext,
	mockRequest,
	mockResponse,
} from "../../tests/mocks/express.mocks";

describe("WebhookController - Lemon Squeezy", () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		res = mockResponse();
		next = mockNext();
		process.env.LEMONSQUEEZY_WEBHOOK_SECRET = mockSecret;
	});

	it("should return 400 if rawBody is missing", async () => {
		req = mockRequest({
			headers: {
				"x-signature": "some_sig",
			},
			body: {},
		});

		await handleLemonSqueezyWebhook(req as Request, res as Response, next);

		expect(next).toHaveBeenCalledWith(
			expect.objectContaining({ statusCode: 400, message: "Missing raw body" }),
		);
	});

	it("should return 400 if signature is invalid", async () => {
		req = mockRequest({
			headers: {
				"x-signature": "invalid_sig",
			},
			body: {},
		});
		(req as any).rawBody = Buffer.from(JSON.stringify({}));

		await handleLemonSqueezyWebhook(req as Request, res as Response, next);

		expect(next).toHaveBeenCalledWith(
			expect.objectContaining({
				statusCode: 400,
				message: "Invalid signature",
			}),
		);
	});

	it("should process webhook and update user subscription if signature is valid", async () => {
		const payload = {
			meta: {
				event_name: "subscription_created",
				custom_data: {
					user_id: "user-123",
				},
			},
			data: {
				id: "sub_999",
				attributes: {
					customer_id: 888,
					status: "active",
					variant_id: 111,
					renews_at: "2026-06-25T00:00:00Z",
				},
			},
		};

		const rawBodyStr = JSON.stringify(payload);
		const hmac = crypto
			.createHmac("sha256", mockSecret)
			.update(Buffer.from(rawBodyStr))
			.digest("hex");

		req = mockRequest({
			headers: {
				"x-signature": hmac,
			},
			body: payload,
		});
		(req as any).rawBody = Buffer.from(rawBodyStr);

		await handleLemonSqueezyWebhook(req as Request, res as Response, next);

		expect(userRepository.update).toHaveBeenCalledWith("user-123", {
			subscriptionPlan: "pro",
			lemonSqueezyCustomerId: "888",
			lemonSqueezySubscriptionId: "sub_999",
			billingPeriodEnd: new Date("2026-06-25T00:00:00Z"),
		});

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({ success: true }),
		);
	});

	it("should process webhook and update user subscription to enterprise if variant matches", async () => {
		process.env.LEMONSQUEEZY_VARIANT_ID_ENTERPRISE = "999";
		const payload = {
			meta: {
				event_name: "subscription_created",
				custom_data: {
					user_id: "user-123",
				},
			},
			data: {
				id: "sub_999",
				attributes: {
					customer_id: 888,
					status: "active",
					variant_id: 999,
					renews_at: "2026-06-25T00:00:00Z",
				},
			},
		};

		const rawBodyStr = JSON.stringify(payload);
		const hmac = crypto
			.createHmac("sha256", mockSecret)
			.update(Buffer.from(rawBodyStr))
			.digest("hex");

		req = mockRequest({
			headers: {
				"x-signature": hmac,
			},
			body: payload,
		});
		(req as any).rawBody = Buffer.from(rawBodyStr);

		await handleLemonSqueezyWebhook(req as Request, res as Response, next);

		expect(userRepository.update).toHaveBeenCalledWith("user-123", {
			subscriptionPlan: "enterprise",
			lemonSqueezyCustomerId: "888",
			lemonSqueezySubscriptionId: "sub_999",
			billingPeriodEnd: new Date("2026-06-25T00:00:00Z"),
		});

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({ success: true }),
		);
	});
});
