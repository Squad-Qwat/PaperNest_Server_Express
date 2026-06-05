import { WebhookHandler } from "@liveblocks/node";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { asyncHandler } from "../middlewares/errorHandler";
import liveblocksWebhookService from "../services/liveblocksWebhookService";
import { BadRequestError } from "../utils/errorTypes";
import logger from "../utils/logger";
import { successResponse } from "../utils/responseFormatter";

const WEBHOOK_SECRET =
	env.LIVEBLOCKS_USER_LEFT_WEBHOOK_SECRET || "whsec_dummy_key_for_testing";

if (!env.LIVEBLOCKS_USER_LEFT_WEBHOOK_SECRET) {
	logger.error("LIVEBLOCKS_USER_LEFT_WEBHOOK_SECRET not configured");
}

const webhookHandler = new WebhookHandler(WEBHOOK_SECRET);

export const handleLiveblocksWebhook = asyncHandler(
	async (req: Request, res: Response) => {
		let event: any;
		try {
			event = webhookHandler.verifyRequest({
				headers: req.headers as any,
				rawBody:
					typeof req.body === "string" ? req.body : JSON.stringify(req.body),
			});
		} catch (error) {
			logger.error("Webhook verification failed:", error);
			throw new BadRequestError("Could not verify webhook call");
		}

		logger.info(`Verified webhook event: ${event.type}`);

		if (event.type === "userLeft") {
			const roomId = event.data?.roomId;

			if (!roomId) {
				throw new BadRequestError("Missing roomId");
			}

			logger.info("User left event received", {
				roomId,
				userId: event.data?.userId,
				connectionId: event.data?.connectionId,
			});

			await new Promise((resolve) => setTimeout(resolve, 2000));

			const cleanupResult =
				await liveblocksWebhookService.checkAndCleanupRoom(roomId);

			logger.info("Cleanup result:", cleanupResult);

			return successResponse(
				res,
				cleanupResult,
				"Webhook processed successfully",
			);
		}

		if (event.type === "userEntered") {
			logger.info("User entered room", {
				roomId: event.data?.roomId,
				userId: event.data?.userId,
				connectionId: event.data?.connectionId,
			});

			return successResponse(res, null, "Webhook processed successfully");
		}

		logger.info(`Unhandled webhook type: ${event.type}`);
		return successResponse(res, null, "Webhook processed successfully");
	},
);

export const webhookHealthCheck = asyncHandler(
	async (_req: Request, res: Response) => {
		return successResponse(
			res,
			{
				message: "Liveblocks Webhook Endpoint",
				status: "active",
				timestamp: new Date().toISOString(),
			},
			"Webhook endpoint is active",
		);
	},
);

export const handleLemonSqueezyWebhook = asyncHandler(
	async (req: Request, res: Response) => {
		const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;

		if (!secret) {
			logger.error("[Webhook] LEMONSQUEEZY_WEBHOOK_SECRET is not configured");
			return res.status(500).json({ error: "Webhook secret not configured" });
		}

		const rawBody = (req as any).rawBody;
		if (!rawBody) {
			logger.error("[Webhook] Missing raw body for signature verification");
			throw new BadRequestError("Missing raw body");
		}

		const crypto = await import("node:crypto");
		const hmac = crypto.createHmac("sha256", secret);
		const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
		const signature = Buffer.from(req.get("X-Signature") || "", "utf8");

		if (
			signature.length === 0 ||
			digest.length !== signature.length ||
			!crypto.timingSafeEqual(digest, signature)
		) {
			logger.warn(
				"[Webhook] Invalid signature received on Lemon Squeezy webhook",
			);
			throw new BadRequestError("Invalid signature");
		}

		const payload = req.body;
		const eventName = payload.meta?.event_name;
		const customData = payload.meta?.custom_data;
		const userId = customData?.user_id;

		logger.info(`[Webhook] Lemon Squeezy event received: ${eventName}`, {
			userId,
			payloadId: payload.data?.id,
		});

		if (!userId) {
			logger.info(
				"[Webhook] Lemon Squeezy event has no associated user_id, skipping update",
			);
			return successResponse(res, null, "Event received but no user_id found");
		}

		if (
			eventName === "subscription_created" ||
			eventName === "subscription_updated" ||
			eventName === "subscription_cancelled" ||
			eventName === "subscription_expired"
		) {
			const userRepository = (await import("../repositories/userRepository"))
				.default;
			const attributes = payload.data?.attributes;
			const subscriptionId = String(payload.data?.id);
			const customerId = String(attributes?.customer_id);
			const status = attributes?.status;

			const isPaid = status === "active" || status === "on_trial";
			let subscriptionPlan: "free" | "pro" | "enterprise" = "free";

			if (isPaid) {
				const variantId = String(attributes?.variant_id);
				if (variantId === env.LEMONSQUEEZY_VARIANT_ID_ENTERPRISE) {
					subscriptionPlan = "enterprise";
				} else {
					subscriptionPlan = "pro";
				}
			}

			const renewsAt = attributes?.renews_at;
			const endsAt = attributes?.ends_at;
			const periodEndStr = renewsAt || endsAt;
			const billingPeriodEnd = periodEndStr ? new Date(periodEndStr) : null;

			logger.info("[Webhook] Updating user subscription plan", {
				userId,
				subscriptionPlan,
				subscriptionId,
				status,
			});

			await userRepository.update(userId, {
				subscriptionPlan,
				lemonSqueezyCustomerId: customerId,
				lemonSqueezySubscriptionId: subscriptionId,
				billingPeriodEnd,
			});
		}

		return successResponse(res, null, "Webhook handled successfully");
	},
);
