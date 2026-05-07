jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
}));
jest.mock("../../middlewares/auth");

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import axios from "axios";
import { __mockAuth } from "../../../__mocks__/firebase-admin";
import authService from "../../services/authService";
import userRepository from "../../repositories/userRepository";
import registrationService from "../../services/registrationService";
import { mockUser } from "../../tests/fixtures";
import * as authMiddleware from "../../middlewares/auth";

jest.mock("axios");
jest.mock("../../repositories/userRepository");
jest.mock("../../services/registrationService");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("AuthService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("register", () => {
		it("should register a new user and save to pending", async () => {
			const registerData = {
				email: "new@example.com",
				password: "password123",
				name: "New User",
				username: "newuser",
				role: "Student" as const,
			};

			jest.mocked(userRepository.emailExists).mockResolvedValue(false);
			jest.mocked(userRepository.usernameExists).mockResolvedValue(false);
			__mockAuth.createUser.mockResolvedValue({ uid: "uid-123" } as any);
			__mockAuth.createCustomToken.mockResolvedValue("custom-token");

			const result = await authService.register(registerData);

			expect(result).toEqual({
				isVerificationRequired: true,
				firebaseToken: "custom-token",
			});
			expect(registrationService.savePending).toHaveBeenCalled();
		});

		it("should throw error if email already exists", async () => {
			jest.mocked(userRepository.emailExists).mockResolvedValue(true);
			await expect(authService.register({ email: "existing@example.com" } as any)).rejects.toThrow("Email already exists");
		});
	});

	describe("finalizeRegistration", () => {
		it("should finalize registration if email is verified", async () => {
			const firebaseToken = "valid-token";
			__mockAuth.verifyIdToken.mockResolvedValue({
				uid: "uid-123",
				email_verified: true,
			} as any);

			jest.mocked(userRepository.findById).mockResolvedValue(null);
			jest.mocked(userRepository.findByLinkedUid).mockResolvedValue(null);
			jest.mocked(registrationService.finalize).mockResolvedValue(mockUser);
			jest.mocked(authMiddleware.generateToken).mockReturnValue("mock-token");
			jest.mocked(authMiddleware.generateRefreshToken).mockReturnValue("mock-refresh-token");

			const result = await authService.finalizeRegistration(firebaseToken);

			expect(result.user).toEqual(mockUser);
			expect(result.token).toBe("mock-token");
		});

		it("should throw error if email is not verified", async () => {
			__mockAuth.verifyIdToken.mockResolvedValue({
				uid: "uid-123",
				email_verified: false,
			} as any);

			await expect(authService.finalizeRegistration("token")).rejects.toThrow("EMAIL_NOT_VERIFIED");
		});
	});

	describe("login", () => {
		it("should login successfully if user exists and email verified", async () => {
			__mockAuth.verifyIdToken.mockResolvedValue({
				uid: "user-123",
				email_verified: true,
			} as any);
			jest.mocked(userRepository.findById).mockResolvedValue(mockUser);
			jest.mocked(authMiddleware.generateToken).mockReturnValue("mock-token");
			jest.mocked(authMiddleware.generateRefreshToken).mockReturnValue("mock-refresh-token");

			const result = await authService.login("token");

			expect(result.user).toEqual(mockUser);
		});

		it("should return verification required if email not verified", async () => {
			__mockAuth.verifyIdToken.mockResolvedValue({
				uid: "user-123",
				email_verified: false,
			} as any);

			const result = await authService.login("token");

			expect(result.isVerificationRequired).toBe(true);
		});
	});

	describe("handleSocialLogin", () => {
		it("should handle social login for new user", async () => {
			__mockAuth.verifyIdToken.mockResolvedValue({
				uid: "social-uid",
				email: "social@example.com",
				name: "Social User",
			} as any);
			jest.mocked(userRepository.findById).mockResolvedValue(null);
			jest.mocked(userRepository.findByLinkedUid).mockResolvedValue(null);
			jest.mocked(userRepository.findByEmail).mockResolvedValue(null);
			jest.mocked(authMiddleware.generateToken).mockReturnValue("mock-token");
			jest.mocked(authMiddleware.generateRefreshToken).mockReturnValue("mock-refresh-token");

			const result = await authService.handleSocialLogin("token");

			expect(result.isNewUser).toBe(true);
			expect(result.firebaseData?.email).toBe("social@example.com");
		});

		it("should link accounts if user exists with same email", async () => {
			__mockAuth.verifyIdToken.mockResolvedValue({
				uid: "social-uid",
				email: "john.doe@example.com",
			} as any);
			jest.mocked(userRepository.findById).mockResolvedValue(null);
			jest.mocked(userRepository.findByLinkedUid).mockResolvedValue(null);
			jest.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
			jest.mocked(authMiddleware.generateToken).mockReturnValue("mock-token");
			jest.mocked(authMiddleware.generateRefreshToken).mockReturnValue("mock-refresh-token");

			const result = await authService.handleSocialLogin("token");

			expect(userRepository.update).toHaveBeenCalled();
			expect(result.isNewUser).toBe(false);
		});
	});

	describe("deleteUser", () => {
		it("should delete user from firebase and database", async () => {
			await authService.deleteUser("user-123");
			expect(__mockAuth.deleteUser).toHaveBeenCalledWith("user-123");
			expect(userRepository.delete).toHaveBeenCalledWith("user-123");
		});
	});
});
