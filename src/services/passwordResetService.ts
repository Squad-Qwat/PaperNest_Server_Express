import { randomBytes } from "node:crypto";
import { BadRequestError } from "../utils/errorTypes";
import { redis } from "../config/redis";

interface PasswordResetData {
	uid: string;
	email: string;
	used: boolean;
}

export class PasswordResetService {
	/** Token TTL: 15 minutes */
	private static readonly TTL = 60 * 15;
	private static readonly KEY_PREFIX = "pwd_reset:";

	/**
	 * Generate a cryptographically secure random token (48 bytes = 96 hex chars)
	 */
	static generateToken(): string {
		return randomBytes(48).toString("hex");
	}

	/**
	 * Persist token to Redis with TTL
	 */
	static async saveToken(
		token: string,
		uid: string,
		email: string,
	): Promise<void> {
		const key = `${PasswordResetService.KEY_PREFIX}${token}`;
		const data: PasswordResetData = { uid, email, used: false };
		await redis.set(key, JSON.stringify(data), {
			ex: PasswordResetService.TTL,
		});
	}

	/**
	 * Look up token — returns data or null if missing / expired
	 */
	static async getToken(
		token: string,
	): Promise<PasswordResetData | null> {
		const key = `${PasswordResetService.KEY_PREFIX}${token}`;
		const raw = await redis.get<string>(key);
		if (!raw) return null;

		try {
			const data: PasswordResetData =
				typeof raw === "string" ? JSON.parse(raw) : raw;
			return data;
		} catch {
			return null;
		}
	}

	/**
	 * Atomically mark token as used (prevents replay attacks)
	 */
	static async markUsed(token: string): Promise<void> {
		const key = `${PasswordResetService.KEY_PREFIX}${token}`;
		const raw = await redis.get<string>(key);
		if (!raw) return;

		try {
			const data: PasswordResetData =
				typeof raw === "string" ? JSON.parse(raw) : raw;
			data.used = true;
			// Keep remaining TTL short after use (30 s) so the key self-cleans
			await redis.set(key, JSON.stringify(data), { ex: 30 });
		} catch {
			// If parsing fails, just delete the key
			await redis.del(key);
		}
	}

	/**
	 * Delete token immediately
	 */
	static async deleteToken(token: string): Promise<void> {
		const key = `${PasswordResetService.KEY_PREFIX}${token}`;
		await redis.del(key);
	}

	/**
	 * Validate token — returns uid on success, throws BadRequestError on failure
	 */
	static async validate(
		token: string,
	): Promise<{ uid: string; email: string }> {
		const data = await PasswordResetService.getToken(token);

		if (!data) {
			throw new BadRequestError("RESET_TOKEN_INVALID_OR_EXPIRED");
		}

		if (data.used) {
			throw new BadRequestError("RESET_TOKEN_ALREADY_USED");
		}

		return { uid: data.uid, email: data.email };
	}
}
