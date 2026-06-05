import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import { BillingService } from "../services/billingService";
import { BadRequestError, NotFoundError } from "../utils/errorTypes";
import logger from "../utils/logger";
import { successResponse } from "../utils/responseFormatter";

/**
 * Create a Lemon Squeezy checkout session
 * POST /api/billing/checkout
 * Protected
 */
export const createCheckout = asyncHandler(
	async (req: Request, res: Response) => {
		const { variantId } = req.body;
		const userId = req.userId;
		const userEmail = req.user?.email;

		if (!variantId) {
			throw new BadRequestError("Missing variantId in request body");
		}

		if (!userId || !userEmail) {
			throw new BadRequestError("User authentication details missing");
		}

		logger.info("Creating checkout session request", { userId, variantId });

		const checkout = await BillingService.createCheckoutSession(
			userId,
			userEmail,
			String(variantId),
		);

		return successResponse(
			res,
			checkout,
			"Checkout session created successfully",
		);
	},
);

/**
 * Get Lemon Squeezy Customer Portal URL for the user's active subscription
 * GET /api/billing/portal
 * Protected
 */
export const getCustomerPortal = asyncHandler(
	async (req: Request, res: Response) => {
		const subscriptionId = req.user?.lemonSqueezySubscriptionId;

		if (!subscriptionId) {
			throw new BadRequestError("No active subscription found for this user");
		}

		logger.info("Fetching customer portal URL request", { subscriptionId });

		const details = await BillingService.getSubscriptionDetails(subscriptionId);
		const portalUrl = details?.attributes?.urls?.customer_portal;

		if (!portalUrl) {
			throw new NotFoundError(
				"Customer portal URL not found in subscription details",
			);
		}

		return successResponse(
			res,
			{ portalUrl },
			"Customer portal URL retrieved successfully",
		);
	},
);

export default {
	createCheckout,
	getCustomerPortal,
};
