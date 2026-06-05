import {
	createCheckout,
	getSubscription,
	lemonSqueezySetup,
} from "@lemonsqueezy/lemonsqueezy.js";
import { env } from "../config/env";
import logger from "../utils/logger";

// Initialize Lemon Squeezy SDK with fallback for tests
lemonSqueezySetup({
	apiKey: env.LEMONSQUEEZY_API_KEY || "ls_dummy_key_for_testing",
	onError: (error) =>
		logger.error("Lemon Squeezy SDK initialization error:", error),
});

export class BillingService {
	/**
	 * Create a checkout session for a specific user and product variant
	 */
	static async createCheckoutSession(
		userId: string,
		userEmail: string,
		variantId: string,
	): Promise<{ url: string; id: string }> {
		const storeId = env.LEMONSQUEEZY_STORE_ID;
		if (!storeId) {
			logger.error("[BillingService] LEMONSQUEEZY_STORE_ID is not configured");
			throw new Error("Billing system misconfigured (Missing Store ID)");
		}

		logger.info("[BillingService] Creating checkout session", {
			userId,
			userEmail,
			variantId,
			storeId,
		});

		const { data, error } = await createCheckout(storeId, variantId, {
			checkoutData: {
				email: userEmail,
				custom: {
					user_id: userId,
				},
			},
			checkoutOptions: {
				embed: true,
			},
		});

		if (error) {
			logger.error("[BillingService] Error creating checkout session:", error);
			throw new Error(`Billing error: ${error.message}`);
		}

		if (!data?.data?.attributes?.url) {
			logger.error("[BillingService] Checkout session did not return a URL", {
				data,
			});
			throw new Error("Billing error: Did not receive checkout URL");
		}

		return {
			url: data.data.attributes.url,
			id: data.data.id,
		};
	}

	/**
	 * Retrieve a subscription's details from Lemon Squeezy
	 */
	static async getSubscriptionDetails(subscriptionId: string) {
		logger.info("[BillingService] Fetching subscription details", {
			subscriptionId,
		});

		const { data, error } = await getSubscription(subscriptionId);

		if (error) {
			logger.error(
				"[BillingService] Error fetching subscription details:",
				error,
			);
			throw new Error(`Billing error: ${error.message}`);
		}

		return data?.data;
	}
}
