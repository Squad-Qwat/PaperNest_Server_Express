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
import type { User } from "../types";
import logger from "../utils/logger";
import registrationService from "./registrationService";

export interface RegisterData {
	email: string;
	password: string;
	name: string;
	username: string;
	role: "Student" | "Lecturer";
	workspaceData?: {
		title: string;
		description?: string;
		icon?: string;
		mode: "create" | "join";
		invitationCode?: string;
	};
}

export interface LoginData {
	email: string;
	password: string;
}

export interface AuthResponse {
	user?: User;
	token?: string;
	refreshToken?: string;
	firebaseToken?: string;
	isNewUser?: boolean;
	isVerificationRequired?: boolean;
	firebaseData?: {
		uid: string;
		email: string;
		name: string;
		picture?: string;
	};
}

export interface CompleteSocialRegistrationData {
	firebaseToken: string;
	username: string;
	role: "Student" | "Lecturer";
	email?: string;
}

/**
 * Tiered Registration: Create Firebase User and 'Park' data in pending_registrations
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
	try {
		if (await userRepository.emailExists(data.email))
			throw new Error("Email already exists");
		if (await userRepository.usernameExists(data.username))
			throw new Error("Username already exists");

		// 1. Create Firebase User
		const firebaseUser = await auth.createUser({
			email: data.email,
			password: data.password,
			displayName: data.name,
			emailVerified: false,
		});

		// 2. Store data in pending_registrations instead of official users collection
		try {
			await registrationService.savePending(firebaseUser.uid, {
				email: data.email,
				name: data.name,
				username: data.username,
				role: data.role,
				workspaceData: data.workspaceData,
			});
		} catch (error) {
			// Cleanup Firebase user if metadata storage fails
			await auth.deleteUser(firebaseUser.uid);
			throw error;
		}

		// 3. Native Firebase Email will be triggered by frontend after sign-in
		// using the custom token returned below.

		return {
			isVerificationRequired: true,
			firebaseToken: await auth.createCustomToken(firebaseUser.uid),
		};
	} catch (error: any) {
		logger.error("Registration error:", error);
		throw error;
	}
};

/**
 * Finalize Tiered Registration: Commit to Firestore after verification is confirmed
 */
export const finalizeRegistration = async (
	firebaseToken: string,
): Promise<AuthResponse> => {
	try {
		const decodedToken = await auth.verifyIdToken(firebaseToken);

		// Check if email is verified in Firebase
		if (!decodedToken.email_verified) {
			throw new Error("EMAIL_NOT_VERIFIED");
		}

		// Check if registration was already finalized (idempotency check)
		const existingUser =
			(await userRepository.findById(decodedToken.uid)) ||
			(await userRepository.findByLinkedUid(decodedToken.uid));
		if (existingUser) {
			logger.info(
				`Registration already finalized for user ${decodedToken.uid}`,
			);
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

		// Atomic move from pending to main collections
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

/**
 * Login user with Firebase token (Standard)
 */
export const login = async (firebaseToken: string): Promise<AuthResponse> => {
	try {
		const decodedToken = await auth.verifyIdToken(firebaseToken);

		// Check if email is verified
		if (!decodedToken.email_verified) {
			return { isVerificationRequired: true };
		}

		const user =
			(await userRepository.findById(decodedToken.uid)) ||
			(await userRepository.findByLinkedUid(decodedToken.uid));

		if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);

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

/**
 * Login user with email and password using Firebase REST API
 */
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

		const { localId } = response.data;
		const user = await userRepository.findById(localId);

		if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);

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
		logger.error("Email password login error:", error.response?.data || error);
		if (
			error.response?.data?.error?.message === "INVALID_LOGIN_CREDENTIALS" ||
			error.response?.data?.error?.message === "EMAIL_NOT_FOUND" ||
			error.response?.data?.error?.message === "INVALID_PASSWORD"
		) {
			throw new Error("Invalid email or password");
		}
		throw error;
	}
};

/**
 * Helper to fetch emails from GitHub API
 */
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
		logger.error("GitHub Email Fetch error:", error);
		return null;
	}
};

/**
 * Handle Social Login with Unification Logic
 */
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

		if (!email) throw new Error("Email is required from provider");

		let user =
			(await userRepository.findById(uid)) ||
			(await userRepository.findByLinkedUid(uid));

		if (!user) {
			user = await userRepository.findByEmail(email);
			if (user) {
				logger.info(
					`Linking new UID ${uid} to existing user ${user.userId} (${email})`,
				);
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

/**
 * Complete Social Registration (Onboarding)
 */
export const completeSocialRegistration = async (
	data: CompleteSocialRegistrationData,
): Promise<AuthResponse> => {
	try {
		const decodedToken = await auth.verifyIdToken(data.firebaseToken);
		const { uid, name, picture } = decodedToken;
		const email = decodedToken.email || data.email;

		if (!email) throw new Error("Email not found");
		if (await userRepository.usernameExists(data.username))
			throw new Error("Username already exists");

		const existing = await userRepository.findByEmail(email);
		if (existing)
			throw new Error(
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

/**
 * Check if email is already in use
 */
export const checkEmailAvailability = async (
	email: string,
): Promise<{ available: boolean }> => {
	try {
		await auth.getUserByEmail(email);
		// If no error, email exists
		return { available: false };
	} catch (error: any) {
		if (error.code === "auth/user-not-found") {
			return { available: true };
		}
		throw error;
	}
};

/**
 * Auth Lifecycle & Maintenance
 */
export const refreshAccessToken = async (
	refreshToken: string,
): Promise<{ token: string }> => {
	const decoded = verifyRefreshToken(refreshToken);
	const user =
		(await userRepository.findById(decoded.userId)) ||
		(await userRepository.findByLinkedUid(decoded.userId));
	if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
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
	if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
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
	updateUserEmail,
	sendPasswordResetEmail,
	checkEmailAvailability,
};
