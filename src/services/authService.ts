import axios from "axios";
import { ERROR_MESSAGES } from "../config/constants";
import { env } from "../config/env";
import { auth } from "../config/firebase";
import {
	generateRefreshToken,
	generateToken,
	verifyRefreshToken,
} from "../middlewares/auth";
import userRepository from "../repositories/userRepository";
import type {
	AuthResponse,
	CompleteSocialRegistrationData,
	LoginData,
	RegisterData,
	User,
} from "../types";
import { BadRequestError } from "../utils/errorTypes";
import logger from "../utils/logger";
import { EmailService } from "./emailService";
import { OTPService } from "./otpService";
import registrationService from "./registrationService";

export const register = async (data: RegisterData): Promise<AuthResponse> => {
	try {
		if (await userRepository.emailExists(data.email))
			throw new BadRequestError("Email already exists");
		if (await userRepository.usernameExists(data.username))
			throw new BadRequestError("Username already exists");

		const firebaseUser = await auth.createUser({
			email: data.email,
			password: data.password,
			displayName: data.name,
			emailVerified: false,
		});

		try {
			await registrationService.savePending(firebaseUser.uid, {
				email: data.email,
				name: data.name,
				username: data.username,
				role: data.role,
				workspaceData: data.workspaceData,
			});
		} catch (error) {
			await auth.deleteUser(firebaseUser.uid);
			throw error;
		}

		await sendOTP(firebaseUser.uid);

		return {
			isVerificationRequired: true,
			firebaseToken: await auth.createCustomToken(firebaseUser.uid),
		};
	} catch (error: any) {
		logger.error("Registration error:", error);
		throw error;
	}
};

export const finalizeRegistration = async (
	firebaseToken: string,
): Promise<AuthResponse> => {
	try {
		const decodedToken = await auth.verifyIdToken(firebaseToken);

		if (!decodedToken.email_verified) {
			throw new BadRequestError("EMAIL_NOT_VERIFIED");
		}

		const existingUser =
			(await userRepository.findById(decodedToken.uid)) ||
			(await userRepository.findByLinkedUid(decodedToken.uid));
		if (existingUser) {
			return {
				user: existingUser,
				token: generateToken({
					userId: existingUser.userId,
					email: existingUser.email,
					role: existingUser.role,
				}),
				refreshToken: generateRefreshToken({
					userId: existingUser.userId,
					email: existingUser.email,
					role: existingUser.role,
				}),
			};
		}

		const user = await registrationService.finalize(decodedToken.uid);

		return {
			user,
			token: generateToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
			refreshToken: generateRefreshToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
		};
	} catch (error: any) {
		logger.error("Finalization error:", error);
		throw error;
	}
};

export const login = async (firebaseToken: string): Promise<AuthResponse> => {
	try {
		const decodedToken = await auth.verifyIdToken(firebaseToken);

		if (!decodedToken.email_verified) {
			await sendOTP(decodedToken.uid);
			return { isVerificationRequired: true };
		}

		const user =
			(await userRepository.findById(decodedToken.uid)) ||
			(await userRepository.findByLinkedUid(decodedToken.uid));

		if (!user) throw new BadRequestError(ERROR_MESSAGES.USER_NOT_FOUND);

		return {
			user,
			token: generateToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
			refreshToken: generateRefreshToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
		};
	} catch (error) {
		logger.error("Login error:", error);
		throw error;
	}
};

export const loginWithEmailPassword = async (
	data: LoginData,
): Promise<AuthResponse> => {
	try {
		const response = await axios.post(
			`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`,
			{
				email: data.email,
				password: data.password,
				returnSecureToken: true,
			},
		);

		const { localId, idToken } = response.data;
		const user = await userRepository.findById(localId);

		if (!user) {
			const pending = await registrationService.getPending(localId);
			if (pending) {
				await sendOTP(localId);
				return {
					isVerificationRequired: true,
					firebaseToken: idToken,
				};
			}
			throw new BadRequestError(ERROR_MESSAGES.USER_NOT_FOUND);
		}

		return {
			user,
			token: generateToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
			refreshToken: generateRefreshToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
		};
	} catch (error: any) {
		if (
			error.response?.data?.error?.message === "INVALID_LOGIN_CREDENTIALS" ||
			error.response?.data?.error?.message === "EMAIL_NOT_FOUND" ||
			error.response?.data?.error?.message === "INVALID_PASSWORD"
		) {
			throw new BadRequestError("Invalid email or password");
		}
		throw error;
	}
};

const fetchGithubEmail = async (
	accessToken: string,
): Promise<string | null> => {
	try {
		const response = await axios.get("https://api.github.com/user/emails", {
			headers: { Authorization: `token ${accessToken}` },
		});

		if (Array.isArray(response.data)) {
			const primary = response.data.find((e: any) => e.primary && e.verified);
			if (primary) return primary.email;
			const verified = response.data.find((e: any) => e.verified);
			return verified ? verified.email : response.data[0]?.email || null;
		}
		return null;
	} catch (error) {
		return null;
	}
};

export const handleSocialLogin = async (
	firebaseToken: string,
	accessToken?: string,
): Promise<AuthResponse> => {
	try {
		const decodedToken = await auth.verifyIdToken(firebaseToken);
		let { uid, email, name, picture } = decodedToken;

		if (!email && accessToken) {
			email = (await fetchGithubEmail(accessToken)) || undefined;
		}

		if (!email) throw new BadRequestError("Email is required from provider");

		let user =
			(await userRepository.findById(uid)) ||
			(await userRepository.findByLinkedUid(uid));

		if (!user) {
			user = await userRepository.findByEmail(email);
			if (user) {
				const linkedUids = user.linkedUids || [];
				if (!linkedUids.includes(uid)) {
					linkedUids.push(uid);
					await userRepository.update(user.userId, { linkedUids });
				}
			}
		}

		if (!user) {
			return {
				isNewUser: true,
				firebaseToken,
				firebaseData: {
					uid,
					email,
					name: name || "",
					picture: picture || undefined,
				},
			};
		}

		if (picture && user.photoURL !== picture) {
			await userRepository.update(user.userId, { photoURL: picture });
			user.photoURL = picture;
		}

		return {
			user,
			isNewUser: false,
			token: generateToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
			refreshToken: generateRefreshToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
			firebaseToken: await auth.createCustomToken(user.userId),
		};
	} catch (error) {
		logger.error("Social Login error:", error);
		throw error;
	}
};

export const completeSocialRegistration = async (
	data: CompleteSocialRegistrationData,
): Promise<AuthResponse> => {
	try {
		const decodedToken = await auth.verifyIdToken(data.firebaseToken);
		const { uid, name, picture } = decodedToken;
		const email = decodedToken.email || data.email;

		if (!email) throw new BadRequestError("Email not found");
		if (await userRepository.usernameExists(data.username))
			throw new BadRequestError("Username already exists");

		const existing = await userRepository.findByEmail(email);
		if (existing)
			throw new BadRequestError(
				"An account with this email already exists. Please login instead.",
			);

		const user = await userRepository.create(uid, {
			email,
			name: name || data.username,
			username: data.username,
			role: data.role,
			photoURL: picture || null,
		});

		return {
			user,
			token: generateToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
			refreshToken: generateRefreshToken({
				userId: user.userId,
				email: user.email,
				role: user.role,
			}),
			firebaseToken: data.firebaseToken,
		};
	} catch (error) {
		logger.error("Registration completion error:", error);
		throw error;
	}
};

export const checkEmailAvailability = async (
	email: string,
): Promise<{ available: boolean }> => {
	try {
		await auth.getUserByEmail(email);
		return { available: false };
	} catch (error: any) {
		if (error.code === "auth/user-not-found") {
			return { available: true };
		}
		throw error;
	}
};

export const refreshAccessToken = async (
	refreshToken: string,
): Promise<{ token: string }> => {
	const decoded = verifyRefreshToken(refreshToken);
	const user =
		(await userRepository.findById(decoded.userId)) ||
		(await userRepository.findByLinkedUid(decoded.userId));
	if (!user) throw new BadRequestError(ERROR_MESSAGES.USER_NOT_FOUND);
	return {
		token: generateToken({
			userId: user.userId,
			email: user.email,
			role: user.role,
		}),
	};
};

export const verifyFirebaseToken = async (token: string): Promise<User> => {
	const decodedToken = await auth.verifyIdToken(token);
	const user =
		(await userRepository.findById(decodedToken.uid)) ||
		(await userRepository.findByLinkedUid(decodedToken.uid));
	if (!user) throw new BadRequestError(ERROR_MESSAGES.USER_NOT_FOUND);
	return user;
};

export const deleteUser = async (userId: string) => {
	await auth.deleteUser(userId);
	await userRepository.delete(userId);
};

export const updateUserEmail = async (userId: string, newEmail: string) => {
	await auth.updateUser(userId, { email: newEmail });
	await userRepository.update(userId, { email: newEmail });
};

export const sendPasswordResetEmail = async (email: string) => {
	const resetLink = await auth.generatePasswordResetLink(email);
	logger.info(`Password reset link for ${email}: ${resetLink}`);
};

export const sendOTP = async (uid: string) => {
	const firebaseUser = await auth.getUser(uid);
	if (!firebaseUser.email) throw new BadRequestError("Email tidak ditemukan");

	const otp = OTPService.generateOTP();
	await OTPService.saveOTP(uid, otp);
	await EmailService.sendOTPEmail(
		firebaseUser.email,
		firebaseUser.displayName || "User",
		otp,
	);
};

export const verifyOTP = async (uid: string, otp: string) => {
	const isValid = await OTPService.verifyOTP(uid, otp);
	if (!isValid)
		throw new BadRequestError("Kode OTP tidak valid atau sudah kadaluarsa");

	await auth.updateUser(uid, { emailVerified: true });
	await OTPService.deleteOTP(uid);
};

export default {
	register,
	finalizeRegistration,
	login,
	loginWithEmailPassword,
	handleSocialLogin,
	completeSocialRegistration,
	refreshAccessToken,
	verifyFirebaseToken,
	deleteUser,
	updateEmail: updateUserEmail,
	sendPasswordReset: sendPasswordResetEmail,
	checkEmail: checkEmailAvailability,
	sendOTP,
	verifyOTP,
};
