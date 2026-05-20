import type { Request, Response } from "express";
import { SUCCESS_MESSAGES } from "../config/constants";
import { asyncHandler } from "../middlewares/errorHandler";
import * as authService from "../services/authService";
import logger from "../utils/logger";
import {
	createdResponse,
	noContentResponse,
	successResponse,
} from "../utils/responseFormatter";

export const register = asyncHandler(async (req: Request, res: Response) => {
	const result = await authService.register(req.body);
	return createdResponse(res, result, SUCCESS_MESSAGES.REGISTER_SUCCESS);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
	const result = await authService.login(req.body.firebaseToken);
	return successResponse(res, result, SUCCESS_MESSAGES.LOGIN_SUCCESS);
});

export const loginWithEmailPassword = asyncHandler(
	async (req: Request, res: Response) => {
		const result = await authService.loginWithEmailPassword(req.body);
		return successResponse(res, result, SUCCESS_MESSAGES.LOGIN_SUCCESS);
	},
);

export const refreshToken = asyncHandler(
	async (req: Request, res: Response) => {
		const result = await authService.refreshAccessToken(req.body.refreshToken);
		return successResponse(res, result, "Access token refreshed successfully");
	},
);

export const verifyToken = asyncHandler(async (req: Request, res: Response) => {
	const user = await authService.verifyFirebaseToken(req.body.token);
	return successResponse(res, { user }, "Token is valid");
});

export const getCurrentUser = asyncHandler(
	async (req: Request, res: Response) => {
		return successResponse(
			res,
			{ user: req.user ? { ...req.user } : null },
			"User retrieved successfully",
		);
	},
);

export const deleteAccount = asyncHandler(
	async (req: Request, res: Response) => {
		if (!req.userId) {
			throw new Error("User ID not found in request");
		}
		await authService.deleteUser(req.userId);
		return noContentResponse(res);
	},
);

export const updateEmail = asyncHandler(async (req: Request, res: Response) => {
	if (!req.userId) {
		throw new Error("User ID not found in request");
	}
	await authService.updateUserEmail(req.userId, req.body.newEmail);
	return successResponse(res, null, "Email updated successfully");
});

export const sendPasswordReset = asyncHandler(
	async (req: Request, res: Response) => {
		await authService.sendPasswordResetEmail(req.body.email);
		return successResponse(
			res,
			null,
			"If the email exists, a password reset link has been sent",
		);
	},
);

export const socialLogin = asyncHandler(async (req: Request, res: Response) => {
	if (!req.body.firebaseToken) {
		throw new Error("Firebase token is required");
	}
	const result = await authService.handleSocialLogin(
		req.body.firebaseToken,
		req.body.accessToken,
	);
	return successResponse(
		res,
		result,
		result.isNewUser ? "New user detected" : SUCCESS_MESSAGES.LOGIN_SUCCESS,
	);
});

export const completeSocialRegistration = asyncHandler(
	async (req: Request, res: Response) => {
		const { firebaseToken, username, role } = req.body;
		if (!firebaseToken || !username || !role) {
			throw new Error(
				"Missing required fields: firebaseToken, username, and role are required",
			);
		}
		const result = await authService.completeSocialRegistration({
			firebaseToken,
			username,
			role,
			email: req.body.email,
		});
		return successResponse(
			res,
			result,
			"Social registration completed successfully",
		);
	},
);

export const checkEmail = asyncHandler(async (req: Request, res: Response) => {
	const { email } = req.body;
	const result = await authService.checkEmailAvailability(email);
	return successResponse(
		res,
		result,
		result.available ? "Email is available" : "Email is already in use",
	);
});

export const finalizeRegistration = asyncHandler(
	async (req: Request, res: Response) => {
		if (!req.body.firebaseToken) {
			throw new Error("Firebase token is required");
		}
		const result = await authService.finalizeRegistration(
			req.body.firebaseToken,
		);
		return successResponse(res, result, "Account finalized successfully");
	},
);

export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
	if (!req.firebaseUid) {
		throw new Error("Firebase UID not found");
	}
	await authService.sendOTP(req.firebaseUid);
	return successResponse(res, null, "OTP has been sent to your email");
});

export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
	if (!req.firebaseUid) {
		throw new Error("Firebase UID not found");
	}
	const { otp } = req.body;
	await authService.verifyOTP(req.firebaseUid, otp);
	return successResponse(res, null, "Email verified successfully");
});

export default {
	register,
	finalizeRegistration,
	login,
	socialLogin,
	completeSocialRegistration,
	refreshToken,
	verifyToken,
	getCurrentUser,
	deleteAccount,
	updateEmail,
	sendPasswordReset,
	checkEmail,
	sendOTP,
	verifyOTP,
};
