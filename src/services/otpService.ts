import { randomInt } from "node:crypto";
import { redis } from "../config/redis";
import logger from "../utils/logger";

export class OTPService {
	private static TTL = 300;

	static generateOTP(): string {
		return randomInt(100000, 999999).toString();
	}

	static async saveOTP(uid: string, otp: string): Promise<void> {
		const key = `otp:${uid}`;
		await redis.set(key, otp, { ex: this.TTL });
	}

	static async verifyOTP(uid: string, inputOtp: string): Promise<boolean> {
		const key = `otp:${uid}`;
		const storedOtp = await redis.get<string>(key);
		
		if (!storedOtp) return false;

		return String(storedOtp) === String(inputOtp);
	}

	static async deleteOTP(uid: string): Promise<void> {
		const key = `otp:${uid}`;
		await redis.del(key);
	}
}
