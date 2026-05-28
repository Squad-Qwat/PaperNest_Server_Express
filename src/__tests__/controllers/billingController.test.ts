import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

jest.mock("../../config/env", () => ({
	env: {
		LEMONSQUEEZY_WEBHOOK_SECRET: "test_secret",
		LEMONSQUEEZY_API_KEY: "test_api_key",
		LEMONSQUEEZY_STORE_ID: "test_store_id",
	},
}));

jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
}));

jest.mock("../../services/billingService", () => ({
	BillingService: {
		createCheckoutSession: jest.fn(),
		getSubscriptionDetails: jest.fn(),
	},
}));

import {
	createCheckout,
	getCustomerPortal,
} from "../../controllers/billingController";
import { BillingService } from "../../services/billingService";
import {
	mockNext,
	mockRequest,
	mockResponse,
} from "../../tests/mocks/express.mocks";

describe("BillingController", () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		res = mockResponse();
		next = mockNext();
	});

	describe("createCheckout", () => {
		it("should throw BadRequestError if variantId is missing", async () => {
			req = mockRequest({
				userId: "user-123",
				user: { email: "test@example.com" } as any,
				body: {},
			});

			await createCheckout(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith(
				expect.objectContaining({
					statusCode: 400,
					message: "Missing variantId in request body",
				}),
			);
		});

		it("should return checkout details if variantId is provided", async () => {
			req = mockRequest({
				userId: "user-123",
				user: { email: "test@example.com" } as any,
				body: { variantId: "var_123" },
			});

			const mockCheckout = { url: "https://checkout.url", id: "check_123" };
			jest
				.mocked(BillingService.createCheckoutSession)
				.mockResolvedValue(mockCheckout);

			await createCheckout(req as Request, res as Response, next);

			expect(BillingService.createCheckoutSession).toHaveBeenCalledWith(
				"user-123",
				"test@example.com",
				"var_123",
			);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					data: mockCheckout,
				}),
			);
		});
	});

	describe("getCustomerPortal", () => {
		it("should throw BadRequestError if user has no subscription", async () => {
			req = mockRequest({
				userId: "user-123",
				user: { email: "test@example.com" } as any, // no subscriptionId
			});

			await getCustomerPortal(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith(
				expect.objectContaining({
					statusCode: 400,
					message: "No active subscription found for this user",
				}),
			);
		});

		it("should return portalUrl if user has active subscription", async () => {
			req = mockRequest({
				userId: "user-123",
				user: {
					email: "test@example.com",
					lemonSqueezySubscriptionId: "sub_123",
				} as any,
			});

			const mockSubscriptionDetails = {
				attributes: {
					urls: {
						customer_portal: "https://portal.url",
					},
				},
			};

			jest
				.mocked(BillingService.getSubscriptionDetails)
				.mockResolvedValue(mockSubscriptionDetails as any);

			await getCustomerPortal(req as Request, res as Response, next);

			expect(BillingService.getSubscriptionDetails).toHaveBeenCalledWith(
				"sub_123",
			);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					data: { portalUrl: "https://portal.url" },
				}),
			);
		});
	});
});
